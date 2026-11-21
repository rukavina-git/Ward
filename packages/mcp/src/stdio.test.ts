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

  it("lists the hello tool with its schema", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["hello"]);
    const tool = tools[0];
    expect(tool?.description).toMatch(/greets a person by name/i);
    expect(tool?.inputSchema).toMatchObject({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    });
  });

  it("calls hello and gets the greeting back", async () => {
    const result = await client.callTool({
      name: "hello",
      arguments: { name: "Karlo" },
    });
    expect(result.isError ?? false).toBe(false);
    expect(result.content).toEqual([
      { type: "text", text: "Hello, Karlo. Ward is not built yet." },
    ]);
  });

  it("returns a tool error, not a crash, for bad input", async () => {
    const result = await client.callTool({
      name: "hello",
      arguments: { name: "" },
    });
    expect(result.isError).toBe(true);
  });
});
