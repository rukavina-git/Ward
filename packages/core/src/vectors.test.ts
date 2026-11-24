import { describe, expect, it } from "vitest";
import type { Chunk, IndexRecord, KnowledgeIndex } from "./index-file.js";
import { KnowledgeBase } from "./lookup.js";
import type { RecordStatus } from "./records.js";
import {
  dot,
  hybridSearch,
  reciprocalRankFusion,
  vectorSearch,
  VectorSearch,
} from "./vectors.js";

function chunk(
  record: string,
  text: string,
  status: RecordStatus = "active",
): Chunk {
  return {
    id: `${record}#0`,
    record,
    kind: "weakness",
    status,
    section: [],
    text,
    url: "",
    version: "",
    licence: "",
  };
}

function record(c: Chunk): IndexRecord {
  return {
    id: c.record,
    kind: "weakness",
    title: c.record,
    status: c.status,
    fields: {},
    links: {
      controls: [],
      weaknesses: [],
      tests: [],
      demos: [],
      coveredBy: [],
    },
    source: {
      name: "",
      version: "",
      commit: "",
      path: "",
      url: "",
      licence: "",
    },
    chunks: [c.id],
  };
}

// Four 2-d unit vectors. MASWE-0004 is a placeholder.
const chunks = [
  chunk("MASWE-0001", "cleartext traffic over http"),
  chunk("MASWE-0002", "keys hardcoded in source"),
  chunk("MASWE-0003", "logs leak tokens"),
  chunk("MASWE-0004", "placeholder", "placeholder"),
];
const vectors = new Float32Array([1, 0, 0, 1, 0.6, 0.8, 1, 0]);
const index: KnowledgeIndex = {
  format: 1,
  sources: [],
  overrides: [],
  embedding: null,
  records: chunks.map(record),
  chunks,
};
const kb = new KnowledgeBase(index);
const vs = new VectorSearch(chunks, vectors, 2);

describe("dot", () => {
  it("multiplies and sums, from an offset", () => {
    expect(dot(new Float32Array([1, 2]), new Float32Array([9, 3, 4]), 1)).toBe(
      11,
    );
  });
});

describe("VectorSearch", () => {
  it("ranks by cosine and skips placeholders", () => {
    const hits = vs.search(new Float32Array([1, 0]));
    expect(hits.map((h) => h.record)).toEqual([
      "MASWE-0001",
      "MASWE-0003",
      "MASWE-0002",
    ]);
    expect(hits[1]?.score).toBeCloseTo(0.6);
  });

  it("breaks ties by chunk ID", () => {
    const tied = new VectorSearch(
      [chunk("MASWE-0009", "b"), chunk("MASWE-0008", "a")],
      new Float32Array([1, 0, 1, 0]),
      2,
    );
    expect(tied.search(new Float32Array([1, 0])).map((h) => h.chunk)).toEqual([
      "MASWE-0008#0",
      "MASWE-0009#0",
    ]);
  });

  it("finds nothing for a zero vector, honours the limit", () => {
    expect(vs.search(new Float32Array([0, 0]))).toEqual([]);
    expect(vs.search(new Float32Array([0, 1]), 1)).toHaveLength(1);
  });

  it("refuses vectors that don't fit the chunks or the query", () => {
    expect(() => new VectorSearch(chunks, new Float32Array(7), 2)).toThrow();
    expect(() => vs.search(new Float32Array(3))).toThrow();
  });
});

describe("reciprocalRankFusion", () => {
  it("sums weight / (k + rank) across lists", () => {
    const fused = reciprocalRankFusion(
      [{ ids: ["a", "b"] }, { ids: ["b", "c"], weight: 2 }],
      10,
    );
    // a: 1/11; b: 1/12 + 2/11; c: 2/12.
    expect(fused.map((f) => f.id)).toEqual(["b", "c", "a"]);
    expect(fused[0]?.score).toBeCloseTo(1 / 12 + 2 / 11);
    expect(fused[1]?.score).toBeCloseTo(2 / 12);
    expect(fused[2]?.score).toBeCloseTo(1 / 11);
  });

  it("breaks ties by ID", () => {
    const fused = reciprocalRankFusion([{ ids: ["y"] }, { ids: ["x"] }], 60);
    expect(fused.map((f) => f.id)).toEqual(["x", "y"]);
  });
});

describe("vectorSearch and hybridSearch", () => {
  const q = new Float32Array([0, 1]);

  it("put named IDs first, once", () => {
    const v = vectorSearch(kb, vs, "what is MASWE-0003?", q);
    expect(v[0]).toBe("MASWE-0003#0");
    expect(v.filter((id) => id === "MASWE-0003#0")).toHaveLength(1);
    const h = hybridSearch(kb, vs, "MASWE-0003 tokens", q, {
      k: 60,
      vectorWeight: 1,
      bm25: {},
    });
    expect(h[0]).toBe("MASWE-0003#0");
    expect(new Set(h).size).toBe(h.length);
  });

  it("fuse keyword and vector rankings", () => {
    // BM25 alone finds only MASWE-0001 ("http"); vectors put MASWE-0002 first.
    const h = hybridSearch(kb, vs, "http", q, {
      k: 1,
      vectorWeight: 1,
      bm25: {},
    });
    // MASWE-0001: BM25 rank 1 (1/2) + vector rank 3 (1/4) beats MASWE-0002's 1/2.
    expect(h.slice(0, 2)).toEqual(["MASWE-0001#0", "MASWE-0002#0"]);
    expect(h).not.toContain("MASWE-0004#0");
  });
});
