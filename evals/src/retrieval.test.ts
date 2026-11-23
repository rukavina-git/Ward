import { readFileSync } from "node:fs";
import {
  KnowledgeBase,
  loadIndex,
  TUNED_HYBRID,
  TUNED_SEARCH,
  type KnowledgeIndex,
} from "@ward/core";
import { describe, expect, it } from "vitest";
import { loadKey } from "./key.js";
import { keyPath, retrievalQueriesPath } from "./paths.js";
import {
  firstHit,
  idsRetriever,
  loadQuerySet,
  rankedRecords,
  runQuery,
  score,
  scoreSplit,
  type QueryResult,
  retrievers,
  type RetrievalQuery,
} from "./retrieval.js";
import { bm25Grid, hybridGrid, pickBest } from "./tune.js";

function q(expected: string[], patch: Partial<RetrievalQuery> = {}) {
  return {
    id: "RQ-01",
    split: "dev",
    origin: "finding",
    query: "anything",
    expected,
    ...patch,
  } satisfies RetrievalQuery;
}

function rankOf(expected: string[], ranking: string[]): number | null {
  return runQuery(q(expected), () => ranking).rank;
}

describe("scorer", () => {
  const ten = Array.from({ length: 10 }, (_, i) => `R${String(i + 1)}`);

  it("ranks the first expected record", () => {
    expect(rankOf(["R1"], ten)).toBe(1);
    expect(rankOf(["R5"], ten)).toBe(5);
    expect(rankOf(["R6"], ten)).toBe(6);
    expect(rankOf(["R7", "R3"], ten)).toBe(3);
    expect(rankOf(["X"], ten)).toBeNull();
  });

  it("collapses chunk IDs to records, first occurrence wins", () => {
    expect(rankedRecords(["A#0", "A#1", "B#0", "A", "C#2"])).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(rankOf(["C"], ["A#0", "A#1", "A#2", "B#0", "C#0"])).toBe(3);
    expect(firstHit(["A", "B"], [])).toBeNull();
  });

  it("scores recall@5 and MRR", () => {
    const r = (rank: number | null): QueryResult => ({
      id: "x",
      split: "dev",
      origin: "finding",
      rank,
      top: [],
      returned: 10,
    });
    // Ranks 1, 5, 6 (in MRR, not in recall@5), 11 (in neither), miss.
    const s = score([r(1), r(5), r(6), r(11), r(null)]);
    expect(s.queries).toBe(5);
    expect(s.recallAt5).toBe(0.4);
    expect(s.mrr).toBeCloseTo((1 + 1 / 5 + 1 / 6) / 5, 3);
    expect(score([])).toEqual({ queries: 0, recallAt5: 0, mrr: 0 });
  });

  it("scores none queries apart", () => {
    const answered = runQuery(q(["A"]), () => ["A"]);
    const quiet = runQuery(q([], { origin: "none" }), () => []);
    const noisy = runQuery(q([], { origin: "none" }), () => ["B"]);
    const s = scoreSplit([answered, quiet, noisy]);
    expect(s.all).toEqual({ queries: 1, recallAt5: 1, mrr: 1 });
    expect(s.byOrigin.finding?.queries).toBe(1);
    expect(s.none).toEqual({ queries: 2, returnedAny: 1 });
  });
});

describe("ids retriever", () => {
  const tiny = {
    records: [
      { id: "MASWE-0001", chunks: [] },
      { id: "MASTG-TEST-0039", chunks: [] },
      { id: "MASVS-PLATFORM-2", chunks: [] },
    ],
    chunks: [],
  } as unknown as KnowledgeIndex;
  const retrieve = idsRetriever(new KnowledgeBase(tiny));

  it("finds IDs in any case, inside sentences, in order", () => {
    expect(retrieve("see masvs-platform-2, then MASWE-0001.")).toEqual([
      "MASVS-PLATFORM-2",
      "MASWE-0001",
    ]);
    expect(retrieve("what did Mastg-Test-0039 check")).toEqual([
      "MASTG-TEST-0039",
    ]);
  });

  it("drops unknown IDs and plain text", () => {
    expect(retrieve("MASWE-9999 and MASTG-TEST-0001")).toEqual([]);
    expect(retrieve("MASTG-TSET-0039 typo")).toEqual([]);
    expect(retrieve("password in SharedPreferences")).toEqual([]);
  });
});

describe("query set", () => {
  const set = loadQuerySet(retrievalQueriesPath);
  const index = loadIndex();
  const records = new Map(index.records.map((r) => [r.id, r]));
  const key = loadKey(keyPath);
  const items = new Set(key.items.map((i) => i.id));

  it("has 140–170 queries with unique IDs and texts", () => {
    expect(set.queries.length).toBeGreaterThanOrEqual(140);
    expect(set.queries.length).toBeLessThanOrEqual(170);
    const ids = set.queries.map((x) => x.id);
    const texts = set.queries.map((x) => x.query.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("was written against the committed index's sources", () => {
    for (const s of index.sources) expect(set.index[s.name]).toBe(s.commit);
  });

  it("expects only IDs that exist and aren't placeholders", () => {
    for (const x of set.queries) {
      for (const id of x.expected) {
        const r = records.get(id);
        expect(r, `${x.id}: ${id}`).toBeDefined();
        expect(r?.status, `${x.id}: ${id}`).not.toBe("placeholder");
      }
    }
  });

  it("links real answer key items", () => {
    for (const x of set.queries) {
      if (x.item !== undefined) expect(items.has(x.item), x.id).toBe(true);
      if (x.origin === "finding" || x.origin === "missed") {
        expect(x.item, x.id).toBeDefined();
      }
    }
  });

  it("has every origin in both splits and none queries empty", () => {
    for (const split of ["dev", "test"]) {
      for (const origin of ["finding", "missed", "coverage", "id", "none"]) {
        const n = set.queries.filter(
          (x) => x.split === split && x.origin === origin,
        ).length;
        expect(n, `${split}/${origin}`).toBeGreaterThan(0);
      }
    }
    for (const x of set.queries) {
      expect(x.expected.length === 0, x.id).toBe(x.origin === "none");
    }
  });

  it("has at least 15 none and 25 coverage queries", () => {
    const count = (origin: string) =>
      set.queries.filter((x) => x.origin === origin).length;
    expect(count("none")).toBeGreaterThanOrEqual(15);
    expect(count("coverage")).toBeGreaterThanOrEqual(25);
  });

  it("expects an item's own MASWE and MASTG IDs for finding and missed", () => {
    // The key's schema drops mastg, so read the raw file.
    const raw = JSON.parse(readFileSync(keyPath, "utf8")) as {
      items: { id: string; maswe: string[]; mastg?: string[] }[];
    };
    const byId = new Map(raw.items.map((i) => [i.id, i]));
    for (const x of set.queries) {
      if (x.item === undefined) continue;
      const own = byId.get(x.item);
      const ids = [...(own?.maswe ?? []), ...(own?.mastg ?? [])];
      for (const id of ids) expect(x.expected, `${x.id}: ${id}`).toContain(id);
    }
  });

  it("aims coverage queries at a weakness no v1 query expects", () => {
    const v1 = new Set(
      set.queries
        .filter((x) => Number(x.id.slice(3)) < 50)
        .flatMap((x) => x.expected),
    );
    for (const x of set.queries.filter((y) => y.origin === "coverage")) {
      const weakness = x.expected[0] ?? "";
      expect(weakness, x.id).toMatch(/^MASWE-\d{4}$/);
      expect(v1.has(weakness), x.id).toBe(false);
    }
  });

  it("keeps each coverage weakness in one split", () => {
    const splitOf = new Map<string, string>();
    for (const x of set.queries.filter((y) => y.origin === "coverage")) {
      const w = x.expected[0] ?? "";
      const seen = splitOf.get(w);
      if (seen !== undefined) expect(x.split, `${x.id} ${w}`).toBe(seen);
      splitOf.set(w, x.split);
    }
  });

  it("keeps each answer key item in one split", () => {
    const splitOf = new Map<string, string>();
    for (const x of set.queries) {
      if (x.item === undefined) continue;
      const seen = splitOf.get(x.item);
      if (seen !== undefined) expect(x.split, `${x.id} ${x.item}`).toBe(seen);
      splitOf.set(x.item, x.split);
    }
  });
});

describe("bm25 retrievers", () => {
  it("are registered next to ids", () => {
    expect(Object.keys(retrievers)).toEqual([
      "ids",
      "bm25",
      "bm25-tuned",
      "vectors",
      "hybrid",
      "hybrid-tuned",
    ]);
  });

  it("hybrid grid starts at textbook RRF and holds the tuned settings", () => {
    const grid = hybridGrid();
    expect(grid).toHaveLength(18);
    expect(grid[0]).toEqual({ queryInstruction: true, k: 60, vectorWeight: 1 });
    expect(grid).toContainEqual({ ...TUNED_HYBRID });
  });

  it("tuned settings are in the grid, and the grid starts at the defaults", () => {
    const grid = bm25Grid();
    expect(grid).toHaveLength(432);
    expect(grid[0]).toEqual({
      k1: 1.2,
      b: 0.75,
      stopwords: false,
      stem: false,
      titleWeight: 1,
      codeWeight: 1,
    });
    expect(grid).toContainEqual(TUNED_SEARCH);
  });

  it("picks by MRR, then recall@5, then grid order", () => {
    const row = (mrr: number, recallAt5: number, name: string) => ({
      name,
      dev: { queries: 1, mrr, recallAt5 },
    });
    const picked = pickBest([
      row(0.5, 0.9, "a"),
      row(0.6, 0.5, "b"),
      row(0.6, 0.8, "c"),
      row(0.6, 0.8, "d"),
    ]);
    expect(picked.map((r) => r.name)).toEqual(["c", "d", "b", "a"]);
  });

  it("keep id queries on top over the real index", async () => {
    const kb = new KnowledgeBase(loadIndex());
    for (const name of ["bm25", "bm25-tuned"]) {
      const retrieve = await retrievers[name]?.(kb, []);
      expect(retrieve?.("is MASWE-0006 relevant to logs?")[0]).toBe(
        "MASWE-0006#0",
      );
    }
  });
});
