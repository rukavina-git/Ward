import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { finished } from "node:stream/promises";
import { appFolderName } from "./paths.js";
import { mcpToolNames, type PluginSource, type Setup } from "./setups.js";

/**
 * Built-in tools every arm gets: read, search and skills, nothing that runs
 * or writes. Every arm gets the same list, so arms differ only in the plugin.
 */
export const TOOLS = ["Read", "Grep", "Glob", "Skill"];
/** Ward's repo, answer key included, is on GitHub: no web access. */
export const BLOCKED_TOOLS = ["WebFetch", "WebSearch"];

/**
 * Isolation every arm shares. Not --safe-mode: it hides plugin skills, so
 * the plugin arms couldn't run. Instead: no user, project or local settings
 * (so no user plugins or hooks), no MCP servers, no auto memory, and
 * --restricted, which confines the file tools to the copy (plus --add-dir).
 */
export const ISOLATION_FLAGS = [
  "--setting-sources",
  "",
  "--strict-mcp-config",
  "--settings",
  JSON.stringify({ autoMemoryEnabled: false }),
  "--restricted",
];

/**
 * The --mcp-config JSON for an arm's MCP server: node on the built entry
 * file, by absolute path. With --strict-mcp-config it is the only server.
 */
export function mcpConfig(
  mcp: NonNullable<Setup["mcp"]>,
  repoRoot: string,
): string {
  return JSON.stringify({
    mcpServers: {
      [mcp.name]: { command: "node", args: [join(repoRoot, mcp.entry)] },
    },
  });
}

/** The built-in tools an arm gets: the common ones plus its extras. */
export function armTools(setup: Setup): string[] {
  return [...TOOLS, ...(setup.extraTools ?? [])];
}

/** Arguments for `claude`. The prompt goes in on stdin. Never --bare (ADR 0007). */
export function buildArgs(
  setup: Setup,
  opts: {
    model: string;
    /** The findings schema; left out for a command task (no structured output). */
    schema?: string | undefined;
    pluginDir?: string | undefined;
    /** From mcpConfig(); required when the arm has an MCP server. */
    mcpConfig?: string | undefined;
  },
): string[] {
  const plugin =
    opts.pluginDir === undefined
      ? []
      : ["--plugin-dir", opts.pluginDir, "--add-dir", opts.pluginDir];
  if ((setup.mcp === undefined) !== (opts.mcpConfig === undefined))
    throw new Error(
      "mcpConfig must be given exactly when the arm has an MCP server",
    );
  const mcp =
    opts.mcpConfig === undefined ? [] : ["--mcp-config", opts.mcpConfig];
  if ((setup.task === undefined) !== (opts.schema !== undefined))
    throw new Error("schema must be given exactly when the arm has no task");
  const tools = armTools(setup);
  const allowed = [
    ...tools,
    ...(setup.mcp === undefined ? [] : mcpToolNames(setup.mcp)),
  ];
  const schema =
    opts.schema === undefined ? [] : ["--json-schema", opts.schema];
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    ...schema,
    "--model",
    opts.model,
    "--tools",
    tools.join(","),
    "--allowedTools",
    allowed.join(","),
    "--disallowedTools",
    BLOCKED_TOOLS.join(","),
    "--permission-mode",
    "dontAsk",
    "--no-session-persistence",
    ...ISOLATION_FLAGS,
    ...plugin,
    ...mcp,
    ...setup.flags,
  ];
}

/**
 * The folder to copy an arm's plugin from. A git plugin is cloned once into
 * the gitignored cache at its tag, and refused if the tag no longer points
 * at the pinned commit.
 */
export function pluginSourceDir(
  source: PluginSource,
  repoRoot: string,
  cacheRoot: string,
): { dir: string; commit: string | null } {
  if (source.kind === "local")
    return { dir: join(repoRoot, source.path), commit: null };
  const leaf = `${basename(source.url).replace(/\.git$/, "")}@${source.tag}`;
  const clone = join(cacheRoot, leaf);
  if (!existsSync(clone)) {
    mkdirSync(cacheRoot, { recursive: true });
    execFileSync(
      "git",
      [
        "-c",
        "advice.detachedHead=false",
        "clone",
        "--quiet",
        "--depth",
        "1",
        "--branch",
        source.tag,
        source.url,
        clone,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
  }
  const commit = git(clone, ["rev-parse", "HEAD"]);
  if (commit !== source.commit) {
    throw new Error(
      `${leaf} is at ${commit}, not the pinned ${source.commit}. Delete ${clone} and check the tag.`,
    );
  }
  return { dir: join(clone, source.subdir), commit };
}

/**
 * Copies a plugin into the temp folder beside the app copy, never inside it,
 * so no repo path reaches the agent. Leaves out any .git folder.
 */
export function copyPlugin(src: string, parent: string, name: string): string {
  const dest = join(parent, "plugins", name);
  cpSync(src, dest, {
    recursive: true,
    filter: (path) => basename(path) !== ".git",
  });
  return dest;
}

/** One hash for a folder's files and their paths, so a result names the exact plugin. */
export function dirHash(dir: string): string {
  const hash = createHash("sha256");
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)))
    .sort();
  for (const file of files) {
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(dir, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

/**
 * The child's environment. Drops API keys, so a run can only use the plan
 * login, and the variables of any Claude Code session the runner was
 * started from, which point at this repo.
 */
export function childEnv(
  env: NodeJS.ProcessEnv,
  cwd: string,
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith("ANTHROPIC_")) continue;
    if (name.startsWith("CLAUDE") && name !== "CLAUDE_CONFIG_DIR") continue;
    if (name === "OLDPWD") continue;
    out[name] = value;
  }
  out.PWD = cwd;
  return out;
}

export interface FixtureState {
  repoCommit: string;
  /** Git's hash of the fixture folder: changes whenever any file in it does. */
  fixtureTree: string;
  dirty: boolean;
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
  }).trim();
}

export function fixtureState(repoRoot: string, fixture: string): FixtureState {
  return {
    repoCommit: git(repoRoot, ["rev-parse", "HEAD"]),
    fixtureTree: git(repoRoot, ["rev-parse", `HEAD:${fixture}`]),
    dirty: git(repoRoot, ["status", "--porcelain", "--", fixture]) !== "",
  };
}

/**
 * Exports one git tree (`<commit>` or `<commit>:<folder>`) into a fresh temp
 * folder outside the repo: files only, no .git, so no history. Symlinks are
 * removed: an untrusted repo could point one outside the copy.
 */
export function exportTree(
  gitDir: string,
  treeish: string,
  folderName: string,
): { dir: string; parent: string; symlinksRemoved: number } {
  const parent = mkdtempSync(join(tmpdir(), "tmp-"));
  const dir = join(parent, folderName);
  mkdirSync(dir);
  const tar = join(parent, "src.tar");
  // Git LFS files stay as their small pointer text (repos like Signal use
  // LFS for binaries): no LFS install needed, nothing extra downloaded.
  const noLfs = [
    "-c",
    "filter.lfs.process=",
    "-c",
    "filter.lfs.smudge=",
    "-c",
    "filter.lfs.required=false",
  ];
  execFileSync(
    "git",
    [...noLfs, "-C", gitDir, "archive", "--format=tar", "-o", tar, treeish],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  execFileSync("tar", ["-xf", tar, "-C", dir]);
  rmSync(tar);
  let symlinksRemoved = 0;
  for (const entry of readdirSync(dir, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isSymbolicLink()) {
      rmSync(join(entry.parentPath, entry.name));
      symlinksRemoved++;
    }
  }
  return { dir, parent, symlinksRemoved };
}

/**
 * Copies the fixture's committed, tracked files into a fresh temp folder
 * outside the repo: no .git, no build output, no answer key, no docs.
 */
export function copyFixture(
  repoRoot: string,
  fixture: string,
): { dir: string; parent: string } {
  const { dir, parent } = exportTree(
    repoRoot,
    `HEAD:${fixture}`,
    appFolderName,
  );
  return { dir, parent };
}

/** Line count of every tracked file in the fixture, keyed by path relative to it. */
export function trackedLineCounts(
  repoRoot: string,
  fixture: string,
): Map<string, number> {
  const files = git(repoRoot, ["ls-files", "-z", "--", fixture])
    .split("\0")
    .filter(Boolean);
  const counts = new Map<string, number>();
  for (const file of files) {
    const text = readFileSync(join(repoRoot, file), "utf8");
    const parts = text.split("\n").length;
    counts.set(
      file.slice(fixture.length + 1),
      text.endsWith("\n") ? parts - 1 : parts,
    );
  }
  return counts;
}

type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The init and result messages of a stream-json transcript. */
export function parseStream(text: string): {
  init: Json | null;
  result: Json | null;
} {
  let init: Json | null = null;
  let result: Json | null = null;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(msg)) continue;
    if (msg.type === "system" && msg.subtype === "init") init = msg;
    else if (msg.type === "result") result = msg;
  }
  return { init, result };
}

function pick(source: Json, keys: string[]): Json {
  const out: Json = {};
  for (const key of keys) if (key in source) out[key] = source[key];
  return out;
}

/** Plugin names with where they came from ("x@builtin", "x@inline"), never paths. */
function names(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  return (v as unknown[]).map((x) =>
    isRecord(x) ? (x.source ?? x.name ?? null) : x,
  );
}

/** What loaded in the session: enough to show it was isolated, no paths. */
export function summarizeInit(init: Json): Json {
  const out = pick(init, [
    "model",
    "claude_code_version",
    "permissionMode",
    "apiKeySource",
    "tools",
    "mcp_servers",
    "slash_commands",
    "skills",
    "agents",
    "output_style",
  ]);
  if ("plugins" in init) out.plugins = names(init.plugins);
  return out;
}

export function summarizeResult(result: Json): Json {
  const out = pick(result, [
    "subtype",
    "is_error",
    "num_turns",
    "duration_ms",
    "duration_api_ms",
    "total_cost_usd",
    "usage",
    "modelUsage",
  ]);
  if (Array.isArray(result.permission_denials)) {
    out.permission_denials = result.permission_denials.length;
  }
  return out;
}

/** Replaces the home folder and the temp copy's folder in anything written to results. */
export function redact(text: string, tempParent: string): string {
  return text.replaceAll(tempParent, "<tmp>").replaceAll(homedir(), "~");
}

export interface ClaudeRun {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
}

export async function runClaude(opts: {
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  prompt: string;
  transcriptPath: string;
  stderrPath: string;
  timeoutMs: number;
}): Promise<ClaudeRun> {
  const started = Date.now();
  const child = spawn("claude", opts.args, {
    cwd: opts.cwd,
    env: opts.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const out = createWriteStream(opts.transcriptPath);
  const err = createWriteStream(opts.stderrPath);
  child.stdout.pipe(out);
  child.stderr.pipe(err);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, opts.timeoutMs);
  const closed = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({ code, signal });
    });
  });
  child.stdin.end(opts.prompt);
  try {
    const { code, signal } = await closed;
    await Promise.all([finished(out), finished(err)]);
    return {
      exitCode: code,
      signal,
      timedOut,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function claudeVersion(): string {
  return execFileSync("claude", ["--version"], { encoding: "utf8" }).trim();
}
