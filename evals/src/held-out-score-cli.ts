// npm run eval:score-heldout
// Grades every ok held-out run against the key and writes, per run,
// grades.json (proposals; Karlo sets `label`), and evals/results/held-out/
// gate.md: each bar metric and the outcome, for the `alone` arm (the gate).
// Any other arm gets the same table in <arm>.md. Labels already set are
// kept, and so is the hand-written note below the tables.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KnowledgeBase, loadIndex } from "@ward/core";
import { validateFindings } from "./findings.js";
import {
  barOutcome,
  buildGrades,
  tally,
  type RunGrades,
} from "./held-out-score.js";
import { loadHeldOut } from "./held-out.js";
import { heldOutKeyPath, heldOutResultsRoot } from "./paths.js";

const key = loadHeldOut(heldOutKeyPath);
const kb = new KnowledgeBase(loadIndex());

interface Meta {
  status: string;
  setup: string;
  smoke: boolean;
  case?: string;
  modelReported: string | null;
  wallMs: number;
  result: {
    total_cost_usd?: number;
    usage?: { output_tokens?: number };
  } | null;
}

const runs: { grades: RunGrades; meta: Meta; inspected: number }[] = [];
for (const name of readdirSync(heldOutResultsRoot).sort()) {
  const dir = join(heldOutResultsRoot, name);
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) continue;
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Meta;
  if (meta.status !== "ok" || meta.smoke) continue;
  const c = key.cases.find((x) => x.id === meta.case);
  if (c === undefined) continue;
  const checked = validateFindings(
    JSON.parse(readFileSync(join(dir, "findings.json"), "utf8")),
  );
  if (!checked.ok) {
    console.error(`${name}: invalid findings, skipped`);
    continue;
  }
  const gradesPath = join(dir, "grades.json");
  const previous = existsSync(gradesPath)
    ? (JSON.parse(readFileSync(gradesPath, "utf8")) as RunGrades)
    : undefined;
  const grades = buildGrades(name, c, checked.value, kb, previous);
  writeFileSync(gradesPath, `${JSON.stringify(grades, null, 2)}\n`);
  runs.push({ grades, meta, inspected: checked.value.inspected.length });
}

type Run = (typeof runs)[number];

function writeArm(setup: string, armRuns: Run[]): void {
  const t = tally(armRuns.map((r) => r.grades));
  const bar = barOutcome({
    found: t.found.length,
    harderMissed: t.harderMissed.length,
    decoysFlagged: t.decoysFlagged,
    wrongCitations: t.wrongCitations,
  });

  const status = t.provisional
    ? "PROVISIONAL: some labels are still proposals. Set every `label` in grades.json, then rerun."
    : "All labels set.";
  const models = [...new Set(armRuns.map((r) => r.meta.modelReported))].join(
    ", ",
  );
  const cost = armRuns.reduce(
    (s, r) => s + (r.meta.result?.total_cost_usd ?? 0),
    0,
  );
  const lines = [
    "<!-- gate:start (written by npm run eval:score-heldout) -->",
    `Runs: ${String(t.runs)} of ${String(key.cases.length)} cases. Model: ${models}. Key v${String(key.keyVersion)}.`,
    "",
    status,
    "",
    "| Metric | Result | Bar |",
    "| --- | --- | --- |",
    `| Found (lenient) | ${String(t.found.length)} of ${String(t.runs)} (${t.found.join(", ") || "none"}) | room ≤ 7, rethink ≥ 9 |`,
    `| Found (strict: a FAIL on the case) | ${String(t.strictFound.length)} of ${String(t.runs)} (${t.strictFound.join(", ") || "none"}) | main number from Plan 6 (evals/scoring.md) |`,
    `| Harder kinds missed | ${String(t.harderMissed.length)} (${t.harderMissed.join(", ") || "none"}) | room ≥ 2, rethink 0 |`,
    `| Decoys flagged | ${String(t.decoysFlagged)} | rethink ≤ 1 |`,
    `| Wrong citations | ${String(t.wrongCitations)} of ${String(t.citations)} (${String(t.citationsUngraded)} ungraded) | room ≥ 2, rethink ≤ 1 |`,
    "",
    `**Outcome: ${bar.outcome}** (${bar.reasons.join("; ")}).`,
    "",
    `Other findings: ${String(t.other.real)} real, ${String(t.other.defensible)} defensible, ${String(t.other.wrong)} wrong, ${String(t.other.ungraded)} ungraded.`,
    "",
    "| Case | Kind | Result | Findings | Files read | Seconds | $ (API-eq.) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...armRuns.map(
      (r) =>
        `| ${r.grades.case} | ${r.grades.kind} | ${t.strictFound.includes(r.grades.case) ? "found (strict)" : t.found.includes(r.grades.case) ? "found (lenient)" : "missed"} | ${String(r.grades.findings.length)} | ${String(r.inspected)} | ${String(Math.round(r.meta.wallMs / 1000))} | ${(r.meta.result?.total_cost_usd ?? 0).toFixed(2)} |`,
    ),
    "",
    `Total API-equivalent $${cost.toFixed(2)} (plan, not billed).`,
    "<!-- gate:end -->",
  ];

  const gate = setup === "alone";
  const gatePath = join(heldOutResultsRoot, gate ? "gate.md" : `${setup}.md`);
  const header = gate
    ? "# Held-out gate (batch 1)\n\n"
    : `# Held-out, arm \`${setup}\` (batch 1)\n\n`;
  const old = existsSync(gatePath) ? readFileSync(gatePath, "utf8") : "";
  const note = old.includes("<!-- gate:end -->")
    ? (old.split("<!-- gate:end -->")[1] ?? "")
    : "\n\n## Note (hand-written)\n\nTo do: outcome in words and Karlo's decision.\n";
  writeFileSync(gatePath, `${header}${lines.join("\n")}${note}`);
  console.log(
    `${setup}: ${bar.outcome}${t.provisional ? " (provisional)" : ""}`,
  );
  console.log(`Wrote ${gatePath}`);
}

for (const setup of [...new Set(runs.map((r) => r.meta.setup))].sort())
  writeArm(
    setup,
    runs.filter((r) => r.meta.setup === setup),
  );
