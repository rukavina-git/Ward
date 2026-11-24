import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WARD_VERSION } from "./version.js";

// The installable plugin ships the server as one esbuild bundle
// (npm run plugin:build). Spawn it from a folder outside the repo, as a
// user's Claude Code would, and check it is the current server and finds
// its index. CI also rebuilds it and fails on a diff.
const plugin = (rel: string) =>
  fileURLToPath(new URL(`../../../plugin/${rel}`, import.meta.url));
const dist = fileURLToPath(new URL("../dist/index.js", import.meta.url));

async function connect(entry: string): Promise<Client> {
  const client = new Client({ name: "ward-test", version: "0.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      cwd: "/",
      env: {
        ...(process.env as Record<string, string>),
        WARD_OSV_OFFLINE: "1",
      },
      stderr: "ignore",
    }),
  );
  return client;
}

describe("plugin bundle", () => {
  let bundle: Client;
  let built: Client;

  beforeAll(async () => {
    [bundle, built] = await Promise.all([
      connect(plugin("server/index.mjs")),
      connect(dist),
    ]);
  });

  afterAll(async () => {
    await Promise.all([bundle.close(), built.close()]);
  });

  it("is the current server version with the same tools", async () => {
    expect(bundle.getServerVersion()?.version).toBe(WARD_VERSION);
    const names = async (c: Client) =>
      (await c.listTools()).tools.map((t) => t.name).sort();
    expect(await names(bundle)).toEqual(await names(built));
  });

  it("answers from its own copy of the pinned index", async () => {
    expect(readFileSync(plugin("data/index.json"))).toEqual(
      readFileSync(
        fileURLToPath(new URL("../../core/data/index.json", import.meta.url)),
      ),
    );
    const result = await bundle.callTool({
      name: "checklist",
      arguments: { group: "MASVS-NETWORK" },
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.stringify(result.structuredContent)).toContain(
      "MASVS-NETWORK-1",
    );
  });

  it("ships the skill and its MCP config", () => {
    expect(readFileSync(plugin("skills/check/SKILL.md"), "utf8")).toBe(
      readFileSync(
        fileURLToPath(
          new URL("../../../prompts/ward-check/SKILL.md", import.meta.url),
        ),
        "utf8",
      ),
    );
    const mcp = JSON.parse(readFileSync(plugin(".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { args: string[] }>;
    };
    expect(mcp.mcpServers.ward?.args).toEqual([
      "${CLAUDE_PLUGIN_ROOT}/server/index.mjs",
    ]);
    const manifest = JSON.parse(
      readFileSync(plugin(".claude-plugin/plugin.json"), "utf8"),
    ) as { version: string };
    expect(manifest.version).toBe(WARD_VERSION);
  });
});
