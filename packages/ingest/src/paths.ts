import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This file sits in packages/ingest/src (tests) or packages/ingest/dist
// (CLI): three levels below the repo root either way.
export const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const packageRoot = join(repoRoot, "packages/ingest");

/** Gitignored: the OWASP repos, cloned at their pinned tags. */
export const cacheRoot = join(packageRoot, ".cache");
/** Gitignored: the full records, bodies and demo files included. */
export const outPath = join(packageRoot, "out/records.json");
/** Committed and shipped: the chunked index (CC BY-SA 4.0, see its NOTICE). */
export const indexPath = join(repoRoot, "packages/core/data/index.json");
/** A few real OWASP files, copied verbatim, for tests. */
export const fixturesRoot = join(packageRoot, "test/fixtures");
/** Plan 2's answer key: its hand-checked test → weakness → control paths. */
export const keyPath = join(repoRoot, "evals/answer-keys/example-app.json");
