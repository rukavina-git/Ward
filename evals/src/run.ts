import { execFileSync, spawn } from "node:child_process";
import {
  createWriteStream,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { finished } from "node:stream/promises";
import { appFolderName } from "./paths.js";
import type { Setup } from "./setups.js";

/** Built-in tools every arm gets: read and search, nothing that runs or writes. */
export const TOOLS = ["Read", "Grep", "Glob"];
/** Ward's repo, answer key included, is on GitHub: no web access. */
export const BLOCKED_TOOLS = ["WebFetch", "WebSearch"];

/** Arguments for `claude`. The prompt goes in on stdin. Never --bare (ADR 0007). */
export function buildArgs(
  setup: Setup,
  opts: { model: string; schema: string },
): string[] {
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--json-schema",
    opts.schema,
    "--model",
    opts.model,
    "--tools",
    TOOLS.join(","),
    "--allowedTools",
    TOOLS.join(","),
    "--disallowedTools",
    BLOCKED_TOOLS.join(","),
    "--permission-mode",
    "dontAsk",
    "--no-session-persistence",
    ...setup.flags,
  ];
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
 * Copies the fixture's committed, tracked files into a fresh temp folder
 * outside the repo: no .git, no build output, no answer key, no docs.
 */
export function copyFixture(
  repoRoot: string,
  fixture: string,
): { dir: string; parent: string } {
  const parent = mkdtempSync(join(tmpdir(), "tmp-"));
  const dir = join(parent, appFolderName);
  mkdirSync(dir);
  const tar = join(parent, "src.tar");
  git(repoRoot, ["archive", "--format=tar", "-o", tar, `HEAD:${fixture}`]);
  execFileSync("tar", ["-xf", tar, "-C", dir]);
  rmSync(tar);
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

function names(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  return (v as unknown[]).map((x) => (isRecord(x) ? (x.name ?? x) : x));
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
