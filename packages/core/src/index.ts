export * from "./records.js";
export * from "./index-file.js";
export * from "./lookup.js";
export * from "./load.js";
export * from "./tokenize.js";
export * from "./bm25.js";
export * from "./search.js";

/**
 * Placeholder so lint, typecheck, test and build have real code to run on.
 * Plan 4 replaces it with the real MCP tools.
 */
export function hello(name: string): string {
  return `Hello, ${name}. Ward is not built yet.`;
}
