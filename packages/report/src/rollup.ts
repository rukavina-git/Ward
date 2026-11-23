/**
 * The strict rollup (ADR 0012): a control's verdict comes from its checks
 * in code, never from the model. The worst check wins, so NO FINDING
 * never covers a MANUAL or a NEEDS DYNAMIC.
 */
import { VERDICTS, type Control, type Report, type Verdict } from "./schema.js";

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
 */
export function rollupControl(
  control: Pick<Control, "checks">,
): Verdict | null {
  const decided: Verdict[] = [];
  let pending = false;
  for (const c of control.checks) {
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
  const counts = {
    controls: {} as Record<string, number>,
    checks: {} as Record<string, number>,
  };
  const pending = new Set<string>();
  const manual = new Set<string>();
  const needsDynamic = new Set<string>();
  for (const c of controls) {
    counts.controls[key(c.verdict)] =
      (counts.controls[key(c.verdict)] ?? 0) + 1;
    if (c.checks.length === 0) manual.add(c.id);
    for (const t of c.checks) {
      counts.checks[key(t.verdict)] = (counts.checks[key(t.verdict)] ?? 0) + 1;
      if (t.verdict === null) pending.add(t.id);
      else if (t.verdict === "MANUAL") manual.add(t.id);
      else if (t.verdict === "NEEDS DYNAMIC") needsDynamic.add(t.id);
    }
  }
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
