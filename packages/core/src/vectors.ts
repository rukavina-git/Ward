/**
 * Vector search and hybrid ranking, by hand (plan 3 step 06). Pure code:
 * no model here. Vectors come in already computed and L2-normalised (see
 * packages/ingest/src/embed.ts), so cosine similarity is a dot product.
 */
import type { Chunk } from "./index-file.js";
import type { KnowledgeBase } from "./lookup.js";
import type { SearchOptions } from "./search.js";

export interface VectorHit {
  chunk: string;
  record: string;
  /** Cosine similarity, -1..1 (in practice 0.3..0.9 for this model). */
  score: number;
}

export function dot(a: Float32Array, b: Float32Array, offset = 0): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] ?? 0) * (b[offset + i] ?? 0);
  return sum;
}

/**
 * Brute force: compare the query with every chunk vector. 2,132 × 384
 * multiplications is under a millisecond; no approximate index needed
 * (ADR 0003).
 */
export class VectorSearch {
  private readonly rows: { chunk: Chunk; offset: number }[] = [];

  /**
   * `vectors` holds one row of `dims` numbers per chunk, in the order of
   * `chunks` (index.json order). Placeholders are skipped, as in BM25.
   */
  constructor(
    chunks: readonly Chunk[],
    private readonly vectors: Float32Array,
    readonly dims: number,
  ) {
    if (vectors.length !== chunks.length * dims) {
      throw new Error(
        `vectors: ${String(vectors.length)} numbers for ${String(chunks.length)} chunks × ${String(dims)}`,
      );
    }
    chunks.forEach((chunk, i) => {
      if (chunk.status !== "placeholder") {
        this.rows.push({ chunk, offset: i * dims });
      }
    });
  }

  /** Top `limit` chunks by cosine, ties by chunk ID. A zero vector finds nothing. */
  search(query: Float32Array, limit = 20): VectorHit[] {
    if (query.length !== this.dims) {
      throw new Error(
        `query has ${String(query.length)} dims, index ${String(this.dims)}`,
      );
    }
    if (query.every((x) => x === 0)) return [];
    return this.rows
      .map(({ chunk, offset }) => ({
        chunk: chunk.id,
        record: chunk.record,
        score: dot(query, this.vectors, offset),
      }))
      .sort((x, y) => y.score - x.score || (x.chunk < y.chunk ? -1 : 1))
      .slice(0, limit);
  }
}

export interface Ranking {
  /** Best first. */
  ids: readonly string[];
  /** Multiplies this list's contribution. Default 1. */
  weight?: number;
}

/**
 * Reciprocal rank fusion: each list gives an item weight / (k + rank),
 * rank from 1; the sums decide the order, ties by ID. Uses positions only,
 * so BM25 scores and cosines never have to be put on one scale. A larger
 * k flattens the gap between rank 1 and rank 10.
 */
export function reciprocalRankFusion(
  rankings: readonly Ranking[],
  k: number,
): { id: string; score: number }[] {
  const sums = new Map<string, number>();
  for (const { ids, weight = 1 } of rankings) {
    ids.forEach((id, i) => {
      sums.set(id, (sums.get(id) ?? 0) + weight / (k + i + 1));
    });
  }
  return [...sums]
    .map(([id, score]) => ({ id, score }))
    .sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1));
}

export interface HybridOptions {
  /** RRF's k. */
  k: number;
  /** Weight of the vector list; BM25's is 1. */
  vectorWeight: number;
  /** BM25 settings for the keyword list. */
  bm25: SearchOptions;
  /** Chunks taken from each list before fusing, and returned. Default 100. */
  depth?: number;
}

/**
 * Settings picked on the retrieval eval's dev split (`npm run
 * eval:tune-hybrid`), query set v3: dev MRR 0.803, recall@5 0.963 (textbook
 * k 60, equal weights: 0.759 / 0.950). The best grid point gives vectors
 * the least weight tried. Test was scored once, with these.
 */
export const TUNED_HYBRID = {
  queryInstruction: true,
  k: 10,
  vectorWeight: 0.5,
} as const;

/**
 * Named IDs first (as in KnowledgeBase.search), then the vector hits.
 * Lets the eval compare vectors and BM25 on the same footing.
 */
export function vectorSearch(
  kb: KnowledgeBase,
  vs: VectorSearch,
  query: string,
  queryVector: Float32Array,
  depth = 100,
): string[] {
  const named = idHits(kb, query);
  const seen = new Set(named);
  const out = [...named];
  for (const hit of vs.search(queryVector, depth + named.length)) {
    if (!seen.has(hit.chunk)) out.push(hit.chunk);
  }
  return out.slice(0, depth);
}

/** Named IDs first, then BM25 and vector rankings fused by RRF. */
export function hybridSearch(
  kb: KnowledgeBase,
  vs: VectorSearch,
  query: string,
  queryVector: Float32Array,
  options: HybridOptions,
): string[] {
  const depth = options.depth ?? 100;
  const named = idHits(kb, query);
  const text = kb
    .search(query, { ...options.bm25, limit: depth + named.length })
    .filter((h) => h.match === "text")
    .map((h) => h.chunk);
  const vector = vs.search(queryVector, depth).map((h) => h.chunk);
  const fused = reciprocalRankFusion(
    [{ ids: text }, { ids: vector, weight: options.vectorWeight }],
    options.k,
  );
  const seen = new Set(named);
  const out = [...named];
  for (const { id } of fused) if (!seen.has(id)) out.push(id);
  return out.slice(0, depth);
}

function idHits(kb: KnowledgeBase, query: string): string[] {
  return kb.named(query).map((h) => h.chunk);
}
