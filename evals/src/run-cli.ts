// npm run eval:run -- --app planted|clean|canary --setup <arm> --model <id> --trial <n> [--smoke]
// npm run eval:run -- --heldout HO-NN --setup alone|ward|ward-check --model <id> --trial <n> [--smoke]
//   Held-out: the case's parent commit, exported from the clone that
//   `npm run heldout:check` made. Files only: the history holds the fix.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { readSchemaText, validateFindings } from "./findings.js";
import { checkIsolation, mcpCalls, toolCalls } from "./isolation.js";
import { fileSha256, loadHeldOut, repoSlug } from "./held-out.js";
import { applyCanary, CANARY_COMMENT, CANARY_TOKEN } from "./canary.js";
import { loadKey, type AppKind } from "./key.js";
import { reportSchema } from "@ward/report";
import {
  findReport,
  projectPrefix,
  reportToFindings,
} from "./report-findings.js";
import {
  cacheRoot,
  heldOutBarPath,
  heldOutCacheRoot,
  heldOutFolderName,
  heldOutKeyPath,
  heldOutResultsRoot,
  keyPath,
  repoRoot,
  resultsRoot,
  taskPromptPath,
} from "./paths.js";
import {
  buildArgs,
  childEnv,
  claudeVersion,
  copyFixture,
  copyPlugin,
  exportTree,
  dirHash,
  mcpConfig,
  fixtureState,
  parseStream,
  armTools,
  pluginSourceDir,
  redact,
  runClaude,
  summarizeInit,
  summarizeResult,
} from "./run.js";
import { mcpToolNames, setups } from "./setups.js";

const { values } = parseArgs({
  options: {
    app: { type: "string" },
    heldout: { type: "string" },
    setup: { type: "string" },
    model: { type: "string" },
    trial: { type: "string" },
    smoke: { type: "boolean", default: false },
    "timeout-min": { type: "string" },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const app = values.app;
const heldOutId = values.heldout;
if ((app === undefined) === (heldOutId === undefined))
  fail("give either --app planted|clean|canary or --heldout HO-NN");
if (app !== undefined && !["planted", "clean", "canary"].includes(app))
  fail("--app must be planted, clean or canary");
const setupName = values.setup ?? "";
const setup = setups[setupName];
if (setup === undefined)
  fail(`--setup must be one of: ${Object.keys(setups).join(", ")}`);
const model =
  values.model ?? fail("--model is required (Karlo picks the model)");
const trial = Number(values.trial);
if (!Number.isInteger(trial) || trial < 1)
  fail("--trial must be a whole number from 1");
// Real repos are far bigger than the example app.
const timeoutMin = Number(
  values["timeout-min"] ?? (heldOutId === undefined ? "30" : "60"),
);
if (!(timeoutMin > 0)) fail("--timeout-min must be a positive number");

const repoCommit = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
let target: {
  label: string;
  resultsRoot: string;
  key: { name: string; keyVersion: number };
  /** Read after the copy, so it can report what the export did. */
  meta: () => Record<string, unknown>;
  copy: () => { dir: string; parent: string };
};
if (heldOutId !== undefined) {
  if (!["alone", "ward", "ward-check"].includes(setupName))
    fail("held-out runs use --setup alone, ward or ward-check");
  const key = loadHeldOut(heldOutKeyPath);
  const c =
    key.cases.find((x) => x.id === heldOutId) ??
    fail(`no case ${heldOutId} in the held-out key`);
  const gitDir = join(heldOutCacheRoot, repoSlug(c.repo).replace("/", "__"));
  if (!existsSync(gitDir))
    fail(`no clone at ${gitDir}. Run npm run heldout:check first.`);
  let symlinksRemoved = 0;
  target = {
    label: c.id,
    resultsRoot: heldOutResultsRoot,
    key: { name: key.name, keyVersion: key.keyVersion },
    meta: () => ({
      case: c.id,
      repo: c.repo,
      commit: c.parent,
      commitRole: "parent",
      barSha256: fileSha256(heldOutBarPath),
      keySha256: fileSha256(heldOutKeyPath),
      symlinksRemoved,
    }),
    copy: () => {
      const out = exportTree(gitDir, c.parent, heldOutFolderName);
      symlinksRemoved = out.symlinksRemoved;
      return out;
    },
  };
} else {
  const key = loadKey(keyPath);
  // canary: the planted app with a prompt-injection comment (step 05).
  const canary = app === "canary";
  const fixture = key.apps[canary ? "planted" : (app as AppKind)];
  const fixtureInfo = fixtureState(repoRoot, fixture);
  if (fixtureInfo.dirty)
    fail(
      `${fixture} has uncommitted changes. The run copies the committed files.`,
    );
  target = {
    label: app as string,
    resultsRoot,
    key: { name: key.name, keyVersion: key.keyVersion },
    meta: () => ({
      app,
      fixture,
      fixtureTree: fixtureInfo.fixtureTree,
      ...(canary && { canary: { token: CANARY_TOKEN, comment: CANARY_COMMENT } }),
    }),
    copy: () => {
      const out = copyFixture(repoRoot, fixture);
      if (canary) applyCanary(out.dir);
      return out;
    },
  };
}

const date = new Date().toLocaleDateString("sv-SE");
const base = `${date}-${setupName}-${target.label}-t${String(trial)}${values.smoke ? "-smoke" : ""}`;
// A rerun after a failed attempt gets "-a2", "-a3"…; the failed one is kept.
let name = base;
for (let attempt = 2; existsSync(join(target.resultsRoot, name)); attempt++) {
  const metaPath = join(target.resultsRoot, name, "meta.json");
  const status: unknown = existsSync(metaPath)
    ? (JSON.parse(readFileSync(metaPath, "utf8")) as { status?: unknown })
        .status
    : "failed";
  if (status !== "failed") fail(`${name} already exists and didn't fail`);
  name = `${base}-a${String(attempt)}`;
}
const outDir = join(target.resultsRoot, name);
mkdirSync(outDir, { recursive: true });

const prompt = setup.task?.prompt ?? readFileSync(taskPromptPath, "utf8");
const schemaText = readSchemaText();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const schemaArg = JSON.stringify(JSON.parse(schemaText));
const version = claudeVersion();
const pluginSource =
  setup.plugin === undefined
    ? null
    : pluginSourceDir(setup.plugin.source, repoRoot, cacheRoot);

const mcpEntry =
  setup.mcp === undefined ? null : join(repoRoot, setup.mcp.entry);
if (mcpEntry !== null && !existsSync(mcpEntry))
  fail(`${mcpEntry} is missing. Run npm run build first.`);
const mcpArg =
  setup.mcp === undefined ? undefined : mcpConfig(setup.mcp, repoRoot);

const copy = target.copy();
console.error(`Running ${name} (${model}). This takes a few minutes.`);
try {
  const pluginDir =
    setup.plugin === undefined || pluginSource === null
      ? undefined
      : copyPlugin(pluginSource.dir, copy.parent, setup.plugin.name);
  const args = buildArgs(setup, {
    model,
    schema: setup.task === undefined ? schemaArg : undefined,
    pluginDir,
    mcpConfig: mcpArg,
  });
  const run = await runClaude({
    args,
    cwd: copy.dir,
    env: childEnv(process.env, copy.dir),
    prompt,
    transcriptPath: join(outDir, "transcript.jsonl"),
    stderrPath: join(outDir, "stderr.txt"),
    timeoutMs: timeoutMin * 60_000,
  });
  const transcript = readFileSync(join(outDir, "transcript.jsonl"), "utf8");
  const stream = parseStream(transcript);
  const calls = toolCalls(transcript);
  const wardCalls =
    setup.mcp === undefined ? null : mcpCalls(calls, setup.mcp.name);
  const roots = [copy.dir, ...(pluginDir === undefined ? [] : [pluginDir])];
  const isolation =
    stream.init === null
      ? null
      : checkIsolation(stream.init, calls, {
          tools: [
            ...armTools(setup),
            ...(setup.task === undefined ? ["StructuredOutput"] : []),
            ...(setup.mcp === undefined ? [] : mcpToolNames(setup.mcp)),
          ],
          plugin: setup.plugin?.name,
          mcpServer: setup.mcp?.name,
          cwd: copy.dir,
          realCwd:
            typeof stream.init.cwd === "string" ? stream.init.cwd : undefined,
          roots: [...roots, ...roots.map((r) => realpathSync(r))],
        });

  const failures: string[] = [];
  if (run.timedOut) failures.push(`timed out after ${String(timeoutMin)} min`);
  if (run.exitCode !== 0)
    failures.push(`claude exited with ${String(run.exitCode ?? run.signal)}`);
  if (stream.init === null) failures.push("no init message");
  if (stream.result === null) failures.push("no result message");
  if (stream.result?.is_error === true)
    failures.push(`result is an error: ${String(stream.result.subtype)}`);
  if (isolation !== null)
    failures.push(...isolation.failures.map((f) => `isolation: ${f}`));
  // A command arm's output is the report Ward's code wrote in the copy.
  let reportInfo: Record<string, unknown> | null = null;
  let output: unknown = stream.result?.structured_output;
  if (setup.task !== undefined) {
    output = undefined;
    const reportPath = findReport(copy.dir);
    // Only a report Ward's write_report wrote counts.
    if (
      !(wardCalls ?? []).some(
        (c) => c.tool === "write_report" && c.isError === false,
      )
    )
      failures.push("no successful write_report call");
    if (reportPath === null) {
      failures.push("no single .ward/report.json in the copy");
    } else {
      copyFileSync(reportPath, join(outDir, "report.json"));
      const fillsPath = join(dirname(reportPath), "fills.json");
      if (existsSync(fillsPath))
        copyFileSync(fillsPath, join(outDir, "fills.json"));
      let raw: unknown = null;
      try {
        raw = JSON.parse(readFileSync(reportPath, "utf8"));
      } catch {
        // Left null: the schema check below fails it.
      }
      const parsed = reportSchema.safeParse(raw);
      if (!parsed.success) {
        failures.push("report.json doesn't match Ward's report schema");
      } else {
        const prefix = projectPrefix(copy.dir, reportPath);
        const converted = reportToFindings(parsed.data, prefix);
        output = converted.findings;
        reportInfo = {
          projectPrefix: prefix,
          counts: parsed.data.counts,
          pending: parsed.data.gaps.pending.length,
          skippedNoEvidence: converted.skippedNoEvidence,
        };
      }
    }
  }
  let findingsCount: number | null = null;
  if (output === undefined) {
    if (setup.task === undefined) failures.push("no structured output");
  } else {
    // Stored exactly as returned. It's data: validated here, never executed.
    writeFileSync(
      join(outDir, "findings.json"),
      `${JSON.stringify(output, null, 2)}\n`,
    );
    const checked = validateFindings(output);
    if (checked.ok) findingsCount = checked.value.findings.length;
    else failures.push(...checked.errors.map((e) => `findings: ${e}`));
  }

  const meta = {
    name,
    date: new Date().toISOString(),
    smoke: values.smoke,
    setup: setupName,
    setupDescription: setup.description,
    plugin:
      setup.plugin === undefined || pluginDir === undefined
        ? null
        : {
            name: setup.plugin.name,
            source: setup.plugin.source,
            commit: pluginSource?.commit ?? null,
            sha256: dirHash(pluginDir),
          },
    mcp:
      setup.mcp === undefined || mcpEntry === null
        ? null
        : {
            name: setup.mcp.name,
            entry: setup.mcp.entry,
            distSha256: dirHash(dirname(mcpEntry)),
          },
    ...target.meta(),
    trial,
    modelRequested: model,
    modelReported: stream.init?.model ?? null,
    claudeCodeVersion: version,
    key: target.key,
    repoCommit,
    promptSha256: sha256(prompt),
    // The transcript stays local and unedited; this hash shows it.
    transcriptSha256: sha256(transcript),
    schemaSha256: sha256(schemaText),
    flags: args.map((a) =>
      a === schemaArg ? "<prompts/eval-findings.schema.json>" : a,
    ),
    report: reportInfo,
    status: failures.length === 0 ? "ok" : "failed",
    failures,
    exitCode: run.exitCode,
    timedOut: run.timedOut,
    wallMs: run.durationMs,
    findings: findingsCount,
    skillsInvoked: isolation?.skillsInvoked ?? null,
    wardCalls,
    searchQueries:
      wardCalls === null
        ? null
        : wardCalls
            .filter((c) => c.tool === "search")
            .map((c) => c.input.query ?? null),
    outsideBlocked: isolation?.outsideBlocked ?? null,
    init: stream.init === null ? null : summarizeInit(stream.init),
    result: stream.result === null ? null : summarizeResult(stream.result),
  };
  writeFileSync(
    join(outDir, "meta.json"),
    // The agent may use the real path (/private/var/… on macOS): redact
    // that one first, or "/private" stays in front of "<tmp>".
    redact(
      redact(`${JSON.stringify(meta, null, 2)}\n`, realpathSync(copy.parent)),
      copy.parent,
    ),
  );

  const cost = stream.result?.total_cost_usd;
  const turns = stream.result?.num_turns;
  console.error(
    `${meta.status}: ${String(findingsCount ?? "no")} findings, ` +
      `${typeof turns === "number" ? String(turns) : "?"} turns, ` +
      `${String(Math.round(run.durationMs / 1000))} s, ` +
      `API-equivalent $${typeof cost === "number" ? cost.toFixed(2) : "?"} (plan, not billed)`,
  );
  for (const f of failures) console.error(`  ${f}`);
  console.error(`Results: ${outDir}`);
  if (meta.status === "ok")
    console.error(`Next: npm run eval:score -- ${outDir}`);
  else process.exitCode = 1;
} finally {
  rmSync(copy.parent, { recursive: true, force: true });
}
