import { describe, expect, it } from "vitest";
import {
  checkIsolation,
  mcpCalls,
  toolCalls,
  type IsolationExpect,
  type ToolCall,
} from "./isolation.js";

const tools = ["Read", "Grep", "Glob", "Skill", "StructuredOutput"];

const goodInit = {
  apiKeySource: "none",
  mcp_servers: [],
  tools: ["Glob", "Grep", "Read", "Skill", "StructuredOutput"],
  plugins: [
    { name: "masvs-checklist", source: "masvs-checklist@inline" },
    { name: "cc-plugin-telemetry", source: "cc-plugin-telemetry@builtin" },
  ],
};

const expectChecklist: IsolationExpect = {
  tools,
  plugin: "masvs-checklist",
  cwd: "/tmp/x/penny-jar",
  roots: [
    "/tmp/x/penny-jar",
    "/tmp/x/plugins/masvs-checklist",
    "/private/tmp/x/penny-jar",
    "/private/tmp/x/plugins/masvs-checklist",
  ],
};

function call(name: string, input: Record<string, unknown>, isError = false) {
  return { name, input, isError } satisfies ToolCall;
}

describe("toolCalls", () => {
  it("pairs each tool use with its result and skips other lines", () => {
    const text = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "hi" },
            {
              type: "tool_use",
              id: "a",
              name: "Read",
              input: { file_path: "x" },
            },
            { type: "tool_use", id: "b", name: "Glob", input: {} },
          ],
        },
      }),
      "not json",
      JSON.stringify({
        type: "user",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "a", is_error: true },
            { type: "tool_result", tool_use_id: "zzz" },
          ],
        },
      }),
    ].join("\n");
    expect(toolCalls(text)).toEqual([
      { name: "Read", input: { file_path: "x" }, isError: true },
      { name: "Glob", input: {}, isError: null },
    ]);
  });
});

describe("checkIsolation", () => {
  it("passes a clean run and records the skills it invoked", () => {
    const report = checkIsolation(
      goodInit,
      [
        call("Skill", { skill: "masvs-checklist:masvs-checklist" }),
        call("Read", { file_path: "app/build.gradle.kts" }),
        call("Read", { file_path: "/private/tmp/x/penny-jar/a.kt" }),
        call("Read", {
          file_path: "/tmp/x/plugins/masvs-checklist/skills/s/SKILL.md",
        }),
        call("Glob", { pattern: "**/*.kt" }),
        call("Grep", { pattern: "http:", path: "/tmp/x/penny-jar/app" }),
        call("StructuredOutput", {}),
      ],
      expectChecklist,
    );
    expect(report).toEqual({
      failures: [],
      skillsInvoked: ["masvs-checklist:masvs-checklist"],
      outsideBlocked: 0,
    });
  });

  it("fails an API key, an MCP server, other tools and a stray plugin", () => {
    const report = checkIsolation(
      {
        apiKeySource: "ANTHROPIC_API_KEY",
        mcp_servers: [{ name: "ward" }],
        tools: [...goodInit.tools, "Bash"],
        plugins: [
          ...goodInit.plugins,
          { name: "other", source: "other@marketplace" },
        ],
      },
      [],
      expectChecklist,
    );
    expect(report.failures).toHaveLength(4);
    expect(report.failures.join("\n")).toMatch(/apiKeySource/);
    expect(report.failures.join("\n")).toMatch(/MCP/);
    expect(report.failures.join("\n")).toMatch(/tools are/);
    expect(report.failures.join("\n")).toMatch(/unexpected plugin other/);
  });

  it("fails when the arm's plugin didn't load, or an arm without one gets one", () => {
    const missing = checkIsolation(
      { ...goodInit, plugins: [goodInit.plugins[1]] },
      [],
      expectChecklist,
    );
    expect(missing.failures).toEqual(["plugin masvs-checklist did not load"]);
    const extra = checkIsolation(goodInit, [], {
      ...expectChecklist,
      plugin: undefined,
    });
    expect(extra.failures).toEqual(["unexpected plugin masvs-checklist"]);
  });

  it("fails a read outside the copy that went through", () => {
    for (const c of [
      call("Read", { file_path: "/Users/someone/ward/evals/key.json" }),
      call("Read", { file_path: "../../secret" }),
      call("Grep", { pattern: "x", path: "/" }),
      call("Glob", { pattern: "/Users/*/ward/**" }),
      call("Glob", { pattern: "../**/*.json" }),
    ]) {
      const report = checkIsolation(goodInit, [c], expectChecklist);
      expect(report.failures).toHaveLength(1);
      expect(report.failures[0]).toMatch(/outside the copy/);
    }
  });

  it("counts reads outside that --restricted refused, without failing", () => {
    const report = checkIsolation(
      goodInit,
      [call("Read", { file_path: "/etc/hosts" }, true)],
      expectChecklist,
    );
    expect(report).toMatchObject({ failures: [], outsideBlocked: 1 });
  });

  it("fails a call to a tool the arm doesn't have", () => {
    const report = checkIsolation(
      goodInit,
      [call("Bash", { command: "ls" })],
      expectChecklist,
    );
    expect(report.failures).toEqual([
      "called Bash, which the arm doesn't have",
    ]);
  });

  const wardTools = [...tools, "mcp__ward__search", "mcp__ward__manifest"];
  const wardInit = {
    ...goodInit,
    plugins: [goodInit.plugins[1]],
    mcp_servers: [{ name: "ward", status: "connected" }],
    tools: wardTools,
  };
  const expectWard: IsolationExpect = {
    ...expectChecklist,
    tools: wardTools,
    plugin: undefined,
    mcpServer: "ward",
  };

  it("passes the ward arm with its server connected and projectRoot in the copy", () => {
    const report = checkIsolation(
      wardInit,
      [
        call("mcp__ward__search", { query: "backup" }),
        call("mcp__ward__manifest", { projectRoot: "/tmp/x/penny-jar" }),
      ],
      expectWard,
    );
    expect(report.failures).toEqual([]);
  });

  it("fails a second server, a missing one, a failed one", () => {
    for (const servers of [
      [
        { name: "ward", status: "connected" },
        { name: "other", status: "connected" },
      ],
      [],
      [{ name: "ward", status: "failed" }],
    ]) {
      const report = checkIsolation(
        { ...wardInit, mcp_servers: servers },
        [],
        expectWard,
      );
      expect(report.failures).toHaveLength(1);
      expect(report.failures[0]).toMatch(/MCP servers are/);
    }
  });

  it("fails a Ward analyzer pointed outside the copy", () => {
    const report = checkIsolation(
      wardInit,
      [call("mcp__ward__manifest", { projectRoot: "/Users/someone/ward" })],
      expectWard,
    );
    expect(report.failures).toEqual([
      "mcp__ward__manifest outside the copy: /Users/someone/ward",
    ]);
  });

  it("lets Write reach only .ward/ inside the copy, never the report", () => {
    const withWrite = { ...expectChecklist, tools: [...tools, "Write"] };
    const report = checkIsolation(
      goodInit,
      [
        call("Write", { file_path: "/tmp/x/penny-jar/.ward/fills.json" }),
        call("Write", { file_path: "sub/.ward/fills.json" }),
        call("Write", { file_path: "/tmp/x/penny-jar/app/build.gradle.kts" }),
        call("Write", { file_path: "/tmp/x/penny-jar/.ward/report.json" }),
        call("Write", { file_path: "/tmp/elsewhere/.ward/fills.json" }),
      ],
      withWrite,
    );
    expect(report.failures).toEqual([
      "tools are Glob,Grep,Read,Skill,StructuredOutput, not Glob,Grep,Read,Skill,StructuredOutput,Write",
      "Write outside .ward/ or of the report: /tmp/x/penny-jar/app/build.gradle.kts",
      "Write outside .ward/ or of the report: /tmp/x/penny-jar/.ward/report.json",
      "Write outside the copy: /tmp/elsewhere/.ward/fills.json",
    ]);
  });
});

describe("mcpCalls", () => {
  it("lists one server's calls in order, without the prefix", () => {
    expect(
      mcpCalls(
        [
          call("Read", { file_path: "a" }),
          call("mcp__ward__search", { query: "webview" }),
          call("mcp__other__x", {}),
          call("mcp__ward__manifest", { projectRoot: "/tmp/x" }, true),
        ],
        "ward",
      ),
    ).toEqual([
      { tool: "search", input: { query: "webview" }, isError: false },
      { tool: "manifest", input: { projectRoot: "/tmp/x" }, isError: true },
    ]);
  });

  it("lets the run read Claude Code's saved copy of its own tool answers", () => {
    const cfg = "/Users/someone/.claude/projects";
    const own = `${cfg}/-private-tmp-x-penny-jar/abc/tool-results/mcp-ward-1.txt`;
    const other = `${cfg}/-Users-someone-ward/abc/tool-results/mcp-ward-1.txt`;
    const report = checkIsolation(
      goodInit,
      [
        call("Grep", { path: own }),
        call("Read", { file_path: other }),
        call("Write", { file_path: own }),
      ],
      { ...expectChecklist, realCwd: "/private/tmp/x/penny-jar" },
    );
    expect(report.failures).toEqual([
      `Read outside the copy: ${other}`,
      `called Write, which the arm doesn't have`,
    ]);
  });
});
