import { McpServer } from "@modelcontextprotocol/server";
import { checklistTool } from "./checklist-tool.js";
import { getCheckTool } from "./get-check-tool.js";
import { searchTool } from "./search-tool.js";

export const serverInfo = { name: "ward", version: "0.1.0" };

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
  return server;
}
