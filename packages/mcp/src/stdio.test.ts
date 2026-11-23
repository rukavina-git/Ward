import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Talks to the built server the way Claude Code does: spawn it, speak
// JSON-RPC over its stdin/stdout. `npm test` builds first (pretest).
const serverPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));

describe("ward MCP server over stdio", () => {
  const client = new Client({ name: "ward-test", version: "0.0.0" });

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      stderr: "ignore",
    });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("lists the three knowledge tools, read-only, with schemas", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "checklist",
      "get_check",
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
