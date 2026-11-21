import { McpServer } from "@modelcontextprotocol/server";
import { helloTool } from "./hello-tool.js";

export const serverInfo = { name: "ward", version: "0.0.0" };

/** Builds the Ward MCP server with its tools registered. No I/O here. */
export function createServer(): McpServer {
  const server = new McpServer(serverInfo);
  server.registerTool(helloTool.name, helloTool.config, helloTool.handler);
  return server;
}
