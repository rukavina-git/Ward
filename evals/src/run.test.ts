import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadKey } from "./key.js";
import { keyPath, repoRoot } from "./paths.js";
import {
  buildArgs,
  childEnv,
  copyFixture,
  copyPlugin,
  dirHash,
  parseStream,
  pluginSourceDir,
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

  it("gives read-only tools plus skills, and no web access", () => {
    expect(after(args, "--tools")).toBe("Read,Grep,Glob,Skill");
    expect(after(args, "--disallowedTools")).toBe("WebFetch,WebSearch");
  });

  it("passes the model and schema, and isolates every arm the same way", () => {
    expect(after(args, "--model")).toBe("some-model");
    expect(after(args, "--json-schema")).toBe("{}");
    expect(after(args, "--setting-sources")).toBe("");
    expect(args).toEqual(
      expect.arrayContaining(["--restricted", "--strict-mcp-config"]),
    );
    // --safe-mode hides plugin skills, so no arm uses it.
    expect(args).not.toContain("--safe-mode");
    expect(args).not.toContain("--plugin-dir");
  });

  it("differs between arms only in the plugin folder", () => {
    for (const [name, setup] of Object.entries(setups)) {
      const pluginDir = setup.plugin ? "/tmp/x/plugins/p" : undefined;
      const armArgs = buildArgs(setup, {
        model: "some-model",
        schema: "{}",
        pluginDir,
      });
      const extra = pluginDir
        ? ["--plugin-dir", pluginDir, "--add-dir", pluginDir]
        : [];
      expect(armArgs, name).toEqual([...args, ...extra, ...setup.flags]);
      expect(setup.flags, name).toEqual([]);
    }
  });

  it("has the three baseline arms, each plugin pinned", () => {
    expect(Object.keys(setups)).toEqual(["alone", "checklist", "owasp"]);
    const owasp = setups.owasp?.plugin?.source;
    expect(owasp).toMatchObject({ kind: "git", tag: "v0.2.11" });
    if (owasp?.kind === "git") expect(owasp.commit).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("plugins", () => {
  const work = mkdtempSync(join(tmpdir(), "ward-plugin-test-"));
  afterAll(() => {
    rmSync(work, { recursive: true, force: true });
  });

  it("copies the checklist plugin beside the app copy, not inside it", () => {
    const local = setups.checklist?.plugin?.source;
    if (local?.kind !== "local") throw new Error("checklist is not local");
    const { dir, commit } = pluginSourceDir(local, repoRoot, work);
    expect(commit).toBeNull();
    const parent = join(work, "run");
    const dest = copyPlugin(dir, parent, "masvs-checklist");
    expect(dest).toBe(join(parent, "plugins", "masvs-checklist"));
    expect(relative(join(parent, "penny-jar"), dest).startsWith("..")).toBe(
      true,
    );
    const skill = readFileSync(
      join(dest, "skills/masvs-checklist/SKILL.md"),
      "utf8",
    );
    expect(skill).toContain("MASVS-PRIVACY-4");
    expect(skill).toContain("CC BY-SA 4.0");
    expect(dirHash(dest)).toBe(dirHash(dir));
  });

  it("clones a git plugin at its tag and refuses a moved tag", () => {
    const origin = join(work, "origin");
    mkdirSync(join(origin, "plugins/p"), { recursive: true });
    writeFileSync(join(origin, "plugins/p/x.md"), "x\n");
    const g = (...a: string[]) =>
      execFileSync("git", ["-C", origin, ...a], { encoding: "utf8" }).trim();
    g("init", "-q");
    g("add", ".");
    g("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "one");
    g("tag", "v1");
    const commit = g("rev-parse", "HEAD");
    const source = {
      kind: "git" as const,
      url: `file://${origin}`,
      tag: "v1",
      commit,
      subdir: "plugins/p",
    };
    const cache = join(work, "cache");
    const got = pluginSourceDir(source, repoRoot, cache);
    expect(got).toEqual({ dir: join(cache, "origin@v1", "plugins/p"), commit });
    const copied = copyPlugin(
      join(cache, "origin@v1"),
      join(work, "run2"),
      "p",
    );
    expect(existsSync(join(copied, ".git"))).toBe(false);
    expect(() =>
      pluginSourceDir({ ...source, commit: "0".repeat(40) }, repoRoot, cache),
    ).toThrow(/not the pinned/);
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
      plugins: [
        { name: "p", path: "/home/p", source: "p@inline" },
        { name: "q", path: "builtin" },
      ],
    });
    expect(init).toEqual({ model: "m", plugins: ["p@inline", "q"] });
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
