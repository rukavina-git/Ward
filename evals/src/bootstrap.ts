/**
 * Paired bootstrap for a difference in MRR (plan 3 step 06's decision
 * rule). Both retrievers answered the same queries, so each query gives a
 * pair of reciprocal ranks. Draw the queries again at random, with
 * replacement, many times; each draw gives one mean difference. The middle
 * 95% of those differences is the interval. If it sits above 0, the win
 * isn't one or two lucky queries.
 */

/** mulberry32: a tiny seeded random generator, so the interval is reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BootstrapResult {
  /** Mean of b − a over the real queries. */
  diff: number;
  /** 2.5th and 97.5th percentiles of the resampled differences. */
  low: number;
  high: number;
  resamples: number;
}

/**
 * `a` and `b` are per-query scores (e.g. reciprocal rank) in the same
 * query order. Returns b − a with its 95% interval.
 */
export function pairedBootstrap(
  a: readonly number[],
  b: readonly number[],
  { resamples = 10_000, seed = 6 }: { resamples?: number; seed?: number } = {},
): BootstrapResult {
  if (a.length !== b.length || a.length === 0) {
    throw new Error("pairedBootstrap: need two equal, non-empty lists");
  }
  const d = a.map((x, i) => (b[i] ?? 0) - x);
  const n = d.length;
  const mean = (xs: readonly number[]): number =>
    xs.reduce((s, x) => s + x, 0) / xs.length;
  const rand = seededRandom(seed);
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += d[Math.floor(rand() * n)] ?? 0;
    means.push(sum / n);
  }
  means.sort((x, y) => x - y);
  const at = (q: number): number =>
    means[Math.min(resamples - 1, Math.floor(q * resamples))] ?? 0;
  return { diff: mean(d), low: at(0.025), high: at(0.975), resamples };
}
