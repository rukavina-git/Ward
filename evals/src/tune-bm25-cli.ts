// npm run eval:tune-bm25
// Grid search of BM25 settings on the retrieval eval's DEV split only.
// Test is never read here: it is scored once, with the chosen settings,
// by `npm run eval:retrieval -- --retriever bm25-tuned`.
// Writes evals/results/retrieval/bm25-tuning.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  KnowledgeBase,
  loadIndex,
  TUNED_SEARCH,
  type SearchOptions,
} from "@ward/core";
import { retrievalQueriesPath, retrievalResultsRoot } from "./paths.js";
import {
  loadQuerySet,
  runQuery,
  scoreSplit,
  searchRetriever,
  type Scores,
} from "./retrieval.js";
import { bm25Grid, pickBest } from "./tune.js";

const set = loadQuerySet(retrievalQueriesPath);
const dev = set.queries.filter((q) => q.split === "dev");
const kb = new KnowledgeBase(loadIndex());

const rows: { options: Required<Omit<SearchOptions, "limit">>; dev: Scores }[] =
  [];
for (const options of bm25Grid()) {
  const retrieve = searchRetriever(kb, options);
  const results = dev.map((q) => runQuery(q, retrieve));
  rows.push({ options, dev: scoreSplit(results).all });
}
const ranked = pickBest(rows);
const best = ranked[0];
if (!best) throw new Error("empty grid");

// Top BM25 score per dev query, so plan 4 can choose a "nothing relevant"
// cutoff: compare the none queries with the answerable ones.
const topScores = dev.map((q) => {
  const hit = kb
    .search(q.query, { ...best.options, limit: 50 })
    .find((h) => h.match === "text");
  return { id: q.id, origin: q.origin, top: hit?.score ?? 0 };
});

const fmt = (o: SearchOptions): string =>
  `k1 ${String(o.k1)} b ${String(o.b)} stop ${o.stopwords ? "1" : "0"} stem ${o.stem ? "1" : "0"} title ${String(o.titleWeight)} code ${String(o.codeWeight)}`;
console.log(
  `dev, ${String(rows.length)} settings, top 10 by MRR then recall@5:`,
);
for (const r of ranked.slice(0, 10)) {
  console.log(
    `  MRR ${r.dev.mrr.toFixed(3)}  recall@5 ${r.dev.recallAt5.toFixed(3)}  ${fmt(r.options)}`,
  );
}
const same = JSON.stringify(best.options) === JSON.stringify(TUNED_SEARCH);
console.log(`best: ${fmt(best.options)}`);
console.log(
  same
    ? "core TUNED_SEARCH matches the best."
    : "core TUNED_SEARCH differs: copy the best into packages/core/src/search.ts.",
);
console.log("top BM25 score per dev query (best settings):");
for (const t of topScores) {
  console.log(`  ${t.id} ${t.origin.padEnd(7)} ${t.top.toFixed(2)}`);
}

mkdirSync(retrievalResultsRoot, { recursive: true });
const path = join(retrievalResultsRoot, "bm25-tuning.json");
writeFileSync(
  path,
  JSON.stringify(
    {
      split: "dev",
      querySet: { name: set.name, version: set.version },
      best: best.options,
      grid: ranked,
      topScores,
    },
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${path}`);
