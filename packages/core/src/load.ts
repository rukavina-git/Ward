import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INDEX_FORMAT, type KnowledgeIndex } from "./index-file.js";

/** packages/core/data/index.json; this file sits in src (tests) or dist. */
export const defaultIndexPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../data/index.json",
);

/** Reads the index and checks its format version and top-level shape. */
export function loadIndex(path: string = defaultIndexPath): KnowledgeIndex {
  const data = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (typeof data !== "object" || data === null) {
    throw new Error(`${path}: not a JSON object`);
  }
  const index = data as Partial<KnowledgeIndex>;
  if (index.format !== INDEX_FORMAT) {
    throw new Error(
      `${path}: index format ${String(index.format)}, expected ${String(INDEX_FORMAT)}`,
    );
  }
  if (!Array.isArray(index.records) || !Array.isArray(index.chunks)) {
    throw new Error(`${path}: records or chunks missing`);
  }
  return index as KnowledgeIndex;
}
