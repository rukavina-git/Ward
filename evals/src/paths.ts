import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This file sits in evals/src (tests) or evals/dist (CLI): two levels below
// the repo root either way.
export const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const keyPath = join(repoRoot, "evals/answer-keys/example-app.json");
export const heldOutKeyPath = join(repoRoot, "evals/answer-keys/held-out.json");
export const heldOutBarPath = join(repoRoot, "evals/held-out-bar.md");
/** Batch 2 (plan 6 step 03): its own file, so batch 1's pinned hash stays. */
export const heldOutKey2Path = join(
  repoRoot,
  "evals/answer-keys/held-out-2.json",
);
export const heldOutBatch2Path = join(repoRoot, "evals/held-out-batch2.md");
export const taskPromptPath = join(repoRoot, "prompts/eval-task.md");
export const findingsSchemaPath = join(
  repoRoot,
  "prompts/eval-findings.schema.json",
);
export const resultsRoot = join(repoRoot, "evals/results/example-app");
export const heldOutResultsRoot = join(repoRoot, "evals/results/held-out");
/** Gitignored: third-party plugins for eval arms, cloned at pinned tags. */
export const cacheRoot = join(repoRoot, "evals/.cache");

// The leaf folder name the agent sees, the same for both apps.
export const appFolderName = "penny-jar";
/** The folder name for held-out cases: real repos, so nothing to hide. */
export const heldOutFolderName = "app";
/** Blobless clones made by `npm run heldout:check`. */
export const heldOutCacheRoot = join(cacheRoot, "held-out");

export const retrievalQueriesPath = join(
  repoRoot,
  "evals/questions/retrieval.json",
);
export const retrievalResultsRoot = join(repoRoot, "evals/results/retrieval");
