import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { buildIndex, CHUNK_MAX_CHARS } from "./chunk.js";
import { ensureSource } from "./fetch.js";
import { buildRecords, serialize, sha256, writeAtomic } from "./ingest.js";
import { overrides } from "./overrides.js";
import { cacheRoot, indexPath, keyPath, outPath, repoRoot } from "./paths.js";
import { expectedCounts, pinnedSources, type SourceKey } from "./sources.js";
import { checkCounts, checkKnownMappings, countRecords } from "./verify.js";

// `npm run ingest`: clone the pinned sources (once), build the records,
// check them, write packages/ingest/out/records.json and the chunked index
// packages/core/data/index.json. Any problem: exit 1, nothing written.
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
  const index = buildIndex(file);
  const indexText = serialize(index);
  writeAtomic(outPath, text);
  writeAtomic(indexPath, indexText);
  for (const [kind, byStatus] of Object.entries(countRecords(file.records))) {
    const parts = Object.entries(byStatus).map(([s, n]) => `${String(n)} ${s}`);
    console.log(`${kind}: ${parts.join(", ")}`);
  }
  console.log(`overrides applied: ${String(file.overrides.length)}`);
  console.log(`known mappings: ${String(known.issues)} answer-key issues hold`);
  console.log(`${relative(repoRoot, outPath)} sha256 ${sha256(text)}`);
  const sizes = index.chunks.map((c) => c.text.length).sort((a, b) => a - b);
  const at = (q: number): number =>
    sizes[Math.floor(q * (sizes.length - 1))] ?? 0;
  const over = sizes.filter((n) => n > CHUNK_MAX_CHARS).length;
  console.log(
    `chunks: ${String(sizes.length)}, chars median ${String(at(0.5))}, p90 ${String(at(0.9))}, max ${String(at(1))}, over limit ${String(over)}`,
  );
  console.log(
    `${relative(repoRoot, indexPath)} ${String(Math.round(indexText.length / 1024))} KB sha256 ${sha256(indexText)}`,
  );
}
