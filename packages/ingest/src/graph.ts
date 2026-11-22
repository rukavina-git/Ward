import type { KnowledgeRecord, LinkOverride, RecordLinks } from "@ward/core";
import type { Parsed } from "./parse.js";

export interface LinkResult {
  /** Sorted by ID, every link list sorted and without duplicates. */
  records: KnowledgeRecord[];
  /** The overrides used, sorted by test. */
  applied: LinkOverride[];
  problems: string[];
}

/**
 * Links parsed records into the graph: control → weakness → test → demo.
 *
 * MASTG v2.0.0 tests name MASWE beta IDs, and MASWE v1.0.0 renumbered them:
 * MASWE-0069 in a test is not MASWE-0069 today. So a test's weakness is
 * always translated through the weaknesses' `maswe-beta` lists, never
 * taken as is. A beta ID that translates to no weakness or to several
 * needs an override. Links are then stored both ways. Mutates the
 * records it's given.
 */
export function linkRecords(
  parsed: readonly Parsed[],
  overrides: readonly LinkOverride[],
): LinkResult {
  const problems: string[] = [];
  const byId = new Map<string, KnowledgeRecord>();
  for (const { record } of parsed) {
    if (byId.has(record.id)) problems.push(`${record.id} appears twice`);
    byId.set(record.id, record);
  }

  const fromBeta = new Map<string, string[]>();
  for (const p of parsed) {
    for (const beta of p.betaIds) {
      fromBeta.set(beta, [...(fromBeta.get(beta) ?? []), p.record.id]);
    }
  }

  const overrideFor = new Map(overrides.map((o) => [o.test, o]));
  const applied: LinkOverride[] = [];
  for (const p of parsed) {
    const named = p.namedWeakness;
    if (named === null) continue;
    const id = p.record.id;
    const override = overrideFor.get(id);
    overrideFor.delete(id);
    if (override) {
      if (override.named === named) {
        p.record.links.weaknesses = [...override.weaknesses];
        applied.push(override);
      } else {
        problems.push(
          `override for ${id} expects ${override.named}, but the test names ${named}: review it`,
        );
      }
      continue;
    }
    const found = fromBeta.get(named) ?? [];
    if (found.length === 1) p.record.links.weaknesses = [...found];
    else {
      const to =
        found.length === 0
          ? "no weakness"
          : [...found].sort(compare).join(", ");
      problems.push(
        `${id} names beta ${named}, which translates to ${to}: add an override`,
      );
    }
  }
  for (const unused of overrideFor.keys()) {
    problems.push(`override for ${unused} matches no test`);
  }

  // Reverse links. Deprecated tests point at controls directly and are
  // left out of control → weakness → test walks.
  const add = (id: string, list: keyof RecordLinks, target: string): void => {
    byId.get(id)?.links[list].push(target);
  };
  for (const { record: r } of parsed) {
    if (r.kind === "weakness") {
      for (const c of r.links.controls) add(c, "weaknesses", r.id);
    } else if (r.kind === "test" && r.status !== "deprecated") {
      for (const w of r.links.weaknesses) add(w, "tests", r.id);
    } else if (r.kind === "demo") {
      for (const t of r.links.tests) add(t, "demos", r.id);
    }
  }

  const records = [...byId.values()].sort((a, b) => compare(a.id, b.id));
  for (const r of records) {
    for (const list of Object.keys(r.links) as (keyof RecordLinks)[]) {
      r.links[list] = [...new Set(r.links[list])].sort(compare);
    }
  }
  applied.sort((a, b) => compare(a.test, b.test));
  return { records, applied, problems };
}

/** Plain code-unit order: the same on every machine and locale. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
