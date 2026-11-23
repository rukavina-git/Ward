import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A tool the agent called, and whether its result was an error. */
export interface ToolCall {
  name: string;
  input: Json;
  /** null when no result came back (e.g. the run was cut off). */
  isError: boolean | null;
}

/** Every tool call in a stream-json transcript, paired with its result. */
export function toolCalls(text: string): ToolCall[] {
  const calls = new Map<string, ToolCall>();
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(msg) || !isRecord(msg.message)) continue;
    const content = msg.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content as unknown[]) {
      if (!isRecord(block) || typeof block.type !== "string") continue;
      if (
        msg.type === "assistant" &&
        block.type === "tool_use" &&
        typeof block.id === "string" &&
        typeof block.name === "string"
      ) {
        calls.set(block.id, {
          name: block.name,
          input: isRecord(block.input) ? block.input : {},
          isError: null,
        });
      } else if (
        msg.type === "user" &&
        block.type === "tool_result" &&
        typeof block.tool_use_id === "string"
      ) {
        const call = calls.get(block.tool_use_id);
        if (call !== undefined) call.isError = block.is_error === true;
      }
    }
  }
  return [...calls.values()];
}

/** One call to an arm's MCP server, as logged in meta.json. */
export interface McpCall {
  tool: string;
  input: Json;
  isError: boolean | null;
}

/** The calls to one MCP server, in order, with the server prefix dropped. */
export function mcpCalls(calls: ToolCall[], server: string): McpCall[] {
  const prefix = `mcp__${server}__`;
  return calls
    .filter((c) => c.name.startsWith(prefix))
    .map((c) => ({
      tool: c.name.slice(prefix.length),
      input: c.input,
      isError: c.isError,
    }));
}

/** The folder part of a glob pattern: everything before the first wildcard. */
function globBase(pattern: string): string {
  const parts = pattern.split("/");
  const i = parts.findIndex((p) => /[*?[\]{}]/.test(p));
  return (i === -1 ? parts : parts.slice(0, i)).join("/") || ".";
}

/** The paths a Read, Grep, Glob or Write call touches, as written by the agent. */
function touchedPaths(call: ToolCall): string[] {
  const s = (v: unknown) => (typeof v === "string" && v !== "" ? [v] : []);
  switch (call.name) {
    case "Read":
    case "Write":
      return s(call.input.file_path);
    case "Grep":
      return s(call.input.path);
    case "Glob": {
      const pattern = s(call.input.pattern).map(globBase);
      return [...s(call.input.path), ...pattern];
    }
    default:
      // An MCP analyzer reads the folder it is given, like a Read.
      return call.name.startsWith("mcp__") ? s(call.input.projectRoot) : [];
  }
}

/**
 * Claude Code saves a tool answer too big to show inline to
 * <config>/projects/<slug of the cwd>/<session>/tool-results/<file> and lets
 * the agent read it there. The copy's temp folder is new for every run, so
 * a file in its slug's tool-results holds only this run's own tool answers.
 */
export function isOwnToolResult(path: string, cwd: string): boolean {
  const slug = cwd.replace(/[^A-Za-z0-9]/g, "-");
  const parts = path.split("/");
  const n = parts.length;
  return (
    n >= 6 &&
    parts[n - 2] === "tool-results" &&
    parts[n - 4] === slug &&
    parts[n - 5] === "projects" &&
    !parts.includes("..")
  );
}

function inside(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export interface IsolationExpect {
  /** Tools the init message must list, exactly. */
  tools: string[];
  /** The arm's plugin name, if it has one. */
  plugin: string | undefined;
  /** The arm's MCP server name, if it has one: the only server allowed. */
  mcpServer?: string | undefined;
  /** The agent's working folder: relative paths resolve against it. */
  cwd: string;
  /** Folders the agent may read: the copy and the plugin, each also as its real path. */
  roots: string[];
  /** The copy's real path, as Claude Code reports it in init (`cwd`). */
  realCwd?: string | undefined;
}

export interface IsolationReport {
  failures: string[];
  /** Skills the agent invoked, in order. */
  skillsInvoked: string[];
  /** Reads outside the roots that --restricted refused: logged, not failed. */
  outsideBlocked: number;
}

/**
 * Checks that a run saw only what its arm should: the plan login, no MCP
 * servers, exactly the arm's tools and plugin (plus Claude Code's built-in
 * ones), and no file reads outside the copy and the plugin.
 */
export function checkIsolation(
  init: Json,
  calls: ToolCall[],
  expect: IsolationExpect,
): IsolationReport {
  const failures: string[] = [];
  if (init.apiKeySource !== "none")
    failures.push(`apiKeySource is ${String(init.apiKeySource)}, not none`);

  const mcp = Array.isArray(init.mcp_servers)
    ? (init.mcp_servers as unknown[])
    : null;
  if (expect.mcpServer === undefined) {
    if (mcp === null || mcp.length > 0) failures.push("MCP servers loaded");
  } else {
    const ok =
      mcp !== null &&
      mcp.length === 1 &&
      isRecord(mcp[0]) &&
      mcp[0].name === expect.mcpServer &&
      mcp[0].status === "connected";
    if (!ok)
      failures.push(
        `MCP servers are ${JSON.stringify(mcp)}, not ${expect.mcpServer} connected`,
      );
  }

  const tools = Array.isArray(init.tools) ? (init.tools as unknown[]) : [];
  const want = [...expect.tools].sort();
  const got = tools.map(String).sort();
  if (JSON.stringify(got) !== JSON.stringify(want))
    failures.push(`tools are ${got.join(",")}, not ${want.join(",")}`);

  const plugins = Array.isArray(init.plugins)
    ? (init.plugins as unknown[]).filter(isRecord)
    : [];
  for (const p of plugins) {
    const builtin =
      typeof p.source === "string" && p.source.endsWith("@builtin");
    if (!builtin && p.name !== expect.plugin)
      failures.push(`unexpected plugin ${String(p.name)}`);
  }
  if (
    expect.plugin !== undefined &&
    !plugins.some((p) => p.name === expect.plugin)
  )
    failures.push(`plugin ${expect.plugin} did not load`);

  const skillsInvoked: string[] = [];
  let outsideBlocked = 0;
  for (const call of calls) {
    if (call.name === "Skill" && typeof call.input.skill === "string")
      skillsInvoked.push(call.input.skill);
    if (!expect.tools.includes(call.name)) {
      failures.push(`called ${call.name}, which the arm doesn't have`);
      continue;
    }
    for (const p of touchedPaths(call)) {
      const abs = resolve(expect.cwd, p);
      // An arm may write only in <project>/.ward/, and never the report:
      // Ward's write_report writes that one.
      if (
        call.name === "Write" &&
        (basename(abs) === "report.json" || basename(dirname(abs)) !== ".ward")
      ) {
        failures.push(`Write outside .ward/ or of the report: ${p}`);
        continue;
      }
      if (
        call.name !== "Write" &&
        expect.realCwd !== undefined &&
        isOwnToolResult(abs, expect.realCwd)
      )
        continue;
      if (expect.roots.some((r) => inside(abs, r))) continue;
      if (call.isError === true) outsideBlocked++;
      else failures.push(`${call.name} outside the copy: ${p}`);
    }
  }
  return { failures, skillsInvoked, outsideBlocked };
}
