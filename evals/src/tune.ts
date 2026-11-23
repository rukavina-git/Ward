import type { SearchOptions } from "@ward/core";
import type { Scores } from "./retrieval.js";

export type GridOptions = Required<Omit<SearchOptions, "limit">>;

/**
 * The step 04 grid. Each list starts with the textbook default, so the
 * first combination is plain BM25.
 */
export function bm25Grid(): GridOptions[] {
  const out: GridOptions[] = [];
  for (const k1 of [1.2, 0.9, 1.5, 2.0])
    for (const b of [0.75, 0.5, 0.9])
      for (const stopwords of [false, true])
        for (const stem of [false, true])
          for (const titleWeight of [1, 2, 3])
            for (const codeWeight of [1, 0.5, 0.25])
              out.push({ k1, b, stopwords, stem, titleWeight, codeWeight });
  return out;
}

/**
 * Best first: higher MRR, then higher recall@5. On a full tie the earlier
 * grid entry wins, which is the one closer to the defaults.
 */
export function pickBest<T extends { dev: Scores }>(rows: readonly T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort(
      (x, y) =>
        y.r.dev.mrr - x.r.dev.mrr ||
        y.r.dev.recallAt5 - x.r.dev.recallAt5 ||
        x.i - y.i,
    )
    .map(({ r }) => r);
}

/**
 * The step 06 hybrid grid. Starts with the textbook RRF setting (k 60,
 * equal weights, model card's query instruction on).
 */
export function hybridGrid(): {
  queryInstruction: boolean;
  k: number;
  vectorWeight: number;
}[] {
  const out = [];
  for (const queryInstruction of [true, false])
    for (const k of [60, 30, 10])
      for (const vectorWeight of [1, 0.5, 2])
        out.push({ queryInstruction, k, vectorWeight });
  return out;
}
