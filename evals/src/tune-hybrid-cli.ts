// npm run eval:tune-hybrid
// Grid search of vector and hybrid settings on the retrieval eval's DEV
// split only (plan 3 step 06). Test is scored once, with the chosen
// settings, by `npm run eval:retrieval -- --retriever hybrid-tuned`.
// Also records the top cosine per dev query, for plan 4's "nothing found"
// cutoff. Writes evals/results/retrieval/hybrid-tuning.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KnowledgeBase, loadIndex, TUNED_HYBRID } from "@ward/core";
import { retrievalQueriesPath, retrievalResultsRoot } from "./paths.js";
import {
  loadQuerySet,
  runQuery,
  scoreSplit,
  type Scores,
} from "./retrieval.js";
import { hybridGrid, pickBest } from "./tune.js";
import {
  hybridRetriever,
  loadVectorContext,
  vectorRetriever,
  type HybridSettings,
} from "./vectors.js";

const set = loadQuerySet(retrievalQueriesPath);
const dev = set.queries.filter((q) => q.split === "dev");
const kb = new KnowledgeBase(loadIndex());
const ctx = await loadVectorContext(
  kb,
  dev.map((q) => q.query),
);

const devScores = (retrieve: (q: string) => string[]): Scores =>
  scoreSplit(dev.map((q) => runQuery(q, retrieve))).all;

const fmtScores = (s: Scores): string =>
  `MRR ${s.mrr.toFixed(3)}  recall@5 ${s.recallAt5.toFixed(3)}`;

console.log("vectors alone, dev:");
for (const instruction of [true, false]) {
  const s = devScores(vectorRetriever(kb, ctx, instruction));
  console.log(`  ${fmtScores(s)}  instruction ${instruction ? "on" : "off"}`);
}

const rows: { options: HybridSettings; dev: Scores }[] = [];
for (const options of hybridGrid()) {
  rows.push({ options, dev: devScores(hybridRetriever(kb, ctx, options)) });
}
const ranked = pickBest(rows);
const best = ranked[0];
if (!best) throw new Error("empty grid");

const fmt = (o: HybridSettings): string =>
  `instruction ${o.queryInstruction ? "on" : "off"} k ${String(o.k)} vectorWeight ${String(o.vectorWeight)}`;
console.log(`hybrid, dev, ${String(rows.length)} settings, top 10:`);
for (const r of ranked.slice(0, 10)) {
  console.log(`  ${fmtScores(r.dev)}  ${fmt(r.options)}`);
}
const same =
  best.options.queryInstruction === TUNED_HYBRID.queryInstruction &&
  best.options.k === TUNED_HYBRID.k &&
  best.options.vectorWeight === TUNED_HYBRID.vectorWeight;
console.log(`best: ${fmt(best.options)}`);
console.log(
  same
    ? "core TUNED_HYBRID matches the best."
    : "core TUNED_HYBRID differs: copy the best into packages/core/src/vectors.ts.",
);

// Top cosine per dev query (best instruction setting): can it tell the
// none queries apart from the answerable ones?
const topCosines = dev.map((q) => {
  const v = (
    best.options.queryInstruction ? ctx.queries.instructed : ctx.queries.plain
  ).get(q.query);
  const top = v ? (ctx.vs.search(v, 1)[0]?.score ?? 0) : 0;
  return { id: q.id, origin: q.origin, top };
});
const range = (xs: number[]): string =>
  xs.length === 0
    ? "-"
    : `${Math.min(...xs).toFixed(3)}–${Math.max(...xs).toFixed(3)}`;
const noneTops = topCosines
  .filter((t) => t.origin === "none")
  .map((t) => t.top);
const realTops = topCosines
  .filter((t) => t.origin !== "none")
  .map((t) => t.top);
console.log(
  `top cosine, none queries: ${range(noneTops)}; answerable: ${range(realTops)}`,
);
console.log(`query embedding: ${ctx.msPerQuery.toFixed(1)} ms each`);

mkdirSync(retrievalResultsRoot, { recursive: true });
const path = join(retrievalResultsRoot, "hybrid-tuning.json");
writeFileSync(
  path,
  JSON.stringify(
    {
      split: "dev",
      querySet: { name: set.name, version: set.version },
      best: best.options,
      grid: ranked,
      topCosines,
    },
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${path}`);
