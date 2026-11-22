import type { AppKind } from "./key.js";

/**
 * Pre-registered in step 04, before any baseline run: ADR 0001's "Claude Code
 * alone already finds almost everything" means `alone` averages at least
 * this many of the planted issues...
 */
export const REVISIT_MIN_FOUND = 21;
/** ...with at most this many false alarms in every twin run. */
export const REVISIT_MAX_TWIN_FALSE_ALARMS = 1;

/** What the summary needs from one run's meta.json and score.json. */
export interface RunRecord {
  name: string;
  setup: string;
  app: AppKind;
  trial: number;
  failed: boolean;
  model: string;
  claudeCodeVersion: string;
  wallMs: number;
  tokens: number | null;
  apiUsd: number | null;
  /** The arm's plugin name, null for an arm without one. */
  plugin: string | null;
  skillsInvoked: string[];
  /** null when the run failed or hasn't been scored. */
  score: {
    provisional: boolean;
    findings: number;
    falseAlarms: number;
    decoyHits: string[];
    realUnplanted: number;
    generic: number;
    duplicates: number;
    precision: number | null;
    citations: { locations: number; bad: number };
    issues?: { found: number; total: number; missed: string[] } | undefined;
  } | null;
}

export interface Stats {
  mean: number;
  min: number;
  max: number;
  n: number;
}

export function stats(values: number[]): Stats | null {
  if (values.length === 0) return null;
  return {
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    n: values.length,
  };
}

export interface Cell {
  setup: string;
  app: AppKind;
  /** Scored runs that count. */
  trials: number;
  /** Failed attempts, kept and counted, never scored. */
  failed: number;
  /** Scored runs with ungraded findings. */
  provisional: number;
  issuesTotal: number | null;
  found: Stats | null;
  /** Missed issues / all issues: the headline for the planted app. */
  falsePassRate: Stats | null;
  precision: Stats | null;
  falseAlarms: Stats | null;
  realUnplanted: Stats | null;
  /** Bad citations / cited locations: the other headline. */
  badCitationRate: Stats | null;
  /** Decoy ID → runs that flagged it. */
  decoyHits: Record<string, number>;
  /** Issue ID → runs that missed it (planted app). */
  missedBy: Record<string, number>;
  /** Runs that invoked the arm's own skill; null for an arm without a plugin. */
  skillUsed: number | null;
  minutes: Stats | null;
  tokens: Stats | null;
  apiUsd: Stats | null;
}

export interface Summary {
  models: string[];
  claudeCodeVersions: string[];
  cells: Cell[];
  /** Issues no scored run of any arm found. */
  neverFound: string[];
  revisit: { triggered: boolean; why: string } | null;
}

function num(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === "number");
}

function cell(setup: string, app: AppKind, runs: RunRecord[]): Cell {
  const scored = runs.filter((r) => !r.failed && r.score !== null);
  const s = scored.map((r) => r.score).filter((x) => x !== null);
  const issues = s.map((x) => x.issues).filter((x) => x !== undefined);
  const decoyHits: Record<string, number> = {};
  for (const x of s)
    for (const id of x.decoyHits) decoyHits[id] = (decoyHits[id] ?? 0) + 1;
  const missedBy: Record<string, number> = {};
  for (const x of issues)
    for (const id of x.missed) missedBy[id] = (missedBy[id] ?? 0) + 1;
  const plugin = runs.find((r) => r.plugin !== null)?.plugin ?? null;
  return {
    setup,
    app,
    trials: scored.length,
    failed: runs.filter((r) => r.failed).length,
    provisional: s.filter((x) => x.provisional).length,
    issuesTotal: issues[0]?.total ?? null,
    found: stats(issues.map((x) => x.found)),
    falsePassRate: stats(
      issues.map((x) => (x.total > 0 ? (x.total - x.found) / x.total : 0)),
    ),
    precision: stats(num(s.map((x) => x.precision))),
    falseAlarms: stats(s.map((x) => x.falseAlarms)),
    realUnplanted: stats(s.map((x) => x.realUnplanted)),
    badCitationRate: stats(
      s.map((x) =>
        x.citations.locations > 0 ? x.citations.bad / x.citations.locations : 0,
      ),
    ),
    decoyHits,
    missedBy,
    skillUsed:
      plugin === null
        ? null
        : scored.filter((r) =>
            r.skillsInvoked.some((k) => k.startsWith(`${plugin}:`)),
          ).length,
    minutes: stats(scored.map((r) => r.wallMs / 60_000)),
    tokens: stats(num(scored.map((r) => r.tokens))),
    apiUsd: stats(num(scored.map((r) => r.apiUsd))),
  };
}

/** Groups runs by arm and app, in the order the arms are given. */
export function summarize(runs: RunRecord[], arms: string[]): Summary {
  const seen = new Set<string>();
  for (const r of runs) {
    if (r.failed || r.score === null) continue;
    const k = `${r.setup}/${r.app}/${String(r.trial)}`;
    if (seen.has(k)) throw new Error(`two scored runs for ${k}`);
    seen.add(k);
  }
  const cells: Cell[] = [];
  for (const setup of arms) {
    for (const app of ["planted", "clean"] as const) {
      const mine = runs.filter((r) => r.setup === setup && r.app === app);
      if (mine.length > 0) cells.push(cell(setup, app, mine));
    }
  }
  const planted = cells.filter((c) => c.app === "planted" && c.trials > 0);
  const allMissed = planted.flatMap((c) =>
    Object.entries(c.missedBy)
      .filter(([, n]) => n === c.trials)
      .map(([id]) => id),
  );
  const neverFound = [...new Set(allMissed)]
    .filter((id) => planted.every((c) => c.missedBy[id] === c.trials))
    .sort();

  const alonePlanted = cells.find(
    (c) => c.setup === "alone" && c.app === "planted",
  );
  const aloneClean = runs.filter(
    (r) => r.setup === "alone" && r.app === "clean" && r.score !== null,
  );
  let revisit: Summary["revisit"] = null;
  if (alonePlanted?.found && aloneClean.length > 0) {
    const worstTwin = Math.max(
      ...aloneClean.map((r) => r.score?.falseAlarms ?? 0),
    );
    const triggered =
      alonePlanted.found.mean >= REVISIT_MIN_FOUND &&
      worstTwin <= REVISIT_MAX_TWIN_FALSE_ALARMS;
    revisit = {
      triggered,
      why:
        `alone found ${alonePlanted.found.mean.toFixed(1)} on average (bar: ${String(REVISIT_MIN_FOUND)}),` +
        ` worst twin run ${String(worstTwin)} false alarms (bar: ${String(REVISIT_MAX_TWIN_FALSE_ALARMS)})`,
    };
  }
  return {
    models: [...new Set(runs.map((r) => r.model))].sort(),
    claudeCodeVersions: [
      ...new Set(runs.map((r) => r.claudeCodeVersion)),
    ].sort(),
    cells,
    neverFound,
    revisit,
  };
}

function fmt(s: Stats | null, digits = 1, scale = 1): string {
  if (s === null) return "–";
  const f = (v: number) => (v * scale).toFixed(digits);
  return s.min === s.max ? f(s.mean) : `${f(s.mean)} (${f(s.min)}–${f(s.max)})`;
}

const pct = (s: Stats | null) => (s === null ? "–" : `${fmt(s, 0, 100)}%`);

function row(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

/** The generated part of baseline.md: tables only, no interpretation. */
export function renderTables(summary: Summary): string {
  const out: string[] = [];
  out.push(
    `Model: ${summary.models.join(", ")}. Claude Code: ${summary.claudeCodeVersions.join(", ")}.` +
      " Mean, then (min–max) across trials. $ is the API-equivalent Claude Code reports; runs were on the plan, not billed.",
    "",
  );
  const planted = summary.cells.filter((c) => c.app === "planted");
  const clean = summary.cells.filter((c) => c.app === "clean");
  const skill = (c: Cell) =>
    c.skillUsed === null ? "–" : `${String(c.skillUsed)}/${String(c.trials)}`;
  const runs = (c: Cell) =>
    `${String(c.trials)}${c.failed > 0 ? ` (+${String(c.failed)} failed)` : ""}${c.provisional > 0 ? ` ⚠ ${String(c.provisional)} provisional` : ""}`;

  out.push("### Planted app", "");
  out.push(
    row([
      "Arm",
      "Runs",
      `Found /${String(planted[0]?.issuesTotal ?? "?")}`,
      "False-pass rate",
      "Bad citations",
      "Precision",
      "False alarms",
      "Skill used",
      "Minutes",
      "Tokens (k)",
      "$ (API-eq.)",
    ]),
    row(Array<string>(11).fill("---")),
  );
  for (const c of planted) {
    out.push(
      row([
        c.setup,
        runs(c),
        fmt(c.found),
        pct(c.falsePassRate),
        pct(c.badCitationRate),
        pct(c.precision),
        fmt(c.falseAlarms),
        skill(c),
        fmt(c.minutes),
        fmt(c.tokens, 0, 1 / 1000),
        fmt(c.apiUsd, 2),
      ]),
    );
  }

  out.push("", "### Clean twin", "");
  out.push(
    row([
      "Arm",
      "Runs",
      "False alarms",
      "Decoy hits",
      "Real unplanted",
      "Bad citations",
      "Skill used",
      "Minutes",
    ]),
    row(Array<string>(8).fill("---")),
  );
  for (const c of clean) {
    const decoys = Object.entries(c.decoyHits)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) => `${id}×${String(n)}`)
      .join(", ");
    out.push(
      row([
        c.setup,
        runs(c),
        fmt(c.falseAlarms),
        decoys || "none",
        fmt(c.realUnplanted),
        pct(c.badCitationRate),
        skill(c),
        fmt(c.minutes),
      ]),
    );
  }

  const ids = [
    ...new Set(planted.flatMap((c) => Object.keys(c.missedBy))),
  ].sort();
  out.push(
    "",
    "### Misses on the planted app (runs that missed each issue)",
    "",
  );
  if (ids.length === 0) {
    out.push("None.");
  } else {
    out.push(
      row(["Issue", ...planted.map((c) => c.setup)]),
      row(Array<string>(planted.length + 1).fill("---")),
    );
    for (const id of ids) {
      out.push(
        row([
          id,
          ...planted.map(
            (c) => `${String(c.missedBy[id] ?? 0)}/${String(c.trials)}`,
          ),
        ]),
      );
    }
  }
  out.push(
    "",
    `Never found by any arm: ${summary.neverFound.join(", ") || "none"}.`,
  );
  if (summary.revisit) {
    out.push(
      `ADR 0001 revisit (pre-registered bar): ${summary.revisit.triggered ? "TRIGGERED" : "not triggered"}; ${summary.revisit.why}.`,
    );
  }
  return out.join("\n");
}

export const START =
  "<!-- summary:start (generated by npm run eval:summary) -->";
export const END = "<!-- summary:end -->";

/** Puts freshly generated tables into baseline.md, keeping the hand-written note. */
export function spliceTables(existing: string | null, tables: string): string {
  const block = `${START}\n${tables}\n${END}`;
  if (existing === null) {
    return [
      "# Baseline: example app",
      "",
      "What Claude Code catches before Ward exists. Plan 2, step 04.",
      "",
      block,
      "",
      "## What it means for Ward",
      "",
      "(To write once every run is graded.)",
      "",
    ].join("\n");
  }
  const a = existing.indexOf(START);
  const b = existing.indexOf(END);
  if (a === -1 || b === -1 || b < a)
    throw new Error("baseline.md has lost its summary markers");
  return existing.slice(0, a) + block + existing.slice(b + END.length);
}
