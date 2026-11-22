import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { ensureSource } from "./fetch.js";
import { buildRecords, serialize, sha256 } from "./ingest.js";
import { overrides } from "./overrides.js";
import { cacheRoot, keyPath, outPath, repoRoot } from "./paths.js";
import { expectedCounts, pinnedSources, type SourceKey } from "./sources.js";
import { checkCounts, checkKnownMappings, countRecords } from "./verify.js";

// `npm run ingest`: clone the pinned sources (once), build the records,
// check them, write packages/ingest/out/records.json. Any problem: exit 1,
// nothing written.
const dirs = {} as Record<SourceKey, string>;
for (const src of pinnedSources) dirs[src.key] = ensureSource(src, cacheRoot);

const { file, problems } = buildRecords(dirs, pinnedSources, overrides);
problems.push(...checkCounts(file.records, expectedCounts));
const known = checkKnownMappings(
  file.records,
  JSON.parse(readFileSync(keyPath, "utf8")),
);
problems.push(...known.problems);

if (problems.length > 0) {
  console.error(`Ingest failed, ${String(problems.length)} problems:`);
  for (const p of problems) console.error(`- ${p}`);
  process.exitCode = 1;
} else {
  const text = serialize(file);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
  for (const [kind, byStatus] of Object.entries(countRecords(file.records))) {
    const parts = Object.entries(byStatus).map(([s, n]) => `${String(n)} ${s}`);
    console.log(`${kind}: ${parts.join(", ")}`);
  }
  console.log(`overrides applied: ${String(file.overrides.length)}`);
  console.log(`known mappings: ${String(known.issues)} answer-key issues hold`);
  console.log(`${relative(repoRoot, outPath)} sha256 ${sha256(text)}`);
}
