/**
 * The agent's answers to a skeleton's open checks, and how Ward's code
 * puts them into the report. The agent never writes IDs, titles or
 * control verdicts: it answers checks by ID, and code does the rest.
 */
import * as z from "zod/v4";
import type { CitationIssue } from "./citations.js";
import { finalize } from "./rollup.js";
import {
  evidenceSchema,
  VERDICTS,
  verdictSchema,
  type Report,
} from "./schema.js";

export const MAX_FILLS = 1000;

/** One answer. `control` limits it to the row under that control. */
export const fillSchema = z.object({
  check: z.string().min(1).max(64),
  control: z.string().min(1).max(64).optional(),
  verdict: verdictSchema,
  reason: z.string().min(1).max(4000),
  evidence: z.array(evidenceSchema).max(50).default([]),
  filesInspected: z.array(z.string().min(1).max(1024)).max(500).default([]),
});
export type Fill = z.infer<typeof fillSchema>;

export const fillsSchema = z.object({
  fills: z.array(fillSchema).max(MAX_FILLS),
});
export type Fills = z.infer<typeof fillsSchema>;

/** A fill code didn't take, and why. */
export interface RejectedFill {
  index: number;
  check: string;
  control?: string;
  reason: string;
}

export interface ApplyResult {
  report: Report;
  /** Fills that changed at least one row. */
  applied: number;
  rejected: RejectedFill[];
}

/**
 * Analyzers whose MANUAL lists facts the code decides (backup rules, an
 * exported activity's code, a network security config). Others need
 * what the code can't show: OSV data or an unresolved version
 * (dependencies, build_config), Play Console or the policy text
 * (must_exist). Their MANUAL stays.
 */
export const SETTLEABLE_ANALYZERS: ReadonlySet<string> = new Set([
  "manifest",
  "network",
]);

/**
 * An analyzer row the agent may settle: a MANUAL from analyzers that are
 * all in SETTLEABLE_ANALYZERS. The agent reads the deciding file and
 * answers. Plan 6 step 02: the clean twin's backup rules were left
 * MANUAL although `backup_rules.xml` settles them.
 */
export function settlesAnalyzerManual(row: {
  by: string | null;
  verdict: string | null;
  analyzer?: string | undefined;
}): boolean {
  if (row.by !== "analyzer" || row.verdict !== "MANUAL") return false;
  const names = (row.analyzer ?? "").split(",").map((n) => n.trim());
  return names.every((n) => SETTLEABLE_ANALYZERS.has(n));
}

/**
 * Applies fills to a skeleton. A NO FINDING without files read is
 * rejected (ADR 0013: nothing found must say where it looked). A fill
 * sets each matching pending row. On a row prefilled from the index
 * (`owasp`) only FAIL is taken: raising is allowed, lowering is not. An
 * analyzer row changes only when `settlesAnalyzerManual`; the analyzer's
 * reason and evidence are kept beside the agent's. Its FAIL, NO FINDING
 * and N/A stay. A row answered once keeps its first answer.
 */
export function applyFills(skeleton: Report, fills: Fills): ApplyResult {
  const controls = skeleton.controls.map((c) => ({
    ...c,
    checks: c.checks.map((t) => ({ ...t })),
  }));
  const answered = new Set<string>();
  const rejected: RejectedFill[] = [];
  let applied = 0;

  fills.fills.forEach((fill, index) => {
    const reject = (reason: string): void => {
      rejected.push({
        index,
        check: fill.check,
        ...(fill.control !== undefined && { control: fill.control }),
        reason,
      });
    };
    const rows = controls
      .filter((c) => fill.control === undefined || c.id === fill.control)
      .flatMap((c) =>
        c.checks
          .filter((t) => t.id === fill.check)
          .map((t) => ({ control: c.id, row: t })),
      );
    if (fill.verdict === "NO FINDING" && fill.filesInspected.length === 0) {
      reject(
        "NO FINDING needs filesInspected: list the files you read for this check.",
      );
      return;
    }
    if (rows.length === 0) {
      reject(
        fill.control === undefined
          ? "No check with this ID in the report's scope."
          : "No check with this ID under this control.",
      );
      return;
    }
    const why: string[] = [];
    let changed = 0;
    for (const { control, row } of rows) {
      const k = `${control}\u0000${row.id}`;
      if (answered.has(k)) {
        why.push("already answered by an earlier fill");
        continue;
      }
      if (row.by === "analyzer" && !settlesAnalyzerManual(row)) {
        why.push(
          "set by Ward's analyzers; agents may only settle a MANUAL from manifest or network",
        );
        continue;
      }
      if (row.by === "owasp" && fill.verdict !== "FAIL") {
        why.push(
          `prefilled ${String(row.verdict)} from the index; only FAIL may replace it`,
        );
        continue;
      }
      if (
        row.verdict !== null &&
        row.by !== "owasp" &&
        !settlesAnalyzerManual(row)
      ) {
        why.push("already decided");
        continue;
      }
      const settled = settlesAnalyzerManual(row);
      Object.assign(row, {
        verdict: fill.verdict,
        by: "agent",
        reason: settled
          ? `${fill.reason} Ward's analyzer said: ${row.reason ?? ""}`.slice(
              0,
              4000,
            )
          : fill.reason,
        evidence: settled ? [...fill.evidence, ...row.evidence] : fill.evidence,
        filesInspected: fill.filesInspected,
      });
      answered.add(k);
      changed++;
    }
    if (changed > 0) applied++;
    else reject(`Not applied: ${[...new Set(why)].join("; ")}.`);
  });

  return {
    report: finalize({ ...skeleton, controls }),
    applied,
    rejected,
  };
}

/** The summary never runs past this many lines. */
export const SUMMARY_MAX_LINES = 40;

/**
 * The one-screen terminal summary. Fixed format; IDs and titles come
 * from the report (the pinned index), file paths from the evidence.
 * Never says PASS or "ready".
 */
export function summaryText(
  report: Report,
  issues: readonly CitationIssue[],
  rejected: readonly RejectedFill[],
): string {
  const lines: string[] = [];
  const scope =
    report.scope.groups.length === 8
      ? "all MASVS groups"
      : report.scope.groups.map((g) => clip(g, 40)).join(", ");
  lines.push(
    `Ward check: ${String(report.controls.length)} MASVS controls (${scope}${report.scope.profile ? `, profile ${clip(report.scope.profile, 10)}` : ""}, variant ${clip(report.scope.variant, 40)})`,
  );
  const order = [...VERDICTS, "pending"];
  const counts = (r: Record<string, number>): string =>
    order
      .filter((v) => (r[v] ?? 0) > 0)
      .map((v) => `${v} ${String(r[v])}`)
      .join(" · ");
  lines.push(`Controls: ${counts(report.counts.controls) || "none"}`);
  lines.push(`Checks:   ${counts(report.counts.checks) || "none"}`);
  const d = report.counts.depth;
  if (d !== undefined) {
    const read = d["test text"] ?? 0;
    const title = d["title only"] ?? 0;
    lines.push(
      `Depth:    ${String(d.analyzer ?? 0)} by Ward's code · ${String(read)} of ${String(read + title)} agent answers after reading the test text`,
    );
  }

  const tail: string[] = [];
  const hardening = new Set<string>();
  for (const c of report.controls)
    for (const t of c.checks)
      if (t.hardening === true && t.verdict === "FAIL") hardening.add(t.id);
  if (hardening.size > 0) {
    tail.push(
      "",
      `Hardening not present (MASVS L2/R, not counted as FAIL): ${String(hardening.size)}`,
      `  ${head([...hardening].sort(), 5)}`,
      "  Run with profile L2 or R if your app needs these protections.",
    );
  }
  const g = report.gaps;
  tail.push(
    "",
    "Not checked",
    `  ${String(g.pending.length)} pending · ${String(g.manual.length)} manual · ${String(g.needsDynamic.length)} need a running app · ${String(g.outOfScope.length)} out of scope`,
  );
  if (g.pending.length > 0) {
    tail.push(`  pending: ${head(g.pending, 6)}`);
  }
  if (issues.length > 0) {
    tail.push(
      "",
      `Citation check: ${String(issues.length)} issue(s); failed evidence removed`,
    );
    for (const i of issues.slice(0, 4)) {
      tail.push(`  ${i.kind}: ${clip(i.message, 100)}`);
    }
  } else {
    tail.push("", "Citation check: every ID, file:line and quote confirmed");
  }
  if (rejected.length > 0) {
    tail.push(`Rejected answers: ${String(rejected.length)}`);
    for (const r of rejected.slice(0, 3)) {
      tail.push(`  ${clip(r.check, 40)}: ${clip(r.reason, 100)}`);
    }
  }
  tail.push(
    "",
    "NO FINDING means Ward found nothing, not that the app is safe.",
    "Full report: .ward/report.json",
  );

  // One line per finding (first evidence file:line) with its checks, in
  // report order. FAILs get the lines the rest leaves: header, rows, "…".
  const findings = new Map<string, Set<string>>();
  for (const c of report.controls) {
    for (const t of c.checks) {
      if (t.verdict !== "FAIL" || t.hardening === true) continue;
      const ev = t.evidence[0];
      const where = ev
        ? `${clip(ev.file, 120)}:${String(ev.line)}`
        : "no evidence";
      const ids = findings.get(where) ?? new Set<string>();
      ids.add(t.id);
      findings.set(where, ids);
    }
  }
  const fails = [...findings].map(
    ([where, ids]) => `  ${where}  ${head([...ids], 4)}`,
  );
  if (fails.length > 0) {
    const room = SUMMARY_MAX_LINES - lines.length - tail.length - 2;
    const shown = fails.length > room ? Math.max(0, room - 1) : fails.length;
    lines.push("", "FAIL (by finding)", ...fails.slice(0, shown));
    if (shown < fails.length) {
      lines.push(`  … ${String(fails.length - shown)} more in the report`);
    }
  }
  lines.push(...tail);
  return lines.slice(0, SUMMARY_MAX_LINES).join("\n");
}

function head(ids: readonly string[], n: number): string {
  const shown = ids.slice(0, n).map((id) => clip(id, 40));
  return ids.length > n
    ? `${shown.join(", ")} … +${String(ids.length - n)}`
    : shown.join(", ");
}

function clip(s: string, n: number): string {
  const one = displaySafe(s);
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

/**
 * Text from the app or the agent, made safe for one line of the summary
 * (plan 6 step 04). Line breaks become ⏎, so text can't start a line of
 * its own ("Citation check: … confirmed"); other control characters
 * (ANSI escapes included), bidi marks, zero-width and tag characters
 * become �; backticks become ˋ and runs of ~ become ˜, so nothing can
 * close the code block the summary is shown in (``` or ~~~). Tabs and
 * runs of spaces collapse to one space.
 */
// Control characters (C0, DEL, C1) and bidi marks and overrides.
const UNSAFE_CHARS = new RegExp(
  // eslint-disable-next-line no-control-regex -- matching them is the point
  "[\\u0000-\\u001f\\u007f-\\u009f\\u061c\\u200b-\\u200f\\u202a-\\u202e\\u2060\\u2066-\\u2069\\ufeff\\u{e0000}-\\u{e007f}]",
  "gu",
);

export function displaySafe(s: string): string {
  return s
    .replace(/\r\n|[\r\n\u2028\u2029\u0085]/g, "⏎")
    .replace(/\t/g, " ")
    .replace(UNSAFE_CHARS, "�")
    .replace(/`/g, "ˋ")
    .replace(/~~~+/g, (m) => "˜".repeat(m.length))
    .replace(/ +/g, " ");
}
