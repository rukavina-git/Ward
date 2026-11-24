// npm run eval:summary
// Reads every non-smoke run for the current key and writes summary.json and
// the tables in baseline.md (the hand-written note there is kept).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { loadKey } from "./key.js";
import { keyPath, resultsRoot } from "./paths.js";
import { setups } from "./setups.js";
import {
  renderTables,
  spliceTables,
  summarize,
  type RunRecord,
} from "./summary.js";

const metaSchema = z.object({
  name: z.string(),
  smoke: z.boolean(),
  setup: z.string(),
  app: z.enum(["planted", "clean"]),
  trial: z.number().int(),
  status: z.string(),
  modelRequested: z.string(),
  modelReported: z.unknown(),
  claudeCodeVersion: z.string(),
  key: z.object({ keyVersion: z.number() }),
  wallMs: z.number(),
  plugin: z.object({ name: z.string() }).nullable().optional(),
  skillsInvoked: z.array(z.string()).nullable().optional(),
  result: z
    .object({
      total_cost_usd: z.number().optional(),
      usage: z.record(z.string(), z.unknown()).optional(),
    })
    .nullable(),
});

const scoreSchema = z.object({
  provisional: z.boolean(),
  findings: z.number(),
  falseAlarms: z.number(),
  decoyHits: z.array(z.string()),
  realUnplanted: z.number(),
  generic: z.number(),
  duplicates: z.number(),
  precision: z.number().nullable(),
  citations: z.object({ locations: z.number(), bad: z.array(z.unknown()) }),
  issues: z
    .object({
      found: z.number(),
      total: z.number(),
      missed: z.array(z.string()),
    })
    .optional(),
});

function tokens(usage: Record<string, unknown> | undefined): number | null {
  if (usage === undefined) return null;
  const keys = [
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
  ];
  return keys.reduce((sum, k) => {
    const v = usage[k];
    return sum + (typeof v === "number" ? v : 0);
  }, 0);
}

const key = loadKey(keyPath);
const runs: RunRecord[] = [];
let skipped = 0;
for (const entry of readdirSync(resultsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(resultsRoot, entry.name);
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) continue;
  const meta = metaSchema.parse(JSON.parse(readFileSync(metaPath, "utf8")));
  if (meta.smoke || meta.key.keyVersion !== key.keyVersion) {
    skipped++;
    continue;
  }
  const scorePath = join(dir, "score.json");
  const s = existsSync(scorePath)
    ? scoreSchema.parse(JSON.parse(readFileSync(scorePath, "utf8")))
    : null;
  runs.push({
    name: meta.name,
    setup: meta.setup,
    app: meta.app,
    trial: meta.trial,
    failed: meta.status !== "ok",
    model:
      typeof meta.modelReported === "string"
        ? meta.modelReported
        : meta.modelRequested,
    claudeCodeVersion: meta.claudeCodeVersion,
    wallMs: meta.wallMs,
    tokens: tokens(meta.result?.usage),
    apiUsd: meta.result?.total_cost_usd ?? null,
    plugin: meta.plugin?.name ?? null,
    skillsInvoked: meta.skillsInvoked ?? [],
    score:
      s === null
        ? null
        : {
            ...s,
            citations: {
              locations: s.citations.locations,
              bad: s.citations.bad.length,
            },
          },
  });
}

const unscored = runs.filter((r) => !r.failed && r.score === null);
for (const r of unscored)
  console.error(`Not scored yet: ${r.name} (npm run eval:score)`);

const summary = summarize(runs, Object.keys(setups));
writeFileSync(
  join(resultsRoot, "summary.json"),
  `${JSON.stringify({ keyVersion: key.keyVersion, runs: runs.length, ...summary }, null, 2)}\n`,
);
const mdPath = join(resultsRoot, "baseline.md");
const existing = existsSync(mdPath) ? readFileSync(mdPath, "utf8") : null;
const tables = renderTables(summary);
writeFileSync(mdPath, spliceTables(existing, tables));
console.log(tables);
console.error(
  `\n${String(runs.length)} runs (${String(skipped)} smoke or old-key skipped). Wrote summary.json and baseline.md.`,
);
