import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Chunk, IndexRecord } from "@ward/core";
import { MODEL } from "./model.js";
import { packageRoot } from "./paths.js";

/**
 * The chunk vectors, built by `npm run embed`. Gitignored in plan 3 step
 * 06: they ship only if they beat BM25 (ADR 0009, ADR 0010).
 * vectors.bin: one row of `dims` 32-bit little-endian floats per chunk, in
 * index.json's chunk order. vectors.json: this header.
 */
export const vectorsBinPath = join(packageRoot, "out/vectors.bin");
export const vectorsHeaderPath = join(packageRoot, "out/vectors.json");

export interface VectorsHeader {
  model: string;
  repo: string;
  revision: string;
  dims: number;
  chunks: number;
  /** SHA-256 of the index.json bytes the vectors were built from. */
  indexSha256: string;
  /** SHA-256 of vectors.bin. */
  vectorsSha256: string;
  /** Chunks longer than the model's 512 word pieces, cut before embedding. */
  truncated: number;
}

/**
 * What each chunk is embedded as: the same fields BM25 indexes (record
 * title, section path, text), so the two compare on the same input.
 */
export function embedText(
  chunk: Chunk,
  record: IndexRecord | undefined,
): string {
  const head = [record?.title ?? "", chunk.section.join(" > ")]
    .filter((s) => s !== "")
    .join("\n");
  return head === "" ? chunk.text : `${head}\n${chunk.text}`;
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Float32 rows → bytes, little-endian whatever the machine. */
export function vectorsToBytes(rows: readonly Float32Array[]): Buffer {
  const dims = rows[0]?.length ?? 0;
  const buf = Buffer.alloc(rows.length * dims * 4);
  rows.forEach((row, i) => {
    row.forEach((x, j) => buf.writeFloatLE(x, (i * dims + j) * 4));
  });
  return buf;
}

export function bytesToVectors(bytes: Buffer): Float32Array {
  const out = new Float32Array(bytes.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = bytes.readFloatLE(i * 4);
  return out;
}

/**
 * Reads the vectors and checks them against their header and the index
 * they're used with. A rebuilt index or a different model is refused.
 */
export function loadVectors(indexBytes: Uint8Array): {
  header: VectorsHeader;
  vectors: Float32Array;
} {
  const header = JSON.parse(
    readFileSync(vectorsHeaderPath, "utf8"),
  ) as VectorsHeader;
  const bytes = readFileSync(vectorsBinPath);
  const problems: string[] = [];
  if (header.model !== MODEL.id || header.revision !== MODEL.revision) {
    problems.push(
      `model ${header.model}@${header.revision}, expected ${MODEL.id}@${MODEL.revision}`,
    );
  }
  if (header.indexSha256 !== sha256Bytes(indexBytes)) {
    problems.push("built from a different index.json; rerun npm run embed");
  }
  if (header.vectorsSha256 !== sha256Bytes(bytes)) {
    problems.push("vectors.bin doesn't match its header");
  }
  if (bytes.length !== header.chunks * header.dims * 4) {
    problems.push("vectors.bin has the wrong size");
  }
  if (problems.length > 0) {
    throw new Error(`vectors: ${problems.join("; ")}`);
  }
  return { header, vectors: bytesToVectors(bytes) };
}
