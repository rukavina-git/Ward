import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadKey } from "./key.js";
import { keyPath, repoRoot } from "./paths.js";
import {
  buildArgs,
  childEnv,
  copyFixture,
  parseStream,
  redact,
  summarizeInit,
  trackedLineCounts,
} from "./run.js";
import { setups } from "./setups.js";
import { clean } from "./text.js";

const alone = setups.alone;
if (alone === undefined) throw new Error("setup 'alone' is missing");

function after(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

describe("buildArgs", () => {
  const args = buildArgs(alone, { model: "some-model", schema: "{}" });

  it("runs headless on the plan login, never bare or unrestricted", () => {
    expect(args).toContain("-p");
    expect(args).not.toContain("--bare");
    expect(args).not.toContain("--dangerously-skip-permissions");
    expect(after(args, "--permission-mode")).toBe("dontAsk");
  });

  it("gives read-only tools and no web access", () => {
    expect(after(args, "--tools")).toBe("Read,Grep,Glob");
    expect(after(args, "--disallowedTools")).toBe("WebFetch,WebSearch");
  });

  it("passes the model and schema, and isolates setup 'alone'", () => {
    expect(after(args, "--model")).toBe("some-model");
    expect(after(args, "--json-schema")).toBe("{}");
    expect(args).toEqual(
      expect.arrayContaining(["--safe-mode", "--strict-mcp-config"]),
    );
  });
});

describe("childEnv", () => {
  it("drops API keys and the parent session's variables", () => {
    const env = childEnv(
      {
        HOME: "/h",
        PATH: "/bin",
        ANTHROPIC_API_KEY: "k",
        CLAUDECODE: "1",
        CLAUDE_CODE_ENTRYPOINT: "cli",
        CLAUDE_PROJECT_DIR: "/repo",
        CLAUDE_CONFIG_DIR: "/c",
        OLDPWD: "/repo",
      },
      "/tmp/x/penny-jar",
    );
    expect(env).toEqual({
      HOME: "/h",
      PATH: "/bin",
      CLAUDE_CONFIG_DIR: "/c",
      PWD: "/tmp/x/penny-jar",
    });
  });
});

describe("copyFixture", () => {
  const fixture = loadKey(keyPath).apps.planted;
  const copy = copyFixture(repoRoot, fixture);
  afterAll(() => {
    rmSync(copy.parent, { recursive: true, force: true });
  });

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(join(dir, e.name))
        : [relative(copy.dir, join(dir, e.name))],
    );
  }

  it("copies exactly the tracked files into a folder named penny-jar outside the repo", () => {
    expect(copy.dir.endsWith("/penny-jar")).toBe(true);
    expect(relative(repoRoot, copy.dir).startsWith("..")).toBe(true);
    const tracked = execFileSync(
      "git",
      ["-C", repoRoot, "ls-files", "--", fixture],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .map((f) => f.slice(fixture.length + 1));
    expect(walk(copy.dir).sort()).toEqual(tracked.sort());
  });

  it("leaves out git history, build output and the answer key", () => {
    expect(existsSync(join(copy.dir, ".git"))).toBe(false);
    expect(existsSync(join(copy.dir, "app/build"))).toBe(false);
    expect(
      walk(copy.dir).some(
        (f) => f.includes("answer-key") || f.startsWith("evals"),
      ),
    ).toBe(false);
  });
});

describe("trackedLineCounts", () => {
  it("counts lines of tracked files only", () => {
    const counts = trackedLineCounts(repoRoot, loadKey(keyPath).apps.planted);
    expect(counts.get("app/build.gradle.kts")).toBeGreaterThan(10);
    expect([...counts.keys()].some((f) => f.includes("/build/"))).toBe(false);
  });
});

describe("transcripts", () => {
  it("finds the init and result messages and skips other lines", () => {
    const text = [
      JSON.stringify({ type: "system", subtype: "init", model: "m" }),
      "not json",
      JSON.stringify({ type: "assistant" }),
      JSON.stringify({ type: "result", structured_output: { findings: [] } }),
      "",
    ].join("\n");
    const { init, result } = parseStream(text);
    expect(init?.model).toBe("m");
    expect(result?.structured_output).toEqual({ findings: [] });
  });

  it("keeps no paths or session ids from the init message", () => {
    const init = summarizeInit({
      type: "system",
      cwd: "/somewhere",
      session_id: "s",
      model: "m",
      plugins: [{ name: "p", path: "/home/p" }],
    });
    expect(init).toEqual({ model: "m", plugins: ["p"] });
  });

  it("redacts the home folder and the temp copy", () => {
    expect(redact(`${homedir()}/x /tmp/abc/penny-jar`, "/tmp/abc")).toBe(
      "~/x <tmp>/penny-jar",
    );
  });
});

describe("clean", () => {
  it("replaces control characters and cuts long text", () => {
    expect(clean("a\u001b[2Jb\nc")).toBe("a [2Jb c");
    expect(clean("abcdef", 4)).toBe("abc…");
  });
});
