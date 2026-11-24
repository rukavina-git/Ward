import type { KnowledgeBase } from "@ward/core";
import type { Findings } from "./findings.js";
import type { HeldOutCase } from "./held-out.js";

// Scoring for the held-out gate (plan 4, step 02), the way
// evals/held-out-bar.md says. The scorer only proposes; a case, a decoy
// hit or a citation counts once Karlo sets its `label`. Until then the
// proposal stands in and the result is marked provisional.

/** How far (in lines) a finding may sit from an anchor or decoy and still match. */
export const LINE_SLACK = 10;

type Finding = Findings["findings"][number];
interface Place {
  file: string;
  lines: [number, number];
}

function near(f: Finding, places: readonly Place[], anyLine: boolean): boolean {
  return f.locations.some((l) =>
    places.some(
      (p) =>
        p.file === l.file &&
        (anyLine ||
          // The finding's lines overlap the place, give or take LINE_SLACK.
          (l.line <= p.lines[1] + LINE_SLACK &&
            (l.endLine ?? l.line) >= p.lines[0] - LINE_SLACK)),
    ),
  );
}

/** Findings that may be the case: in an anchor file within LINE_SLACK lines; for absences, anywhere in an anchor file. */
export function candidateFindings(c: HeldOutCase, fs: Findings): number[] {
  const anyLine = c.kind === "absence";
  return fs.findings.flatMap((f, i) =>
    near(f, c.anchors, anyLine) ? [i] : [],
  );
}

/** Findings that sit on a decoy. */
export function decoyFindings(c: HeldOutCase, fs: Findings): number[] {
  return fs.findings.flatMap((f, i) => (near(f, c.decoys, false) ? [i] : []));
}

export type CaseLabel = "found" | "missed";
export type CitationLabel = "right" | "wrong";
export type OtherLabel = "real" | "defensible" | "wrong";

export interface Labelled<T> {
  proposed: T | null;
  proposedWhy?: string;
  /** Karlo's call. Overrides `proposed`. */
  label: T | null;
}

export interface CitationGrade extends Labelled<CitationLabel> {
  finding: number;
  id: string;
  exists: boolean;
  /** The ID's title in Ward's pinned index, so the label can be checked. */
  indexTitle: string | null;
}

export interface FindingGrade extends Labelled<OtherLabel> {
  finding: number;
  title: string;
  where: string[];
  /** `case`: may be the labelled issue; `decoy`: on a decoy; `other`: anything else. */
  role: "case" | "decoy" | "other";
}

export interface RunGrades {
  run: string;
  case: string;
  kind: HeldOutCase["kind"];
  found: Labelled<CaseLabel> & { candidates: number[] };
  decoysFlagged: Labelled<number> & { candidates: number[] };
  findings: FindingGrade[];
  citations: CitationGrade[];
}

function keep<T>(
  fresh: Labelled<T>,
  old: Labelled<T> | undefined,
): Labelled<T> {
  if (old === undefined) return fresh;
  return {
    proposed: old.proposed ?? fresh.proposed,
    ...(old.proposedWhy !== undefined || fresh.proposedWhy !== undefined
      ? { proposedWhy: old.proposedWhy ?? fresh.proposedWhy }
      : {}),
    label: old.label,
  };
}

/** Grades for one run. Labels and hand proposals in `previous` are kept. */
export function buildGrades(
  run: string,
  c: HeldOutCase,
  fs: Findings,
  kb: KnowledgeBase,
  previous?: RunGrades,
): RunGrades {
  const cand = candidateFindings(c, fs);
  const decoys = decoyFindings(c, fs);
  const findings = fs.findings.map((f, i): FindingGrade => {
    const role = cand.includes(i)
      ? "case"
      : decoys.includes(i)
        ? "decoy"
        : "other";
    const old = previous?.findings.find((g) => g.finding === i);
    return {
      finding: i,
      title: f.title,
      where: f.locations.map(
        (l) =>
          `${l.file}:${String(l.line)}${l.endLine === undefined ? "" : `-${String(l.endLine)}`}`,
      ),
      role,
      ...keep<OtherLabel>({ proposed: null, label: null }, old),
    };
  });
  const citations = fs.findings.flatMap((f, i) =>
    [...f.masvs, ...f.maswe].map((id): CitationGrade => {
      const hit = kb.get(id);
      const old = previous?.citations.find(
        (g) => g.finding === i && g.id === id,
      );
      const fresh: Labelled<CitationLabel> =
        hit === undefined
          ? { proposed: "wrong", proposedWhy: "not in the index", label: null }
          : { proposed: null, label: null };
      return {
        finding: i,
        id,
        exists: hit !== undefined,
        indexTitle: hit?.record.title ?? null,
        ...keep(fresh, old),
      };
    }),
  );
  return {
    run,
    case: c.id,
    kind: c.kind,
    found: {
      candidates: cand,
      ...keep<CaseLabel>(
        { proposed: cand.length > 0 ? "found" : "missed", label: null },
        previous?.found,
      ),
    },
    decoysFlagged: {
      candidates: decoys,
      ...keep<number>(
        { proposed: decoys.length, label: null },
        previous?.decoysFlagged,
      ),
    },
    findings,
    citations,
  };
}

function value<T>(l: Labelled<T>): T | null {
  return l.label ?? l.proposed;
}

function unlabelled(l: Labelled<unknown>): boolean {
  return l.label === null;
}

export interface GateTally {
  runs: number;
  found: string[];
  missed: string[];
  harderMissed: string[];
  decoysFlagged: number;
  wrongCitations: number;
  citations: number;
  /** Citations with neither a label nor a proposal. */
  citationsUngraded: number;
  other: Record<OtherLabel | "ungraded", number>;
  /** True while any label is still missing. */
  provisional: boolean;
}

export function tally(grades: readonly RunGrades[]): GateTally {
  const t: GateTally = {
    runs: grades.length,
    found: [],
    missed: [],
    harderMissed: [],
    decoysFlagged: 0,
    wrongCitations: 0,
    citations: 0,
    citationsUngraded: 0,
    other: { real: 0, defensible: 0, wrong: 0, ungraded: 0 },
    provisional: false,
  };
  for (const g of grades) {
    if (value(g.found) === "found") t.found.push(g.case);
    else {
      t.missed.push(g.case);
      if (g.kind !== "code") t.harderMissed.push(g.case);
    }
    t.decoysFlagged += value(g.decoysFlagged) ?? 0;
    if (unlabelled(g.found) || unlabelled(g.decoysFlagged))
      t.provisional = true;
    for (const c of g.citations) {
      t.citations++;
      const v = value(c);
      if (v === "wrong") t.wrongCitations++;
      if (v === null) t.citationsUngraded++;
      if (unlabelled(c)) t.provisional = true;
    }
    for (const f of g.findings) {
      if (f.role !== "other") continue;
      const v = value(f);
      // Reported apart, not part of the bar, so not needed to finish.
      t.other[v ?? "ungraded"]++;
    }
  }
  return t;
}

export type GateOutcome = "room" | "rethink" | "in between";

/** evals/held-out-bar.md, "What the result means" (minimal gate, 10 cases). */
export function barOutcome(t: {
  found: number;
  harderMissed: number;
  decoysFlagged: number;
  wrongCitations: number;
}): { outcome: GateOutcome; reasons: string[] } {
  const room: string[] = [];
  if (t.found <= 7) room.push(`found ${String(t.found)} of 10 (7 or fewer)`);
  if (t.harderMissed >= 2)
    room.push(`missed ${String(t.harderMissed)} harder-kind cases (2 or more)`);
  if (t.wrongCitations >= 2)
    room.push(`${String(t.wrongCitations)} wrong citations (2 or more)`);
  // "If both fire, room wins": room is checked first.
  if (room.length > 0) return { outcome: "room", reasons: room };
  const rethink =
    t.found >= 9 &&
    t.harderMissed === 0 &&
    t.decoysFlagged <= 1 &&
    t.wrongCitations <= 1;
  if (rethink)
    return { outcome: "rethink", reasons: ["every Rethink rule holds"] };
  return {
    outcome: "in between",
    reasons: ["no room rule fires, but not every Rethink rule holds"],
  };
}
