// npm run heldout:check [key path]   (default: batch 1's key)
// Verifies the held-out answer key against GitHub: every repo and commit
// exists, the fix's parent is the stated parent, and every anchor sits on
// its lines in the parent commit. Needs the network; not run in CI.
//
// Repos are cloned without checkout (blobless) into evals/.cache/held-out.
// Nothing from them is run: files are read with `git show` only.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { KnowledgeBase, loadIndex } from "@ward/core";
import {
  loadHeldOut,
  locationProblem,
  offlineProblems,
  repoSlug,
} from "./held-out.js";
import { cacheRoot, heldOutKeyPath } from "./paths.js";

function git(dir: string, args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function ensureClone(url: string): string {
  const dir = join(cacheRoot, "held-out", repoSlug(url).replace("/", "__"));
  if (!existsSync(dir)) {
    mkdirSync(join(cacheRoot, "held-out"), { recursive: true });
    console.error(`cloning ${url}`);
    execFileSync(
      "git",
      [
        "-c",
        "core.symlinks=false",
        "clone",
        "--quiet",
        "--filter=blob:none",
        "--no-checkout",
        "--config",
        "core.symlinks=false",
        url,
        dir,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
  }
  return dir;
}

function ensureCommit(dir: string, sha: string): void {
  try {
    git(dir, ["cat-file", "-e", `${sha}^{commit}`]);
  } catch {
    git(dir, ["fetch", "--quiet", "--filter=blob:none", "origin", sha]);
    git(dir, ["cat-file", "-e", `${sha}^{commit}`]);
  }
}

const key = loadHeldOut(process.argv[2] ?? heldOutKeyPath);
const problems = offlineProblems(key, new KnowledgeBase(loadIndex()));

for (const c of key.cases) {
  try {
    const dir = ensureClone(c.repo);
    ensureCommit(dir, c.fix);
    ensureCommit(dir, c.parent);
    const parentOfFix = git(dir, ["rev-parse", `${c.fix}^1`]).trim();
    if (parentOfFix !== c.parent)
      problems.push(`${c.id}: fix's first parent is ${parentOfFix}`);
    const locations = [...c.anchors, ...c.decoys, ...(c.defensible ?? [])];
    for (const loc of locations) {
      let text: string;
      try {
        text = git(dir, ["show", `${c.parent}:${loc.file}`]);
      } catch {
        problems.push(`${c.id}: ${loc.file} not in the parent commit`);
        continue;
      }
      const p = locationProblem(text, loc);
      if (p) problems.push(`${c.id}: ${loc.file}: ${p}`);
    }
    console.error(`${c.id} checked`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    problems.push(`${c.id}: ${message.split("\n")[0] ?? ""}`);
  }
}

if (problems.length > 0) {
  console.error(`\n${String(problems.length)} problem(s):`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
console.log(
  `held-out: ${String(key.cases.length)} cases OK (batch ${String(key.batch)})`,
);
