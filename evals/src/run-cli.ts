// npm run eval:run -- --app planted|clean --setup <arm> --model <id> --trial <n> [--smoke]
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
import { loadKey, type AppKind } from "./key.js";
import {
  cacheRoot,
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
    setup: { type: "string" },
    model: { type: "string" },
    trial: { type: "string" },
    smoke: { type: "boolean", default: false },
    "timeout-min": { type: "string", default: "30" },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const app = values.app;
if (app !== "planted" && app !== "clean")
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
const timeoutMin = Number(values["timeout-min"]);
if (!(timeoutMin > 0)) fail("--timeout-min must be a positive number");

const key = loadKey(keyPath);
const fixture = key.apps[app satisfies AppKind];
const state = fixtureState(repoRoot, fixture);
if (state.dirty)
  fail(
    `${fixture} has uncommitted changes. The run copies the committed files.`,
  );

const date = new Date().toLocaleDateString("sv-SE");
const base = `${date}-${setupName}-${app}-t${String(trial)}${values.smoke ? "-smoke" : ""}`;
// A rerun after a failed attempt gets "-a2", "-a3"…; the failed one is kept.
let name = base;
for (let attempt = 2; existsSync(join(resultsRoot, name)); attempt++) {
  const metaPath = join(resultsRoot, name, "meta.json");
  const status: unknown = existsSync(metaPath)
    ? (JSON.parse(readFileSync(metaPath, "utf8")) as { status?: unknown })
        .status
    : "failed";
  if (status !== "failed") fail(`${name} already exists and didn't fail`);
  name = `${base}-a${String(attempt)}`;
}
const outDir = join(resultsRoot, name);
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

const copy = copyFixture(repoRoot, fixture);
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
    app,
    trial,
    modelRequested: model,
    modelReported: stream.init?.model ?? null,
    claudeCodeVersion: version,
    key: { name: key.name, keyVersion: key.keyVersion },
    repoCommit: state.repoCommit,
    fixture,
    fixtureTree: state.fixtureTree,
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
