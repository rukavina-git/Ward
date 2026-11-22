import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PinnedSource } from "./sources.js";

/**
 * Arguments for a shallow clone at the tag. Symlinks are checked out as
 * plain text files, so a link in the repo can't point at this disk.
 */
export function cloneArgs(src: PinnedSource, dest: string): string[] {
  return [
    "-c",
    "advice.detachedHead=false",
    "-c",
    "core.symlinks=false",
    "clone",
    "--quiet",
    "--depth",
    "1",
    "--branch",
    src.tag,
    "--",
    src.repo,
    dest,
  ];
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * The source's folder in the cache, cloned on first use. Refuses a clone
 * whose HEAD isn't the pinned commit (a moved tag) or whose files were
 * changed (the output would no longer match the pin). Nothing in the
 * clone is ever run.
 */
export function ensureSource(src: PinnedSource, cacheRoot: string): string {
  const dir = join(cacheRoot, `${src.key}@${src.tag}`);
  if (!existsSync(dir)) {
    mkdirSync(cacheRoot, { recursive: true });
    git(cacheRoot, cloneArgs(src, dir));
  }
  const head = git(dir, ["rev-parse", "HEAD"]);
  if (head !== src.commit) {
    throw new Error(
      `${src.name} ${src.tag} is at ${head}, not the pinned ${src.commit}. Delete ${dir} and check the tag.`,
    );
  }
  if (git(dir, ["status", "--porcelain"]) !== "") {
    throw new Error(`${dir} has local changes. Delete it and run again.`);
  }
  return dir;
}
