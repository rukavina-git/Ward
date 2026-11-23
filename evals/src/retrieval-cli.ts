// npm run eval:retrieval -- --retriever ids
// Runs one retriever over the retrieval query set and writes
// evals/results/retrieval/<retriever>.json. Dev and test are both scored
// and reported; only dev may be used for tuning.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { defaultIndexPath, KnowledgeBase, loadIndex } from "@ward/core";
import { retrievalQueriesPath, retrievalResultsRoot } from "./paths.js";
import {
  loadQuerySet,
  retrievers,
  runQuery,
  scoreSplit,
  type Scores,
  type Split,
} from "./retrieval.js";

const { values } = parseArgs({
  options: { retriever: { type: "string", default: "ids" } },
});
const name = values.retriever;
const make = retrievers[name];
if (!make) {
  console.error(
    `unknown retriever "${name}"; known: ${Object.keys(retrievers).join(", ")}`,
  );
  process.exit(1);
}

const set = loadQuerySet(retrievalQueriesPath);
const indexBytes = readFileSync(defaultIndexPath);
const index = loadIndex(defaultIndexPath);
for (const source of index.sources) {
  if (set.index[source.name] !== source.commit) {
    console.error(
      `query set was written for ${source.name} ${String(set.index[source.name])}, index has ${source.commit}`,
    );
    process.exit(1);
  }
}

const retrieve = await make(
  new KnowledgeBase(index),
  set.queries.map((q) => q.query),
);
const results = set.queries.map((q) => runQuery(q, retrieve));
const splits: Split[] = ["dev", "test"];
const scores = Object.fromEntries(
  splits.map((s) => [s, scoreSplit(results.filter((r) => r.split === s))]),
);

const out = {
  retriever: name,
  querySet: { name: set.name, version: set.version },
  indexSha256: createHash("sha256").update(indexBytes).digest("hex"),
  scores,
  queries: results,
};
mkdirSync(retrievalResultsRoot, { recursive: true });
const path = join(retrievalResultsRoot, `${name}.json`);
writeFileSync(path, JSON.stringify(out, null, 2) + "\n");

const row = (label: string, s: Scores | undefined): string =>
  s
    ? `${label.padEnd(9)} n=${String(s.queries).padStart(2)}  recall@5 ${s.recallAt5.toFixed(3)}  MRR ${s.mrr.toFixed(3)}`
    : "";
for (const s of splits) {
  const sc = scores[s];
  if (!sc) continue;
  console.log(`${name} / ${s}`);
  console.log("  " + row("all", sc.all));
  for (const [origin, o] of Object.entries(sc.byOrigin)) {
    console.log("  " + row(origin, o));
  }
  console.log(
    `  none      n=${String(sc.none.queries).padStart(2)}  returned something: ${String(sc.none.returnedAny)}`,
  );
}
console.log(`wrote ${path}`);
