import { readFileSync } from "node:fs";
import {
  idPattern,
  TUNED_HYBRID,
  TUNED_SEARCH,
  type KnowledgeBase,
  type SearchOptions,
} from "@ward/core";
import { z } from "zod";
import {
  hybridRetriever,
  loadVectorContext,
  vectorRetriever,
} from "./vectors.js";

/** How deep the scores look: recall@5, and MRR over the top 10. */
export const RECALL_K = 5;
export const MRR_DEPTH = 10;

const origins = ["finding", "missed", "coverage", "id", "none"] as const;
export type Origin = (typeof origins)[number];
export type Split = "dev" | "test";

const querySchema = z.object({
  id: z.string().regex(/^RQ-\d{2,}$/),
  split: z.enum(["dev", "test"]),
  origin: z.enum(origins),
  item: z.string().optional(),
  query: z.string().min(1),
  expected: z.array(z.string()),
  why: z.string().optional(),
});

const querySetSchema = z.object({
  name: z.string(),
  version: z.number().int(),
  created: z.string(),
  /** Source name → pinned commit the queries were written against. */
  index: z.record(z.string(), z.string()),
  notes: z.array(z.string()),
  queries: z.array(querySchema),
});

export type RetrievalQuery = z.infer<typeof querySchema>;
export type QuerySet = z.infer<typeof querySetSchema>;

export function loadQuerySet(path: string): QuerySet {
  return querySetSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

/**
 * Anything that turns query text into a ranked list of chunk or record IDs.
 * ID lookup, BM25 and vectors all have this shape.
 */
export type Retriever = (query: string) => string[];

/** A chunk ID is `<record>#<n>`; a record ID has no `#`. */
export function recordOf(id: string): string {
  const hash = id.indexOf("#");
  return hash === -1 ? id : id.slice(0, hash);
}

/** Chunk IDs collapsed to records, first occurrence kept, order kept. */
export function rankedRecords(ranking: readonly string[]): string[] {
  return [...new Set(ranking.map(recordOf))];
}

/** 1-based rank of the first expected record, or null if none is ranked. */
export function firstHit(
  records: readonly string[],
  expected: readonly string[],
): number | null {
  const want = new Set(expected);
  const at = records.findIndex((r) => want.has(r));
  return at === -1 ? null : at + 1;
}

export interface QueryResult {
  id: string;
  split: Split;
  origin: Origin;
  rank: number | null;
  /** The first RECALL_K records returned, for reading misses. */
  top: string[];
  returned: number;
}

export interface Scores {
  queries: number;
  recallAt5: number;
  mrr: number;
}

export interface SplitScores {
  /** Every query with expected IDs (all origins except none). */
  all: Scores;
  byOrigin: Partial<Record<Exclude<Origin, "none">, Scores>>;
  /** Queries the corpus can't answer: how many got any result. */
  none: { queries: number; returnedAny: number };
}

export function runQuery(q: RetrievalQuery, retrieve: Retriever): QueryResult {
  const records = rankedRecords(retrieve(q.query));
  return {
    id: q.id,
    split: q.split,
    origin: q.origin,
    rank: firstHit(records, q.expected),
    top: records.slice(0, RECALL_K),
    returned: records.length,
  };
}

/** recall@5 and MRR (1/rank within the top 10, else 0). Empty gives zeros. */
export function score(results: readonly QueryResult[]): Scores {
  const n = results.length;
  if (n === 0) return { queries: 0, recallAt5: 0, mrr: 0 };
  const hits = results.filter((r) => r.rank !== null && r.rank <= RECALL_K);
  const rr = results.map((r) =>
    r.rank !== null && r.rank <= MRR_DEPTH ? 1 / r.rank : 0,
  );
  return {
    queries: n,
    recallAt5: round(hits.length / n),
    mrr: round(rr.reduce((a, b) => a + b, 0) / n),
  };
}

export function scoreSplit(results: readonly QueryResult[]): SplitScores {
  const answerable = results.filter((r) => r.origin !== "none");
  const none = results.filter((r) => r.origin === "none");
  const byOrigin: SplitScores["byOrigin"] = {};
  for (const origin of origins) {
    if (origin === "none") continue;
    const some = answerable.filter((r) => r.origin === origin);
    if (some.length > 0) byOrigin[origin] = score(some);
  }
  return {
    all: score(answerable),
    byOrigin,
    none: {
      queries: none.length,
      returnedAny: none.filter((r) => r.returned > 0).length,
    },
  };
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/**
 * Baseline retriever: exact lookup of every ID named in the query, in the
 * order named. Unknown IDs are dropped, never guessed.
 */
export function idsRetriever(kb: KnowledgeBase): Retriever {
  return (query) => {
    const found: string[] = [];
    for (const match of query.matchAll(idPattern)) {
      const hit = kb.get(match[0]);
      if (hit) found.push(hit.record.id);
    }
    return found;
  };
}

/**
 * Chunks to fetch per query: enough that, after chunks collapse to
 * records, MRR's top 10 is filled.
 */
export const SEARCH_DEPTH = 100;

/** core's search (named IDs, then BM25) with the given options. */
export function searchRetriever(
  kb: KnowledgeBase,
  options: SearchOptions = {},
): Retriever {
  return (query) =>
    kb.search(query, { limit: SEARCH_DEPTH, ...options }).map((h) => h.chunk);
}

/**
 * Builds a retriever for a run. Gets every query text up front, so vector
 * retrievers can embed them once (async) and then rank synchronously.
 */
export type RetrieverFactory = (
  kb: KnowledgeBase,
  queries: readonly string[],
) => Retriever | Promise<Retriever>;

/** Retrievers the CLI can run, by name. Each step adds its own here. */
export const retrievers: Record<string, RetrieverFactory> = {
  ids: idsRetriever,
  /** Textbook BM25 (k1 1.2, b 0.75, no stopwords or stemming): before tuning. */
  bm25: (kb) => searchRetriever(kb),
  /** The settings tuned on dev, from core's TUNED_SEARCH: after. */
  "bm25-tuned": (kb) => searchRetriever(kb, TUNED_SEARCH),
  /** Named IDs, then cosine, with bge's query instruction (model card default). */
  vectors: async (kb, queries) =>
    vectorRetriever(kb, await loadVectorContext(kb, queries), true),
  /** Tuned BM25 and vectors fused by RRF, textbook k 60, equal weights. */
  hybrid: async (kb, queries) =>
    hybridRetriever(kb, await loadVectorContext(kb, queries), {
      queryInstruction: true,
      k: 60,
      vectorWeight: 1,
    }),
  /** The hybrid settings tuned on dev, from core's TUNED_HYBRID. */
  "hybrid-tuned": async (kb, queries) =>
    hybridRetriever(kb, await loadVectorContext(kb, queries), TUNED_HYBRID),
};
