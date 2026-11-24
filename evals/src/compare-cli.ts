// npm run eval:compare -- --base bm25-tuned --challenger hybrid-tuned
// Reads two results files from evals/results/retrieval/ and applies plan 3
// step 06's decision rule on the TEST split, answerable queries: the
// challenger wins if its MRR is higher, the paired bootstrap's 95%
// interval for the difference is above 0, recall@5 isn't lower, and id
// queries stay at 1.0. Prints the verdict; writes nothing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { pairedBootstrap } from "./bootstrap.js";
import { retrievalResultsRoot } from "./paths.js";
import { MRR_DEPTH, score, type QueryResult, type Split } from "./retrieval.js";

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "bm25-tuned" },
    challenger: { type: "string", default: "hybrid-tuned" },
    split: { type: "string", default: "test" },
  },
});
const split = values.split as Split;

interface ResultsFile {
  querySet: { version: number };
  queries: QueryResult[];
}
const read = (name: string): ResultsFile =>
  JSON.parse(
    readFileSync(join(retrievalResultsRoot, `${name}.json`), "utf8"),
  ) as ResultsFile;
const base = read(values.base);
const chal = read(values.challenger);
if (base.querySet.version !== chal.querySet.version) {
  throw new Error("results are from different query set versions");
}

const pick = (f: ResultsFile): QueryResult[] =>
  f.queries
    .filter((q) => q.split === split && q.origin !== "none")
    .sort((x, y) => (x.id < y.id ? -1 : 1));
const a = pick(base);
const b = pick(chal);
if (a.map((q) => q.id).join() !== b.map((q) => q.id).join()) {
  throw new Error("the two results cover different queries");
}

const rr = (q: QueryResult): number =>
  q.rank !== null && q.rank <= MRR_DEPTH ? 1 / q.rank : 0;
const boot = pairedBootstrap(a.map(rr), b.map(rr));
const sa = score(a);
const sb = score(b);
const idsOk = score(b.filter((q) => q.origin === "id")).mrr === 1;
const wins =
  boot.diff > 0 && boot.low > 0 && sb.recallAt5 >= sa.recallAt5 && idsOk;

const better = b.filter((q, i) => rr(q) > rr(a[i] as QueryResult)).length;
const worse = b.filter((q, i) => rr(q) < rr(a[i] as QueryResult)).length;
console.log(
  `${split}, ${String(a.length)} answerable queries, query set v${String(base.querySet.version)}`,
);
console.log(
  `  ${values.base.padEnd(14)} recall@5 ${sa.recallAt5.toFixed(3)}  MRR ${sa.mrr.toFixed(3)}`,
);
console.log(
  `  ${values.challenger.padEnd(14)} recall@5 ${sb.recallAt5.toFixed(3)}  MRR ${sb.mrr.toFixed(3)}`,
);
console.log(
  `  MRR difference ${boot.diff.toFixed(3)}, 95% interval [${boot.low.toFixed(3)}, ${boot.high.toFixed(3)}] (${String(boot.resamples)} resamples)`,
);
console.log(
  `  queries better ${String(better)}, worse ${String(worse)}, same ${String(a.length - better - worse)}`,
);
console.log(`  id queries at 1.0: ${idsOk ? "yes" : "no"}`);
console.log(
  `verdict: ${values.challenger} ${wins ? "WINS" : "does not win"} over ${values.base}`,
);
