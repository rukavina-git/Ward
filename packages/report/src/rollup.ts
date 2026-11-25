/**
 * The strict rollup (ADR 0012): a control's verdict comes from its checks
 * in code, never from the model. The worst check wins, so NO FINDING
 * never covers a MANUAL or a NEEDS DYNAMIC.
 */
import {
  VERDICTS,
  type Control,
  type Depth,
  type Report,
  type Verdict,
} from "./schema.js";

/** Worst first: FAIL, MANUAL, NEEDS DYNAMIC, NO FINDING, N/A. */
const rank = (v: Verdict): number => VERDICTS.indexOf(v);

/** The worst of some verdicts; undefined for none. */
export function worst(verdicts: readonly Verdict[]): Verdict | undefined {
  let out: Verdict | undefined;
  for (const v of verdicts)
    if (out === undefined || rank(v) < rank(out)) out = v;
  return out;
}

/**
 * A control's verdict. Any FAIL is FAIL. Otherwise a pending check leaves
 * the control pending (null): what's left could still fail. A control
 * with no checks is MANUAL, since Ward has nothing to check it with.
 * Hardening checks (ADR 0014) don't count when the control has others;
 * a control with only hardening checks rolls them up with FAIL read as
 * MANUAL: a protection is missing, and whether the app needs it is the
 * owner's call.
 */
export function rollupControl(
  control: Pick<Control, "checks">,
): Verdict | null {
  const base = control.checks.filter((c) => c.hardening !== true);
  if (base.length === 0 && control.checks.length > 0) {
    const v = rollupControl({
      checks: control.checks.map((c) => ({ ...c, hardening: false })),
    });
    return v === "FAIL" ? "MANUAL" : v;
  }
  const decided: Verdict[] = [];
  let pending = false;
  for (const c of base) {
    if (c.verdict === null) pending = true;
    else decided.push(c.verdict);
  }
  if (decided.includes("FAIL")) return "FAIL";
  if (pending) return null;
  return worst(decided) ?? "MANUAL";
}

const key = (v: Verdict | null): string => v ?? "pending";

/**
 * Recomputes everything derived: control verdicts, counts and gaps. Run
 * it after any check changes; whatever the derived fields held is
 * replaced. `outOfScope` is the one gap set by the caller (the scope
 * doesn't change while a report is filled), so it is kept.
 */
export function finalize(
  report: Omit<Report, "counts" | "gaps"> & {
    gaps?: Pick<Report["gaps"], "outOfScope">;
  },
): Report {
  const controls = report.controls.map((c) => ({
    ...c,
    verdict: rollupControl(c),
  }));
  const counts: Report["counts"] = { controls: {}, checks: {} };
  const depth: Record<string, number> = {};
  const hardening: Record<string, number> = {};
  const pending = new Set<string>();
  const manual = new Set<string>();
  const needsDynamic = new Set<string>();
  for (const c of controls) {
    counts.controls[key(c.verdict)] =
      (counts.controls[key(c.verdict)] ?? 0) + 1;
    if (c.checks.length === 0) manual.add(c.id);
    for (const t of c.checks) {
      const bucket = t.hardening === true ? hardening : counts.checks;
      bucket[key(t.verdict)] = (bucket[key(t.verdict)] ?? 0) + 1;
      if (t.depth != null) depth[t.depth] = (depth[t.depth] ?? 0) + 1;
      if (t.verdict === null) pending.add(t.id);
      else if (t.verdict === "MANUAL") manual.add(t.id);
      else if (t.verdict === "NEEDS DYNAMIC") needsDynamic.add(t.id);
    }
  }
  if (Object.keys(depth).length > 0) counts.depth = depth;
  if (Object.keys(hardening).length > 0) counts.hardening = hardening;
  return {
    ...report,
    controls,
    counts,
    gaps: {
      pending: [...pending].sort(),
      manual: [...manual].sort(),
      needsDynamic: [...needsDynamic].sort(),
      outOfScope: report.gaps?.outOfScope ?? [],
    },
  };
}

/**
 * Sets each check's depth (ADR 0013) from who decided it and, for the
 * agent's answers, whether Ward served that check's text (`served`, IDs
 * as in the index). In code only: the agent can't claim a depth.
 */
export function markDepth(report: Report, served: ReadonlySet<string>): Report {
  const depthOf = (
    c: Report["controls"][number]["checks"][number],
  ): Depth | null => {
    if (c.verdict === null || c.by === null) return null;
    if (c.by === "analyzer") return "analyzer";
    if (c.by === "owasp") return "index";
    return served.has(c.id) ? "test text" : "title only";
  };
  return finalize({
    ...report,
    controls: report.controls.map((c) => ({
      ...c,
      checks: c.checks.map((t) => ({ ...t, depth: depthOf(t) })),
    })),
  });
}
