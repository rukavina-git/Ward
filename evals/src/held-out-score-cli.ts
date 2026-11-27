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
import { heldOutCases } from "./held-out.js";
import { heldOutResultsRoot } from "./paths.js";

const cases = heldOutCases();
/**
 * Batch 2 fixes that name an AI co-author (evals/held-out-batch2.md).
 * Karlo kept them (2026-11-26); found is also reported without them.
 */
const AI_CO_AUTHORED = new Set(["HO-14", "HO-17", "HO-18", "HO-19", "HO-27"]);
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

/**
 * The table a run goes into: its setup, with "-v2" for ward-check runs
 * from Ward 0.11 on (skill v2, plan 6), so v1 and v2 never mix.
 */
function armOf(setup: string, dir: string): string {
  const reportPath = join(dir, "report.json");
  if (setup !== "ward-check" || !existsSync(reportPath)) return setup;
  const version = (
    JSON.parse(readFileSync(reportPath, "utf8")) as {
      stamps?: { wardVersion?: string };
    }
  ).stamps?.wardVersion;
  const [major = 0, minor = 0] = (version ?? "0.0").split(".").map(Number);
  return major > 0 || minor >= 11 ? "ward-check-v2" : setup;
}

const runs: {
  grades: RunGrades;
  meta: Meta;
  arm: string;
  inspected: number;
}[] = [];
for (const name of readdirSync(heldOutResultsRoot).sort()) {
  const dir = join(heldOutResultsRoot, name);
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) continue;
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Meta;
  if (meta.status !== "ok" || meta.smoke) continue;
  const c = cases.find((x) => x.id === meta.case);
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
  runs.push({
    grades,
    meta,
    arm: armOf(meta.setup, dir),
    inspected: checked.value.inspected.length,
  });
}

type Run = (typeof runs)[number];

function writeArm(setup: string, armRuns: Run[]): void {
  const t = tally(armRuns.map((r) => r.grades));
  const batchOf = (id: string) => cases.find((c) => c.id === id)?.batch;
  const sub = (keep: (r: Run) => boolean) =>
    tally(armRuns.filter(keep).map((r) => r.grades));
  const b1 = sub((r) => batchOf(r.grades.case) === 1);
  const b2 = sub((r) => batchOf(r.grades.case) === 2);
  const noAi = sub((r) => !AI_CO_AUTHORED.has(r.grades.case));
  // The batch 1 bar (held-out-bar.md) reads batch 1 runs only.
  const bar = barOutcome({
    found: b1.found.length,
    harderMissed: b1.harderMissed.length,
    decoysFlagged: b1.decoysFlagged,
    wrongCitations: b1.wrongCitations,
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
    `Runs: ${String(t.runs)} of ${String(cases.length)} cases (batch 1: ${String(b1.runs)}, batch 2: ${String(b2.runs)}). Model: ${models}.`,
    "",
    status,
    "",
    "| Metric | Result | Bar |",
    "| --- | --- | --- |",
    `| Found (lenient) | ${String(t.found.length)} of ${String(t.runs)} (${t.found.join(", ") || "none"}) | room ≤ 7, rethink ≥ 9 |`,
    `| Found (strict: a FAIL on the case) | ${String(t.strictFound.length)} of ${String(t.runs)} (${t.strictFound.join(", ") || "none"}) | main number from Plan 6 (evals/scoring.md) |`,
    `| Strict, batch 1 / batch 2 | ${String(b1.strictFound.length)} of ${String(b1.runs)} / ${String(b2.strictFound.length)} of ${String(b2.runs)} | |`,
    `| Strict, without AI-co-authored fixes | ${String(noAi.strictFound.length)} of ${String(noAi.runs)} | |`,
    `| Harder kinds missed | ${String(t.harderMissed.length)} (${t.harderMissed.join(", ") || "none"}) | room ≥ 2, rethink 0 |`,
    `| Decoys flagged | ${String(t.decoysFlagged)} | rethink ≤ 1 |`,
    `| Wrong citations | ${String(t.wrongCitations)} of ${String(t.citations)} (${String(t.citationsUngraded)} ungraded) | room ≥ 2, rethink ≤ 1 |`,
    "",
    `**Batch 1 bar outcome: ${bar.outcome}** (${bar.reasons.join("; ")}). The Plan 6 bar for all cases is in evals/held-out-v2-bar.md.`,
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
    ? "# Held-out gate\n\n"
    : `# Held-out, arm \`${setup}\`\n\n`;
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

for (const arm of [...new Set(runs.map((r) => r.arm))].sort())
  writeArm(
    arm,
    runs.filter((r) => r.arm === arm),
  );
