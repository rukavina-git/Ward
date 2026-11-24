import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * The embedding model (ADR 0004): BAAI's bge-small-en-v1.5 (MIT) as the
 * ONNX export in Xenova/bge-small-en-v1.5, pinned to one commit, quantized
 * to 8-bit. Every file is checked against its SHA-256 before use.
 */
export const MODEL = {
  id: "BAAI/bge-small-en-v1.5",
  repo: "Xenova/bge-small-en-v1.5",
  revision: "ea104dacec62c0de699686887e3f920caeb4f3e3",
  licence: "MIT",
  dims: 384,
  /** Word pieces the model reads; longer input is cut (CLS and SEP included). */
  maxTokens: 512,
  files: {
    "onnx/model_quantized.onnx":
      "6c9c6101a956d62dfb5e7190c538226c0c5bb9cb27b651234b6df063ee7dbfe4",
    "tokenizer.json":
      "d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66",
    "tokenizer_config.json":
      "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3",
  },
} as const;

/**
 * bge's prefix for short queries searching longer passages (model card).
 * Passages are embedded without it.
 */
export const QUERY_INSTRUCTION =
  "Represent this sentence for searching relevant passages: ";

export type ModelFile = keyof typeof MODEL.files;

export function modelDir(cacheRoot: string): string {
  return join(cacheRoot, "models", `bge-small-en-v1.5@${MODEL.revision}`);
}

export function fileUrl(file: ModelFile): string {
  return `https://huggingface.co/${MODEL.repo}/resolve/${MODEL.revision}/${file}`;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** True when every pinned file is in the cache with the right hash. */
export function hasModel(cacheRoot: string): boolean {
  const dir = modelDir(cacheRoot);
  return Object.entries(MODEL.files).every(([file, hash]) => {
    const path = join(dir, file);
    return existsSync(path) && sha256File(path) === hash;
  });
}

/**
 * The model's folder, downloaded once at the pinned commit. A file whose
 * hash doesn't match is refused, downloaded or cached. Nothing downloads
 * at search time: embed.ts only reads this folder.
 */
export async function ensureModel(cacheRoot: string): Promise<string> {
  const dir = modelDir(cacheRoot);
  for (const [file, hash] of Object.entries(MODEL.files) as [
    ModelFile,
    string,
  ][]) {
    const path = join(dir, file);
    if (!existsSync(path)) {
      const res = await fetch(fileUrl(file));
      if (!res.ok)
        throw new Error(`${fileUrl(file)}: HTTP ${String(res.status)}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const got = createHash("sha256").update(bytes).digest("hex");
      if (got !== hash) {
        throw new Error(`${file}: sha256 ${got}, expected ${hash}`);
      }
      mkdirSync(dirname(path), { recursive: true });
      await writeFile(`${path}.tmp`, bytes);
      renameSync(`${path}.tmp`, path);
    }
    const got = sha256File(path);
    if (got !== hash) {
      throw new Error(`${path}: sha256 ${got}, expected ${hash}; delete it`);
    }
  }
  return dir;
}
