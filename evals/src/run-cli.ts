// npm run eval:run -- --app planted|clean --setup alone --model <id> --trial <n> [--smoke]
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readSchemaText, validateFindings } from "./findings.js";
import { loadKey, type AppKind } from "./key.js";
import { keyPath, repoRoot, resultsRoot, taskPromptPath } from "./paths.js";
import {
  buildArgs,
  childEnv,
  claudeVersion,
  copyFixture,
  fixtureState,
  parseStream,
  redact,
  runClaude,
  summarizeInit,
  summarizeResult,
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
const name = `${date}-${setupName}-${app}-t${String(trial)}${values.smoke ? "-smoke" : ""}`;
const outDir = join(resultsRoot, name);
if (existsSync(outDir)) fail(`${outDir} already exists`);
mkdirSync(outDir, { recursive: true });

const prompt = readFileSync(taskPromptPath, "utf8");
const schemaText = readSchemaText();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const schemaArg = JSON.stringify(JSON.parse(schemaText));
const args = buildArgs(setup, { model, schema: schemaArg });
const version = claudeVersion();

const copy = copyFixture(repoRoot, fixture);
console.error(`Running ${name} (${model}). This takes a few minutes.`);
try {
  const run = await runClaude({
    args,
    cwd: copy.dir,
    env: childEnv(process.env, copy.dir),
    prompt,
    transcriptPath: join(outDir, "transcript.jsonl"),
    stderrPath: join(outDir, "stderr.txt"),
    timeoutMs: timeoutMin * 60_000,
  });
  const stream = parseStream(
    readFileSync(join(outDir, "transcript.jsonl"), "utf8"),
  );

  const failures: string[] = [];
  if (run.timedOut) failures.push(`timed out after ${String(timeoutMin)} min`);
  if (run.exitCode !== 0)
    failures.push(`claude exited with ${String(run.exitCode ?? run.signal)}`);
  if (stream.init === null) failures.push("no init message");
  if (stream.result === null) failures.push("no result message");
  if (stream.result?.is_error === true)
    failures.push(`result is an error: ${String(stream.result.subtype)}`);
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
      `estimated $${typeof cost === "number" ? cost.toFixed(2) : "?"} (plan, not billed)`,
  );
  for (const f of failures) console.error(`  ${f}`);
  console.error(`Results: ${outDir}`);
  if (meta.status === "ok")
    console.error(`Next: npm run eval:score -- ${outDir}`);
  else process.exitCode = 1;
} finally {
  rmSync(copy.parent, { recursive: true, force: true });
}
