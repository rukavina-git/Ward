import { readFileSync } from "node:fs";
import {
  defaultIndexPath,
  hybridSearch,
  TUNED_SEARCH,
  vectorSearch,
  VectorSearch,
  type KnowledgeBase,
} from "@ward/core";
import {
  Embedder,
  ensureModel,
  ingestCacheRoot,
  loadVectors,
  QUERY_INSTRUCTION,
} from "@ward/ingest";
import type { Retriever } from "./retrieval.js";

/** Chunks fetched per query, as SEARCH_DEPTH for BM25. */
const DEPTH = 100;

export interface QueryVectors {
  /** Without bge's query instruction. */
  plain: Map<string, Float32Array>;
  /** With it. */
  instructed: Map<string, Float32Array>;
}

export interface VectorContext {
  vs: VectorSearch;
  queries: QueryVectors;
  /** Milliseconds per query embedding, averaged over this run. */
  msPerQuery: number;
}

/**
 * Loads the chunk vectors (checked against index.json) and embeds every
 * query once, with and without the instruction, so retrievers stay
 * synchronous and the grid doesn't re-embed.
 */
export async function loadVectorContext(
  kb: KnowledgeBase,
  queryTexts: readonly string[],
): Promise<VectorContext> {
  const { header, vectors } = loadVectors(readFileSync(defaultIndexPath));
  const vs = new VectorSearch(kb.index.chunks, vectors, header.dims);
  const embedder = await Embedder.load(await ensureModel(ingestCacheRoot));
  const plain = new Map<string, Float32Array>();
  const instructed = new Map<string, Float32Array>();
  const started = performance.now();
  for (const q of new Set(queryTexts)) {
    plain.set(q, await embedder.embed(q));
    instructed.set(q, await embedder.embed(QUERY_INSTRUCTION + q));
  }
  const n = Math.max(1, 2 * new Set(queryTexts).size);
  return {
    vs,
    queries: { plain, instructed },
    msPerQuery: (performance.now() - started) / n,
  };
}

function vectorFor(
  ctx: VectorContext,
  query: string,
  instruction: boolean,
): Float32Array {
  const v = (instruction ? ctx.queries.instructed : ctx.queries.plain).get(
    query,
  );
  if (!v) throw new Error(`query not embedded: ${query}`);
  return v;
}

/** Named IDs first, then chunks by cosine. */
export function vectorRetriever(
  kb: KnowledgeBase,
  ctx: VectorContext,
  instruction: boolean,
): Retriever {
  return (query) =>
    vectorSearch(kb, ctx.vs, query, vectorFor(ctx, query, instruction), DEPTH);
}

export interface HybridSettings {
  queryInstruction: boolean;
  k: number;
  vectorWeight: number;
}

/** Named IDs first, then tuned BM25 and vectors fused by RRF. */
export function hybridRetriever(
  kb: KnowledgeBase,
  ctx: VectorContext,
  s: HybridSettings,
): Retriever {
  return (query) =>
    hybridSearch(kb, ctx.vs, query, vectorFor(ctx, query, s.queryInstruction), {
      k: s.k,
      vectorWeight: s.vectorWeight,
      bm25: TUNED_SEARCH,
      depth: DEPTH,
    });
}
