// npm run eval:run -- --app planted|clean --setup <arm> --model <id> --trial <n> [--smoke]
// npm run eval:run -- --heldout HO-NN --setup alone --model <id> --trial <n> [--smoke]
//   Held-out: the case's parent commit, exported from the clone that
//   `npm run heldout:check` made. Files only: the history holds the fix.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readSchemaText, validateFindings } from "./findings.js";
import { checkIsolation, toolCalls } from "./isolation.js";
import { fileSha256, loadHeldOut, repoSlug } from "./held-out.js";
import { loadKey, type AppKind } from "./key.js";
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
  fixtureState,
  parseStream,
  pluginSourceDir,
  redact,
  runClaude,
  summarizeInit,
  summarizeResult,
  TOOLS,
} from "./run.js";
import { setups } from "./setups.js";

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
  fail("give either --app planted|clean or --heldout HO-NN");
if (app !== undefined && app !== "planted" && app !== "clean")
  fail("--app must be planted or clean");
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
  if (setupName !== "alone") fail("held-out runs use --setup alone only");
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
  const fixture = key.apps[app as AppKind];
  const fixtureInfo = fixtureState(repoRoot, fixture);
  if (fixtureInfo.dirty)
    fail(
      `${fixture} has uncommitted changes. The run copies the committed files.`,
    );
  target = {
    label: app as string,
    resultsRoot,
    key: { name: key.name, keyVersion: key.keyVersion },
    meta: () => ({ app, fixture, fixtureTree: fixtureInfo.fixtureTree }),
    copy: () => copyFixture(repoRoot, fixture),
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

const prompt = readFileSync(taskPromptPath, "utf8");
const schemaText = readSchemaText();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const schemaArg = JSON.stringify(JSON.parse(schemaText));
const version = claudeVersion();
const pluginSource =
  setup.plugin === undefined
    ? null
    : pluginSourceDir(setup.plugin.source, repoRoot, cacheRoot);

const copy = target.copy();
console.error(`Running ${name} (${model}). This takes a few minutes.`);
try {
  const pluginDir =
    setup.plugin === undefined || pluginSource === null
      ? undefined
      : copyPlugin(pluginSource.dir, copy.parent, setup.plugin.name);
  const args = buildArgs(setup, { model, schema: schemaArg, pluginDir });
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
  const roots = [copy.dir, ...(pluginDir === undefined ? [] : [pluginDir])];
  const isolation =
    stream.init === null
      ? null
      : checkIsolation(stream.init, toolCalls(transcript), {
          tools: [...TOOLS, "StructuredOutput"],
          plugin: setup.plugin?.name,
          cwd: copy.dir,
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
  const output = stream.result?.structured_output;
  let findingsCount: number | null = null;
  if (output === undefined) {
    failures.push("no structured output");
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
    ...target.meta(),
    trial,
    modelRequested: model,
    modelReported: stream.init?.model ?? null,
    claudeCodeVersion: version,
    key: target.key,
    repoCommit,
    promptSha256: sha256(prompt),
    schemaSha256: sha256(schemaText),
    flags: args.map((a) =>
      a === schemaArg ? "<prompts/eval-findings.schema.json>" : a,
    ),
    status: failures.length === 0 ? "ok" : "failed",
    failures,
    exitCode: run.exitCode,
    timedOut: run.timedOut,
    wallMs: run.durationMs,
    findings: findingsCount,
    skillsInvoked: isolation?.skillsInvoked ?? null,
    outsideBlocked: isolation?.outsideBlocked ?? null,
    init: stream.init === null ? null : summarizeInit(stream.init),
    result: stream.result === null ? null : summarizeResult(stream.result),
  };
  writeFileSync(
    join(outDir, "meta.json"),
    redact(`${JSON.stringify(meta, null, 2)}\n`, copy.parent),
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
