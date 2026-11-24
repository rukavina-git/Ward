#!/usr/bin/env node
/**
 * Entry point: serves Ward over stdio. stdout carries the JSON-RPC
 * protocol, so this process must never write anything else there. Logs go
 * to stderr (console.error), which Claude Code keeps in its MCP log.
 */
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer, serverInfo } from "./server.js";

const handle = serveStdio(createServer, {
  onerror: (error) => {
    console.error(`${serverInfo.name}: ${error.message}`);
  },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void handle.close();
  });
}

console.error(`${serverInfo.name} ${serverInfo.version} serving on stdio`);
