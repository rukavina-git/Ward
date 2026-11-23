// npm run eval:recheck -- <result folder>… --why "<reason>"
// Runs the current isolation check again on a run's saved transcript and
// rewrites its status. For a check that was wrong, not for a run that was:
// the run itself, its findings and the transcript stay as they are, and
// meta.json keeps the old isolation failures and the reason under `recheck`.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { checkIsolation, toolCalls } from "./isolation.js";
import { armTools, parseStream, redact } from "./run.js";
import { mcpToolNames, setups } from "./setups.js";

const { values, positionals } = parseArgs({
  options: { why: { type: "string" } },
  allowPositionals: true,
});
const why = values.why;
if (why === undefined || why.trim() === "" || positionals.length === 0) {
  console.error('usage: eval:recheck -- <result folder>… --why "<reason>"');
  process.exit(1);
}

for (const dir of positionals) {
  const metaPath = join(dir, "meta.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
    setup: string;
    status: string;
    failures: string[];
    recheck?: unknown;
  };
  const setup = setups[meta.setup];
  if (setup === undefined) throw new Error(`${dir}: unknown setup`);
  const transcript = readFileSync(join(dir, "transcript.jsonl"), "utf8");
  const stream = parseStream(transcript);
  const cwd = stream.init?.cwd;
  if (stream.init === null || typeof cwd !== "string")
    throw new Error(`${dir}: no init message with a cwd`);
  const plugin = setup.plugin?.name;
  const isolation = checkIsolation(stream.init, toolCalls(transcript), {
    tools: [
      ...armTools(setup),
      ...(setup.task === undefined ? ["StructuredOutput"] : []),
      ...(setup.mcp === undefined ? [] : mcpToolNames(setup.mcp)),
    ],
    plugin,
    mcpServer: setup.mcp?.name,
    cwd,
    realCwd: cwd,
    roots: [
      cwd,
      ...(plugin === undefined ? [] : [join(dirname(cwd), "plugins", plugin)]),
    ],
  });
  const before = meta.failures.filter((f) => f.startsWith("isolation: "));
  const others = meta.failures.filter((f) => !f.startsWith("isolation: "));
  const failures = [
    ...others,
    ...isolation.failures.map((f) => `isolation: ${f}`),
  ];
  const updated = {
    ...meta,
    status: failures.length === 0 ? "ok" : "failed",
    failures,
    recheck: {
      date: new Date().toISOString(),
      why,
      statusBefore: meta.status,
      isolationBefore: before,
    },
  };
  writeFileSync(
    metaPath,
    redact(`${JSON.stringify(updated, null, 2)}\n`, dirname(cwd)),
  );
  console.log(`${dir}: ${meta.status} → ${updated.status}`);
  for (const f of failures) console.log(`  ${f}`);
}
