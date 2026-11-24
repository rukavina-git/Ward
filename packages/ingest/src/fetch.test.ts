import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cloneArgs, ensureSource } from "./fetch.js";
import type { PinnedSource } from "./sources.js";

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

const quiet = [
  "-c",
  "user.name=test",
  "-c",
  "user.email=test@example.invalid",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "tag.gpgsign=false",
];

/** A local repo with one commit tagged v1; returns its URL and commit. */
function makeRepo(): { url: string; commit: string } {
  const dir = temp("ward-repo-");
  const git = (args: string[]): string =>
    execFileSync("git", [...quiet, ...args], {
      cwd: dir,
      encoding: "utf8",
    }).trim();
  git(["init", "-q"]);
  writeFileSync(join(dir, "a.md"), "hello\n");
  git(["add", "."]);
  git(["commit", "-q", "-m", "one"]);
  git(["tag", "v1"]);
  return { url: `file://${dir}`, commit: git(["rev-parse", "HEAD"]) };
}

function pinned(url: string, commit: string): PinnedSource {
  return {
    key: "masvs",
    name: "Test",
    repo: url,
    tag: "v1",
    commit,
    licence: "MIT",
  };
}

describe("cloneArgs", () => {
  it("clones one commit at the tag, with symlinks off and the URL after --", () => {
    const args = cloneArgs(pinned("https://example.invalid/r", "x"), "/tmp/d");
    expect(args).toContain("core.symlinks=false");
    expect(
      args.slice(args.indexOf("--branch"), args.indexOf("--branch") + 2),
    ).toEqual(["--branch", "v1"]);
    expect(args.slice(-3)).toEqual([
      "--",
      "https://example.invalid/r",
      "/tmp/d",
    ]);
  });
});

describe("ensureSource", () => {
  it("clones at the pinned commit, then reuses the clone", () => {
    const repo = makeRepo();
    const cache = temp("ward-cache-");
    const dir = ensureSource(pinned(repo.url, repo.commit), cache);
    expect(dir).toBe(join(cache, "masvs@v1"));
    expect(ensureSource(pinned(repo.url, repo.commit), cache)).toBe(dir);
  });

  it("refuses a tag that points at another commit", () => {
    const repo = makeRepo();
    const cache = temp("ward-cache-");
    expect(() => ensureSource(pinned(repo.url, "0".repeat(40)), cache)).toThrow(
      /not the pinned 0{40}/,
    );
  });

  it("refuses a clone whose files were changed", () => {
    const repo = makeRepo();
    const cache = temp("ward-cache-");
    const dir = ensureSource(pinned(repo.url, repo.commit), cache);
    writeFileSync(join(dir, "a.md"), "edited\n");
    expect(() => ensureSource(pinned(repo.url, repo.commit), cache)).toThrow(
      /local changes/,
    );
  });
});
