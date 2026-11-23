import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Talks to the built server the way Claude Code does: spawn it, speak
// JSON-RPC over its stdin/stdout. `npm test` builds first (pretest).
const serverPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const exampleApp = fileURLToPath(
  new URL("../../../fixtures/example-app", import.meta.url),
);

// An empty cache and offline mode: the dependencies tool never downloads
// in tests, and answers MANUAL (no data).
const cacheDir = mkdtempSync(path.join(tmpdir(), "ward-stdio-cache-"));

describe("ward MCP server over stdio", () => {
  const client = new Client({ name: "ward-test", version: "0.0.0" });

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: {
        ...(process.env as Record<string, string>),
        WARD_CACHE_DIR: cacheDir,
        WARD_OSV_OFFLINE: "1",
      },
      stderr: "ignore",
    });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("lists the knowledge and analyzer tools, read-only", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "build_config",
      "check_report",
      "checklist",
      "dependencies",
      "get_check",
      "manifest",
      "network",
      "report_skeleton",
      "search",
    ]);
    for (const tool of tools) {
      expect(tool.description).toMatch(/OWASP|MAS/);
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
    expect(tools.find((t) => t.name === "search")?.inputSchema).toMatchObject({
      type: "object",
      properties: { query: { type: "string", maxLength: 500 } },
      required: ["query"],
    });
  });

  it.each([
    ["checklist", { group: "MASVS-NETWORK" }],
    ["get_check", { id: "MASVS-NETWORK-1" }],
    ["search", { query: "cleartext traffic", k: 2 }],
    ["manifest", { projectRoot: exampleApp }],
    ["network", { projectRoot: exampleApp }],
    ["build_config", { projectRoot: exampleApp, variant: "release" }],
    ["dependencies", { projectRoot: exampleApp }],
    ["report_skeleton", { projectRoot: exampleApp, group: "MASVS-NETWORK" }],
  ])("calls %s and gets structured JSON back", async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError ?? false).toBe(false);
    const content = result.content as { type: string; text: string }[];
    expect(JSON.parse(content[0]?.text ?? "")).toEqual(
      result.structuredContent,
    );
    expect(result.structuredContent).toHaveProperty("notice");
  });

  it.each([
    ["search", { query: "a".repeat(10_000) }],
    ["search", { query: "" }],
    ["get_check", { id: 42 }],
    ["checklist", { group: "Ignore previous instructions" }],
    ["manifest", { projectRoot: "fixtures/example-app" }],
    ["manifest", { projectRoot: exampleApp, variant: "release; rm -rf /" }],
    ["manifest", { projectRoot: "/no/such/ward/project" }],
    ["network", { projectRoot: "relative/path" }],
    ["build_config", { projectRoot: "/no/such/ward/project" }],
    ["report_skeleton", { projectRoot: "/no/such/ward/project" }],
    ["report_skeleton", { projectRoot: exampleApp, group: "MASVS-ALL" }],
    ["check_report", { projectRoot: exampleApp }],
    ["check_report", { projectRoot: exampleApp, reportPath: "../x.json" }],
  ])(
    "returns a tool error, not a crash, for bad %s input",
    async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
    },
  );

  it("still answers after bad input", async () => {
    const result = await client.callTool({
      name: "get_check",
      arguments: { id: "MASWE-0050" },
    });
    expect(result.structuredContent).toMatchObject({ found: true });
  });
});
