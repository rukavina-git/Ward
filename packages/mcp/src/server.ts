import { McpServer } from "@modelcontextprotocol/server";
import { buildConfigTool } from "./build-config-tool.js";
import { checklistTool } from "./checklist-tool.js";
import { dependenciesTool } from "./dependencies-tool.js";
import { getCheckTool } from "./get-check-tool.js";
import { manifestTool } from "./manifest-tool.js";
import { networkTool } from "./network-tool.js";
import { searchTool } from "./search-tool.js";

export const serverInfo = { name: "ward", version: "0.5.0" };

/**
 * Builds the Ward MCP server with its tools registered. No I/O here: the
 * index loads on the first tool call.
 */
export function createServer(): McpServer {
  const server = new McpServer(serverInfo);
  server.registerTool(
    checklistTool.name,
    checklistTool.config,
    checklistTool.handler,
  );
  server.registerTool(
    getCheckTool.name,
    getCheckTool.config,
    getCheckTool.handler,
  );
  server.registerTool(searchTool.name, searchTool.config, searchTool.handler);
  server.registerTool(
    manifestTool.name,
    manifestTool.config,
    manifestTool.handler,
  );
  server.registerTool(
    networkTool.name,
    networkTool.config,
    networkTool.handler,
  );
  server.registerTool(
    buildConfigTool.name,
    buildConfigTool.config,
    buildConfigTool.handler,
  );
  server.registerTool(
    dependenciesTool.name,
    dependenciesTool.config,
    dependenciesTool.handler,
  );
  return server;
}
