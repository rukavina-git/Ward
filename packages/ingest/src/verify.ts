import type { KnowledgeRecord, RecordKind, RecordLinks } from "@ward/core";
import { z } from "zod";
import type { Counts } from "./sources.js";

export function countRecords(records: readonly KnowledgeRecord[]): Counts {
  const counts: Counts = {};
  for (const r of records) {
    const byStatus = (counts[r.kind] ??= {});
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  return counts;
}

/** Every kind and status in either table must have the same count in both. */
export function checkCounts(
  records: readonly KnowledgeRecord[],
  expected: Counts,
): string[] {
  const actual = countRecords(records);
  const problems: string[] = [];
  const kinds = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const kind of kinds as Set<RecordKind>) {
    const want = expected[kind] ?? {};
    const got = actual[kind] ?? {};
    const statuses = new Set([...Object.keys(want), ...Object.keys(got)]);
    for (const status of statuses as Set<keyof typeof got>) {
      const w = want[status] ?? 0;
      const g = got[status] ?? 0;
      if (w !== g)
        problems.push(
          `expected ${String(w)} ${status} ${kind}s, got ${String(g)}`,
        );
    }
  }
  return problems;
}

const targetKind: Record<keyof RecordLinks, RecordKind> = {
  controls: "control",
  weaknesses: "weakness",
  tests: "test",
  demos: "demo",
  coveredBy: "test",
};

/**
 * The graph is whole: every link points at an existing record of the right
 * kind, every v2 test has a weakness, every weakness a control, every demo
 * exactly one test.
 */
export function checkLinks(records: readonly KnowledgeRecord[]): string[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  const problems: string[] = [];
  for (const r of records) {
    for (const list of Object.keys(targetKind) as (keyof RecordLinks)[]) {
      for (const id of r.links[list]) {
        const target = byId.get(id);
        if (!target) problems.push(`${r.id} links to missing ${id}`);
        else if (target.kind !== targetKind[list]) {
          problems.push(`${r.id} lists ${id} under ${list}`);
        }
      }
    }
    if (r.kind === "test" && r.status !== "deprecated") {
      if (r.links.weaknesses.length === 0) {
        problems.push(`${r.id} links to no weakness`);
      }
    }
    if (r.kind === "weakness" && r.links.controls.length === 0) {
      problems.push(`${r.id} links to no control`);
    }
    if (r.kind === "demo" && r.links.tests.length !== 1) {
      problems.push(
        `${r.id} links to ${String(r.links.tests.length)} tests, not 1`,
      );
    }
  }
  return problems;
}

const keySchema = z.object({
  items: z.array(
    z.looseObject({
      id: z.string(),
      decoy: z.boolean().optional(),
      masvs: z.array(z.string()).optional(),
      maswe: z.array(z.string()).optional(),
      mastg: z.array(z.string()).optional(),
    }),
  ),
});

/**
 * Plan 2's answer key names, per planted issue, a MASTG test, its MASWE
 * weakness and MASVS control, all checked by hand. Each test there must
 * reach one of the issue's weaknesses, and that weakness one of its
 * controls, in the graph.
 */
export function checkKnownMappings(
  records: readonly KnowledgeRecord[],
  key: unknown,
): { issues: number; problems: string[] } {
  const byId = new Map(records.map((r) => [r.id, r]));
  const { items } = keySchema.parse(key);
  const problems: string[] = [];
  let issues = 0;
  for (const item of items) {
    if (item.decoy || !item.mastg?.length) continue;
    issues++;
    const maswe = item.maswe ?? [];
    const masvs = item.masvs ?? [];
    for (const testId of item.mastg) {
      const test = byId.get(testId);
      const ok = test?.links.weaknesses.some(
        (w) =>
          maswe.includes(w) &&
          byId.get(w)?.links.controls.some((c) => masvs.includes(c)),
      );
      if (!ok) {
        const got = test
          ? test.links.weaknesses.join(", ") || "none"
          : "missing";
        problems.push(
          `${item.id}: ${testId} should reach ${maswe.join("/")} → ${masvs.join("/")}, graph has ${got}`,
        );
      }
    }
  }
  return { issues, problems };
}
