import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { loadIndex } from "@ward/core";
import { Embedder } from "./embed.js";
import { ensureModel, MODEL } from "./model.js";
import { cacheRoot, indexPath, repoRoot } from "./paths.js";
import {
  embedText,
  sha256Bytes,
  vectorsBinPath,
  vectorsHeaderPath,
  vectorsToBytes,
  type VectorsHeader,
} from "./vectors-file.js";

// `npm run embed`: download the pinned model (once), embed every chunk of
// packages/core/data/index.json, write packages/ingest/out/vectors.bin and
// vectors.json. No network after the model is cached.
const started = performance.now();
const dir = await ensureModel(cacheRoot);
const embedder = await Embedder.load(dir);
const indexBytes = readFileSync(indexPath);
const index = loadIndex(indexPath);
const records = new Map(index.records.map((r) => [r.id, r]));

const rows: Float32Array[] = [];
for (const [i, chunk] of index.chunks.entries()) {
  rows.push(await embedder.embed(embedText(chunk, records.get(chunk.record))));
  if ((i + 1) % 250 === 0) {
    console.log(`${String(i + 1)} / ${String(index.chunks.length)}`);
  }
}
const seconds = (performance.now() - started) / 1000;

const bytes = vectorsToBytes(rows);
const header: VectorsHeader = {
  model: MODEL.id,
  repo: MODEL.repo,
  revision: MODEL.revision,
  dims: MODEL.dims,
  chunks: rows.length,
  indexSha256: sha256Bytes(indexBytes),
  vectorsSha256: sha256Bytes(bytes),
  truncated: embedder.truncated,
};
mkdirSync(dirname(vectorsBinPath), { recursive: true });
writeFileSync(`${vectorsBinPath}.tmp`, bytes);
renameSync(`${vectorsBinPath}.tmp`, vectorsBinPath);
writeFileSync(vectorsHeaderPath, `${JSON.stringify(header, null, 2)}\n`);

console.log(
  `${String(rows.length)} chunks embedded in ${seconds.toFixed(1)} s (${((seconds * 1000) / rows.length).toFixed(1)} ms each), ${String(embedder.truncated)} cut at ${String(MODEL.maxTokens)} word pieces`,
);
console.log(
  `${relative(repoRoot, vectorsBinPath)} ${String(Math.round(bytes.length / 1024))} KB sha256 ${header.vectorsSha256}`,
);
