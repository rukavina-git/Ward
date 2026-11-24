// npm run eval:proxy -- <run dir> [<run dir> …]
// Free proxy metrics (ADR 0013) for saved `ward-check` runs: Ward tool
// calls, how many answers came after the test text, NO FINDINGs without
// files or evidence, and on the planted example app the planted issues
// with a NO FINDING on their tests. Reads report.json, transcript.jsonl
// and meta.json; no model call. Prints a Markdown table.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { reportSchema } from "@ward/report";
import { toolCalls } from "./isolation.js";
import { itemsInApp, loadKey } from "./key.js";
import { keyPath } from "./paths.js";
import { GATE_SHARE, proxyMetrics } from "./proxy.js";

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("usage: npm run eval:proxy -- <run dir> [<run dir> …]");
  process.exit(2);
}

const key = loadKey(keyPath);
const pct = (x: number | null) =>
  x === null ? "–" : `${String(Math.round(x * 100))}%`;

console.log(
  `| Run | get_check | search | skeleton calls | Agent answers | Test text | NO FINDING (no files / no evidence) | Planted with NO FINDING | Gate (≥ ${pct(GATE_SHARE)}) |`,
);
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const dir of dirs) {
  const reportPath = join(dir, "report.json");
  const transcriptPath = join(dir, "transcript.jsonl");
  if (!existsSync(reportPath)) {
    console.error(`${dir}: no report.json, skipped`);
    continue;
  }
  const report = reportSchema.parse(
    JSON.parse(readFileSync(reportPath, "utf8")),
  );
  const calls = existsSync(transcriptPath)
    ? toolCalls(readFileSync(transcriptPath, "utf8"))
    : [];
  const meta = existsSync(join(dir, "meta.json"))
    ? (JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as {
        app?: string;
      })
    : {};
  const planted =
    meta.app === "planted" ? itemsInApp(key, "planted") : undefined;
  const p = proxyMetrics(report, calls, { planted });
  const fnf = planted
    ? Object.keys(p.falseNoFinding).join(", ") || "none"
    : "–";
  console.log(
    `| ${basename(dir)} | ${String(p.wardCalls.get_check ?? 0)} | ${String(p.wardCalls.search ?? 0)} | ${String(p.wardCalls.report_skeleton ?? 0)} | ${String(p.agentAnswers)} | ${String(p.testText)} (${pct(p.share)}, ${p.depthFrom === "transcript" && calls.length === 0 ? "no transcript" : p.depthFrom}) | ${String(p.agentNoFinding)} (${String(p.noFindingNoFiles)} / ${String(p.noFindingNoEvidence)}) | ${fnf} | ${p.gate ? "pass" : "no"} |`,
  );
}
