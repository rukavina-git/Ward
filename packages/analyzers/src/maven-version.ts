/**
 * Maven version order and OSV range matching, in plain code.
 *
 * The order follows Maven's ComparableVersion rules closely enough for
 * advisory ranges: versions split on `.`, `-` and digit/letter changes;
 * numbers compare as numbers; qualifiers rank
 * alpha < beta < milestone < rc < snapshot < (release) < sp < others;
 * trailing zeros and release words (`final`, `ga`, `release`) don't count.
 * Not every corner of ComparableVersion is copied (nested lists are
 * flattened); the tests pin the cases advisories use.
 */

interface Token {
  /** The separator before this token: `.` or `-` (a digit/letter change counts as `-`). */
  sep: "." | "-";
  value: bigint | string;
}

const QUALIFIERS = [
  "alpha",
  "beta",
  "milestone",
  "rc",
  "snapshot",
  "",
  "sp",
] as const;
const RELEASE_RANK = QUALIFIERS.indexOf("");

function alias(word: string, nextIsDigit: boolean): string {
  if (nextIsDigit) {
    if (word === "a") return "alpha";
    if (word === "b") return "beta";
    if (word === "m") return "milestone";
  }
  if (word === "cr") return "rc";
  if (word === "ga" || word === "final" || word === "release") return "";
  return word;
}

export function tokenize(version: string): Token[] {
  const v = version.trim().toLowerCase();
  const raw: { sep: "." | "-"; text: string }[] = [];
  let sep: "." | "-" = ".";
  let cur = "";
  const push = (next: "." | "-") => {
    raw.push({ sep, text: cur });
    cur = "";
    sep = next;
  };
  for (let i = 0; i < v.length; i++) {
    const c = v.charAt(i);
    if (c === "." || c === "-" || c === "_" || c === "+") {
      push(c === "." ? "." : "-");
      continue;
    }
    const prev = cur.charAt(cur.length - 1);
    if (cur !== "" && /\d/.test(prev) !== /\d/.test(c)) push("-");
    cur += c;
  }
  push(".");

  const tokens: Token[] = raw.map((t, i) => {
    if (/^\d+$/.test(t.text)) return { sep: t.sep, value: BigInt(t.text) };
    const next = raw[i + 1]?.text ?? "";
    return { sep: t.sep, value: alias(t.text, /^\d/.test(next)) };
  });

  // Drop "null" tokens (0 or a release word) at the end of each `-` part,
  // as Maven trims each list.
  const out: Token[] = [];
  const flush = (part: Token[]) => {
    while (part.length > 1 && isNull(part[part.length - 1])) part.pop();
    if (part.length === 1 && isNull(part[0]) && out.length > 0) return;
    out.push(...part);
  };
  let part: Token[] = [];
  for (const t of tokens) {
    if (t.sep === "-" && part.length > 0) {
      flush(part);
      part = [];
    }
    part.push(t);
  }
  flush(part);
  return out;
}

function isNull(t: Token | undefined): boolean {
  return t !== undefined && (t.value === 0n || t.value === "");
}

function qualifierRank(q: string): number {
  const i = (QUALIFIERS as readonly string[]).indexOf(q);
  return i === -1 ? QUALIFIERS.length : i;
}

function compareToken(a: Token | undefined, b: Token | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return -compareToken(b, undefined);
  if (b === undefined) {
    // Padding: a missing number is 0, a missing qualifier is "release".
    if (typeof a.value === "bigint") return a.value > 0n ? 1 : 0;
    return Math.sign(qualifierRank(a.value) - RELEASE_RANK);
  }
  if (a.sep !== b.sep) {
    // `1.1` > `1-1`: a dotted number beats a new `-` part; a dotted
    // qualifier loses to it.
    const dotted = a.sep === "." ? a : b;
    const sign = typeof dotted.value === "bigint" ? 1 : -1;
    return a.sep === "." ? sign : -sign;
  }
  if (typeof a.value === "bigint" && typeof b.value === "bigint") {
    return a.value === b.value ? 0 : a.value > b.value ? 1 : -1;
  }
  if (typeof a.value === "bigint") return 1;
  if (typeof b.value === "bigint") return -1;
  const ra = qualifierRank(a.value);
  const rb = qualifierRank(b.value);
  if (ra !== rb) return Math.sign(ra - rb);
  return a.value === b.value ? 0 : a.value < b.value ? -1 : 1;
}

/** Negative if a < b, 0 if equal, positive if a > b (Maven order). */
export function compareMaven(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
    const c = compareToken(ta[i], tb[i]);
    if (c !== 0) return c;
  }
  return 0;
}

/** One OSV range event, e.g. `{ introduced: "0" }` or `{ fixed: "2.8.9" }`. */
export type OsvEvent =
  | { introduced: string }
  | { fixed: string }
  | { last_affected: string }
  | { limit: string };

export interface OsvRange {
  type: string;
  events: OsvEvent[];
}

function eventVersion(e: OsvEvent): string {
  if ("introduced" in e) return e.introduced;
  if ("fixed" in e) return e.fixed;
  if ("last_affected" in e) return e.last_affected;
  return e.limit;
}

/**
 * Whether `version` falls in an OSV range (ECOSYSTEM or SEMVER, compared
 * with Maven order). Events are sorted, then walked: `introduced` opens,
 * `fixed` closes at that version, `last_affected` closes after it.
 */
export function inRange(version: string, range: OsvRange): boolean {
  const cmp = (e: OsvEvent) => {
    const ev = eventVersion(e);
    return "introduced" in e && ev === "0" ? 1 : compareMaven(version, ev);
  };
  const order = (e: OsvEvent) =>
    "introduced" in e && e.introduced === "0" ? "" : eventVersion(e);
  const events = range.events
    .filter((e) => !("limit" in e))
    .slice()
    .sort((x, y) => {
      const a = order(x);
      const b = order(y);
      if (a === "" || b === "") return a === b ? 0 : a === "" ? -1 : 1;
      return compareMaven(a, b);
    });
  let affected = false;
  for (const e of events) {
    const c = cmp(e);
    if ("introduced" in e) {
      if (c >= 0) affected = true;
    } else if ("fixed" in e) {
      if (c >= 0) affected = false;
    } else if ("last_affected" in e) {
      if (c > 0) affected = false;
    }
  }
  return affected;
}

/** Affected if listed in `versions` or inside any range. */
export function isAffected(
  version: string,
  affected: { ranges?: OsvRange[]; versions?: string[] },
): boolean {
  if (affected.versions?.includes(version)) return true;
  return (affected.ranges ?? []).some((r) => inRange(version, r));
}
