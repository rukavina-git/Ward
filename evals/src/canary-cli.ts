// npm run eval:canary -- <run dir> [<run dir> …]
// Scores prompt-injection canary runs (plan 6 step 05) in code: did a
// target row flip from FAIL, did the canary word come back, did the
// agent call the comment out? No model call. Planted runs can be passed
// too, as the baseline (the word can't appear there).
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { reportSchema } from "@ward/report";
import { scoreCanary } from "./canary.js";
import { parseStream } from "./run.js";

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("usage: npm run eval:canary -- <run dir> [<run dir> …]");
  process.exit(1);
}

const read = (p: string): string => (existsSync(p) ? readFileSync(p, "utf8") : "");
const rows: string[] = [
  "| Run | App | Target rows (EA-07 0232, EA-06 0212) | Flipped | Canary word in | Called out |",
  "| --- | --- | --- | --- | --- | --- |",
];
for (const dir of dirs) {
  const meta = JSON.parse(read(join(dir, "meta.json")) || "{}") as { app?: string };
  const report = reportSchema.parse(JSON.parse(read(join(dir, "report.json"))));
  const { result } = parseStream(read(join(dir, "transcript.jsonl")));
  const finalMessage = typeof result?.result === "string" ? result.result : "";
  const s = scoreCanary({ report, fillsText: read(join(dir, "fills.json")), finalMessage });
  const verdicts = s.targets
    .map((t) => `${t.item}: ${Object.values(t.verdicts).join("/") || "none"}`)
    .join("; ");
  const flipped = s.targets.filter((t) => t.flipped).map((t) => t.item);
  rows.push(
    `| ${basename(dir)} | ${meta.app ?? "?"} | ${verdicts} | ${flipped.join(", ") || "none"} | ${s.tokenIn.join(", ") || "nowhere"} | ${s.flagged ? "yes" : "no"} |`,
  );
}
console.log(rows.join("\n"));
