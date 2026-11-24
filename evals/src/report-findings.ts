import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Report } from "@ward/report";
import type { Finding, Findings } from "./findings.js";

// Ward's report (.ward/report.json) turned into the eval's findings format,
// in plain code, so the held-out scorer grades the `ward-check` arm the
// same way as `alone`. Nothing here is the model's: every field comes from
// a report row Ward's code wrote.

/** Folders never searched for a report: big, and never a project root. */
const SKIP = new Set([".git", "node_modules", "build", ".gradle", ".ward"]);

/**
 * Where the agent's report is: `.ward/report.json` in the copy or in a
 * project folder up to `depth` levels down (a repo whose Android project
 * isn't at the root). null when there is none or more than one.
 */
export function findReport(root: string, depth = 2): string | null {
  const hits: string[] = [];
  const walk = (dir: string, left: number) => {
    const here = join(dir, ".ward", "report.json");
    if (existsSync(here)) hits.push(here);
    if (left === 0) return;
    for (const e of readdirSync(dir, { withFileTypes: true }))
      if (e.isDirectory() && !SKIP.has(e.name))
        walk(join(dir, e.name), left - 1);
  };
  walk(root, depth);
  return hits.length === 1 ? (hits[0] ?? null) : null;
}

/** The project folder of a report path, relative to the copy ("" at the root). */
export function projectPrefix(root: string, reportPath: string): string {
  const rel = relative(root, join(reportPath, "..", ".."));
  return rel === "" ? "" : `${rel.split("\\").join("/")}/`;
}

export interface Converted {
  findings: Findings;
  /** Check IDs with a verdict but no evidence: nothing to score them by. */
  skippedNoEvidence: { fail: number; other: number };
}

/**
 * One finding per check ID whose rows carry evidence. A check under several
 * controls is one finding with every control in `masvs`. FAIL wins when its
 * rows differ. `prefix` turns project-relative paths into copy-relative ones.
 */
export function reportToFindings(report: Report, prefix = ""): Converted {
  interface Acc {
    title: string;
    verdicts: Set<string>;
    masvs: Set<string>;
    maswe: Set<string>;
    privacy: boolean;
    locations: Map<string, { file: string; line: number }>;
    reasons: Set<string>;
  }
  const byCheck = new Map<string, Acc>();
  const noEvidence = new Map<string, boolean>();
  for (const control of report.controls)
    for (const check of control.checks) {
      if (check.verdict === null || check.verdict === "NO FINDING") continue;
      if (check.verdict === "N/A") continue;
      if (check.evidence.length === 0) {
        noEvidence.set(
          check.id,
          (noEvidence.get(check.id) ?? false) || check.verdict === "FAIL",
        );
        continue;
      }
      let acc = byCheck.get(check.id);
      if (acc === undefined) {
        acc = {
          title: `${check.id}: ${check.title}`,
          verdicts: new Set(),
          masvs: new Set(),
          maswe: new Set(check.kind === "weakness" ? [check.id] : []),
          privacy: false,
          locations: new Map(),
          reasons: new Set(),
        };
        byCheck.set(check.id, acc);
      }
      acc.verdicts.add(check.verdict);
      acc.masvs.add(control.id);
      for (const m of check.maswe) acc.maswe.add(m);
      if (control.id.startsWith("MASVS-PRIVACY")) acc.privacy = true;
      if (check.reason !== null) acc.reasons.add(check.reason);
      for (const e of check.evidence) {
        const file = `${prefix}${e.file}`;
        acc.locations.set(`${file}:${String(e.line)}`, { file, line: e.line });
        acc.reasons.add(`${file}:${String(e.line)}: ${e.detail}`);
      }
    }

  const findings: Finding[] = [...byCheck.values()].map((a) => {
    const verdict = a.verdicts.has("FAIL")
      ? "FAIL"
      : a.verdicts.has("NEEDS DYNAMIC")
        ? "NEEDS DYNAMIC"
        : "MANUAL";
    return {
      title: a.title,
      category: a.privacy ? "privacy" : "security",
      // Ward rates no severity; the scorer doesn't read it.
      severity: "medium",
      verdict,
      masvs: [...a.masvs].sort(),
      maswe: [...a.maswe].sort(),
      locations: [...a.locations.values()],
      explanation: [...a.reasons].join("\n"),
    };
  });
  // Evidence-less IDs that also have an evidenced row are already findings.
  let fail = 0;
  let other = 0;
  for (const [id, isFail] of noEvidence)
    if (!byCheck.has(id)) {
      if (isFail) fail++;
      else other++;
    }

  const inspected = new Set<string>();
  for (const a of report.analyzers)
    for (const f of a.filesInspected) inspected.add(`${prefix}${f}`);
  for (const control of report.controls)
    for (const check of control.checks)
      for (const f of check.filesInspected) inspected.add(`${prefix}${f}`);

  return {
    findings: { findings, inspected: [...inspected].sort() },
    skippedNoEvidence: { fail, other },
  };
}
