import { posix } from "node:path";
import type { Finding, FindingLocation } from "./findings.js";
import type {
  AppKind,
  KeyItem,
  ResolvedItem,
  ResolvedLocation,
} from "./key.js";
import { appFolderName } from "./paths.js";

/** A finding's lines may be this far from an anchor's lines and still match. */
export const LINE_WINDOW = 5;

export const handLabels = ["false-alarm", "real-unplanted", "generic"] as const;
export type HandLabel = (typeof handLabels)[number];

export interface GradeEntry {
  finding: number;
  title: string;
  candidates: string[];
  suggested: string | null;
  /** An item ID or a hand label. null until Karlo grades it. */
  label: string | null;
  note?: string | undefined;
}

export interface Grades {
  grades: GradeEntry[];
}

export type Outcome =
  | { kind: "issue" | "decoy"; items: string[]; how: "auto" | "hand" }
  | { kind: HandLabel; how: "hand" }
  | { kind: "ungraded"; candidates: string[]; suggested: string | null };

export interface FindingScore {
  index: number;
  title: string;
  outcome: Outcome;
}

export interface Tally {
  found: number;
  total: number;
}

export interface BadCitation {
  finding: number;
  file: string;
  line: number;
  why: "outside the app" | "no such file" | "line past the end";
}

export interface Score {
  app: AppKind;
  provisional: boolean;
  findings: number;
  ungraded: number;
  /** Planted app only. */
  issues?: {
    found: number;
    total: number;
    recall: number;
    missed: string[];
    byDifficulty: Record<string, Tally>;
    byMasvsGroup: Record<string, Tally>;
    byCategory: Record<string, Tally>;
  };
  duplicates: number;
  decoyHits: string[];
  falseAlarms: number;
  realUnplanted: number;
  generic: number;
  /**
   * Planted app: correct findings / (correct + false alarms), generic and
   * ungraded left out. null in the twin, where false alarms are the number.
   */
  precision: number | null;
  citations: { locations: number; bad: BadCitation[] };
  perFinding: FindingScore[];
}

/**
 * Turns a path the agent wrote into one relative to the app root, or null
 * when it points outside the app. Accepts "./x", "penny-jar/x" and absolute
 * paths into the temp copy.
 */
export function normalizePath(raw: string): string | null {
  let s = raw.trim().replaceAll("\\", "/");
  const marker = `/${appFolderName}/`;
  if (s.startsWith("/")) {
    const at = s.indexOf(marker);
    if (at === -1) return null;
    s = s.slice(at + marker.length);
  } else if (s.startsWith(`${appFolderName}/`)) {
    s = s.slice(appFolderName.length + 1);
  }
  s = posix.normalize(s);
  if (s === "." || s === ".." || s.startsWith("../") || posix.isAbsolute(s))
    return null;
  return s;
}

function isNear(loc: FindingLocation, anchor: ResolvedLocation): boolean {
  const end = loc.endLine ?? loc.line;
  return (
    end >= anchor.startLine - LINE_WINDOW &&
    loc.line <= anchor.endLine + LINE_WINDOW
  );
}

function sharesType(finding: Finding, item: KeyItem): boolean {
  return (
    finding.maswe.some((id) => item.maswe.includes(id)) ||
    finding.masvs.some((id) => item.masvs.includes(id))
  );
}

interface Match {
  auto: { kind: "issue" | "decoy"; items: string[] } | null;
  /** Items near the finding, or else items in the same files. */
  candidates: string[];
  /** Whether the candidates are near the finding, not just in its files. */
  near: boolean;
  /** A label to suggest for hand grading, when the match says more than the candidates. */
  suggested?: string;
}

/**
 * Location and type match one item at a location: automatic. Two items at
 * the same location is a tie; issues and decoys together is unclear. Both
 * go to hand grading, as does an automatic match with another issue nearby
 * that shares no ID (the finding may cover both). A finding citing several
 * locations can match a different item at each (a chain).
 */
export function matchFinding(
  finding: Finding,
  resolved: ResolvedItem[],
): Match {
  const auto = new Set<string>();
  const nearby = new Set<string>();
  const sameFile = new Set<string>();
  let tie = false;
  for (const loc of finding.locations) {
    const file = normalizePath(loc.file);
    if (file === null) continue;
    const here = new Set<string>();
    for (const { item, locations } of resolved) {
      for (const anchor of locations) {
        if (anchor.file !== file) continue;
        sameFile.add(item.id);
        if (!isNear(loc, anchor)) continue;
        nearby.add(item.id);
        if (sharesType(finding, item)) here.add(item.id);
      }
    }
    if (here.size > 1) tie = true;
    for (const id of here) auto.add(id);
  }
  const near = nearby.size > 0;
  const candidates = [...(near ? nearby : sameFile)];
  if (tie || auto.size === 0) return { auto: null, candidates, near };
  const items = resolved.filter((r) => auto.has(r.item.id)).map((r) => r.item);
  const decoys = items.filter((i) => i.decoy).length;
  if (decoys > 0 && decoys < items.length) {
    return { auto: null, candidates, near };
  }
  const issuesNearby = resolved
    .filter((r) => !r.item.decoy && nearby.has(r.item.id))
    .map((r) => r.item.id);
  if (decoys === 0 && issuesNearby.some((id) => !auto.has(id))) {
    // Suggest the part the scorer is sure of; Karlo adds the rest.
    return {
      auto: null,
      candidates,
      near,
      suggested: items.map((i) => i.id).join("+"),
    };
  }
  return {
    auto: {
      kind: decoys > 0 ? "decoy" : "issue",
      items: items.map((i) => i.id),
    },
    candidates,
    near,
  };
}

function suggest(app: AppKind, match: Match): string | null {
  if (match.suggested !== undefined) return match.suggested;
  if (match.near && match.candidates.length === 1) {
    return match.candidates[0] ?? null;
  }
  return app === "clean" ? "false-alarm" : null;
}

/** A hand label, or item IDs joined with "+" when a finding covers several. */
function outcomeFromLabel(label: string, resolved: ResolvedItem[]): Outcome {
  if ((handLabels as readonly string[]).includes(label)) {
    return { kind: label as HandLabel, how: "hand" };
  }
  const ids = label.split("+");
  const items = ids.map((id) => {
    const hit = resolved.find((r) => r.item.id === id);
    if (hit === undefined) {
      throw new Error(`grade label ${label}: ${id} is not an item in this app`);
    }
    return hit.item;
  });
  const decoys = items.filter((i) => i.decoy).length;
  if (decoys > 0 && decoys < items.length) {
    throw new Error(`grade label ${label} mixes issues and decoys`);
  }
  return { kind: decoys > 0 ? "decoy" : "issue", items: ids, how: "hand" };
}

export interface ScoreInput {
  app: AppKind;
  findings: Finding[];
  resolved: ResolvedItem[];
  /** Line count of every tracked file in the app, by path relative to its root. */
  lineCounts: ReadonlyMap<string, number>;
  grades: Grades;
}

/** Scores one run. Returns the score and the grades file with new entries added. */
export function score(input: ScoreInput): { score: Score; grades: Grades } {
  const { app, findings, resolved, lineCounts } = input;
  const byFinding = new Map(input.grades.grades.map((g) => [g.finding, g]));
  for (const g of input.grades.grades) {
    if (g.finding < 0 || g.finding >= findings.length) {
      throw new Error(
        `grade for finding ${String(g.finding)}, which doesn't exist`,
      );
    }
  }
  const newGrades: GradeEntry[] = [];

  const perFinding: FindingScore[] = findings.map((finding, index) => {
    const graded = byFinding.get(index);
    // A label wins over an automatic match, so Karlo can overrule one.
    if (graded?.label != null) {
      return {
        index,
        title: finding.title,
        outcome: outcomeFromLabel(graded.label, resolved),
      };
    }
    const match = matchFinding(finding, resolved);
    // In the twin only decoys can match automatically: every other finding
    // there needs a look before it counts as a false alarm.
    if (
      match.auto !== null &&
      (app === "planted" || match.auto.kind === "decoy")
    ) {
      return {
        index,
        title: finding.title,
        outcome: { ...match.auto, how: "auto" },
      };
    }
    const suggested = suggest(app, match);
    if (graded === undefined) {
      newGrades.push({
        finding: index,
        title: finding.title,
        candidates: match.candidates,
        suggested,
        label: null,
      });
    }
    return {
      index,
      title: finding.title,
      outcome: { kind: "ungraded", candidates: match.candidates, suggested },
    };
  });

  const found = new Set<string>();
  const decoyHits = new Set<string>();
  let duplicates = 0;
  let correct = 0;
  let falseAlarms = 0;
  let realUnplanted = 0;
  let generic = 0;
  let ungraded = 0;
  for (const { outcome } of perFinding) {
    switch (outcome.kind) {
      case "issue":
        correct++;
        if (outcome.items.every((id) => found.has(id))) duplicates++;
        for (const id of outcome.items) found.add(id);
        break;
      case "decoy":
        falseAlarms++;
        for (const id of outcome.items) decoyHits.add(id);
        break;
      case "false-alarm":
        falseAlarms++;
        break;
      case "real-unplanted":
        correct++;
        realUnplanted++;
        break;
      case "generic":
        generic++;
        break;
      case "ungraded":
        ungraded++;
        break;
    }
  }

  const bad: BadCitation[] = [];
  let locations = 0;
  findings.forEach((f, index) => {
    for (const loc of f.locations) {
      locations++;
      const file = normalizePath(loc.file);
      const lines = file === null ? undefined : lineCounts.get(file);
      const why =
        file === null
          ? "outside the app"
          : lines === undefined
            ? "no such file"
            : (loc.endLine ?? loc.line) > lines
              ? "line past the end"
              : null;
      if (why !== null)
        bad.push({ finding: index, file: loc.file, line: loc.line, why });
    }
  });

  const result: Score = {
    app,
    provisional: ungraded > 0,
    findings: findings.length,
    ungraded,
    duplicates,
    decoyHits: [...decoyHits].sort(),
    falseAlarms,
    realUnplanted,
    generic,
    precision:
      app === "planted" && correct + falseAlarms > 0
        ? correct / (correct + falseAlarms)
        : null,
    citations: { locations, bad },
    perFinding,
  };
  if (app === "planted") {
    const issues = resolved.map((r) => r.item).filter((i) => !i.decoy);
    result.issues = {
      found: issues.filter((i) => found.has(i.id)).length,
      total: issues.length,
      recall:
        issues.length > 0
          ? issues.filter((i) => found.has(i.id)).length / issues.length
          : 0,
      missed: issues.filter((i) => !found.has(i.id)).map((i) => i.id),
      byDifficulty: tally(issues, found, (i) => [i.difficulty ?? "unknown"]),
      byMasvsGroup: tally(issues, found, (i) => [
        ...new Set(i.masvs.map((c) => c.split("-")[1] ?? c)),
      ]),
      byCategory: tally(issues, found, (i) => [i.category]),
    };
  }
  return {
    score: result,
    grades: { grades: [...input.grades.grades, ...newGrades] },
  };
}

function tally(
  issues: KeyItem[],
  found: Set<string>,
  groups: (item: KeyItem) => string[],
): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  for (const item of issues) {
    for (const g of groups(item)) {
      const t = (out[g] ??= { found: 0, total: 0 });
      t.total++;
      if (found.has(item.id)) t.found++;
    }
  }
  return out;
}
