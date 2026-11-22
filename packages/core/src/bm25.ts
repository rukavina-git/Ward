/**
 * BM25 keyword scoring, by hand (plan 3 invariant: no search libraries).
 * An inverted index maps each token to the documents that contain it and
 * how often; a query only visits the postings of its own tokens.
 */

export interface Bm25Params {
  /** Term frequency saturation: how fast repeats of a word stop adding score. */
  k1: number;
  /** Length normalisation: 0 ignores length, 1 fully penalises long documents. */
  b: number;
}

/** Textbook defaults (Robertson and Zaragoza; Lucene uses the same). */
export const BM25_DEFAULTS: Bm25Params = { k1: 1.2, b: 0.75 };

export interface Bm25Doc {
  id: string;
  tokens: readonly string[];
}

export interface Bm25Hit {
  id: string;
  score: number;
}

export class Bm25Index {
  /** token → (doc number, count of the token in that doc). */
  private readonly postings = new Map<string, [number, number][]>();
  private readonly ids: string[] = [];
  private readonly lengths: number[] = [];
  private readonly avgLength: number;

  constructor(docs: readonly Bm25Doc[]) {
    let total = 0;
    docs.forEach((doc, n) => {
      this.ids.push(doc.id);
      this.lengths.push(doc.tokens.length);
      total += doc.tokens.length;
      const counts = new Map<string, number>();
      for (const t of doc.tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
      for (const [t, count] of counts) {
        let list = this.postings.get(t);
        if (!list) this.postings.set(t, (list = []));
        list.push([n, count]);
      }
    });
    this.avgLength = docs.length > 0 ? total / docs.length : 0;
  }

  get size(): number {
    return this.ids.length;
  }

  /**
   * Inverse document frequency. The `1 +` inside the log keeps it positive
   * even for a word in more than half the documents.
   */
  idf(token: string): number {
    const n = this.postings.get(token)?.length ?? 0;
    const N = this.ids.length;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  }

  /**
   * Documents matching any query token, best first; ties by id so the order
   * is the same every run. A repeated query token counts once.
   */
  search(
    queryTokens: readonly string[],
    params: Bm25Params = BM25_DEFAULTS,
  ): Bm25Hit[] {
    const { k1, b } = params;
    const scores = new Map<number, number>();
    for (const token of new Set(queryTokens)) {
      const list = this.postings.get(token);
      if (!list) continue;
      const idf = this.idf(token);
      for (const [n, tf] of list) {
        const norm = 1 - b + b * ((this.lengths[n] ?? 0) / this.avgLength);
        const s = (idf * tf * (k1 + 1)) / (tf + k1 * norm);
        scores.set(n, (scores.get(n) ?? 0) + s);
      }
    }
    return [...scores]
      .map(([n, score]) => ({ id: this.ids[n] ?? "", score }))
      .sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1));
  }
}
