// What other packages (the evals) use from ingest: the embedding model and
// the vectors file. The ingest itself runs from cli.ts and embed-cli.ts.
export * from "./embed.js";
export * from "./model.js";
export * from "./vectors-file.js";
export { cacheRoot as ingestCacheRoot } from "./paths.js";
