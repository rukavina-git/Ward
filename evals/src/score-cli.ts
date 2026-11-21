// npm run eval:score -- <result dir>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { validateFindings } from "./findings.js";
import { loadKey, resolveItems } from "./key.js";
import { keyPath, repoRoot } from "./paths.js";
import { fixtureState, trackedLineCounts } from "./run.js";
import { LINE_WINDOW, score, type Grades, type Score } from "./score.js";
import { clean } from "./text.js";

const metaSchema = z.object({
  name: z.string(),
  status: z.string(),
  setup: z.string(),
  app: z.enum(["planted", "clean"]),
  trial: z.number(),
  modelRequested: z.string(),
  modelReported: z.unknown(),
  key: z.object({ keyVersion: z.number() }),
  fixtureTree: z.string(),
});

const gradesSchema = z.object({
  grades: z.array(
    z.object({
      finding: z.number().int(),
      title: z.string(),
      candidates: z.array(z.string()),
      suggested: z.string().nullable(),
      label: z.string().nullable(),
      note: z.string().optional(),
    }),
  ),
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const arg =
  process.argv[2] ?? fail("Usage: npm run eval:score -- <result dir>");
const dir = resolve(process.env.INIT_CWD ?? process.cwd(), arg);
const meta = metaSchema.parse(
  JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")),
);
if (meta.status !== "ok")
  fail(`${meta.name} failed (see meta.json). Failed runs aren't scored.`);

const key = loadKey(keyPath);
if (key.keyVersion !== meta.key.keyVersion) {
  fail(
    `Run used key v${String(meta.key.keyVersion)}, the key is now v${String(key.keyVersion)}.`,
  );
}
const fixture = key.apps[meta.app];
const state = fixtureState(repoRoot, fixture);
if (state.dirty || state.fixtureTree !== meta.fixtureTree) {
  fail(
    `${fixture} differs from the copy the agent saw, so anchors and lines may not match.`,
  );
}

const checked = validateFindings(
  JSON.parse(readFileSync(join(dir, "findings.json"), "utf8")),
);
if (!checked.ok)
  fail(`findings.json is invalid:\n${checked.errors.join("\n")}`);

const gradesPath = join(dir, "grades.json");
const grades: Grades = existsSync(gradesPath)
  ? gradesSchema.parse(JSON.parse(readFileSync(gradesPath, "utf8")))
  : { grades: [] };

const result = score({
  app: meta.app,
  findings: checked.value.findings,
  resolved: resolveItems(key, meta.app, join(repoRoot, fixture)),
  lineCounts: trackedLineCounts(repoRoot, fixture),
  grades,
});

if (result.grades.grades.length > 0) {
  writeFileSync(gradesPath, `${JSON.stringify(result.grades, null, 2)}\n`);
}
writeFileSync(
  join(dir, "score.json"),
  `${JSON.stringify(
    {
      run: meta.name,
      setup: meta.setup,
      trial: meta.trial,
      model: meta.modelReported ?? meta.modelRequested,
      keyVersion: key.keyVersion,
      lineWindow: LINE_WINDOW,
      ...result.score,
    },
    null,
    2,
  )}\n`,
);
console.log(summary(meta.name, result.score));

function pct(n: number): string {
  return `${String(Math.round(n * 100))}%`;
}

function summary(name: string, s: Score): string {
  const lines = [
    `${name}${s.provisional ? `  PROVISIONAL: ${String(s.ungraded)} ungraded` : ""}`,
  ];
  if (s.issues) {
    lines.push(
      `Issues found ${String(s.issues.found)}/${String(s.issues.total)} (${pct(s.issues.recall)}).` +
        ` Missed: ${s.issues.missed.join(", ") || "none"}`,
    );
    const by = (r: Record<string, { found: number; total: number }>) =>
      Object.entries(r)
        .map(([k, t]) => `${k} ${String(t.found)}/${String(t.total)}`)
        .join(", ");
    lines.push(`By difficulty: ${by(s.issues.byDifficulty)}`);
    lines.push(`By MASVS group: ${by(s.issues.byMasvsGroup)}`);
  }
  lines.push(
    `Findings ${String(s.findings)}. False alarms ${String(s.falseAlarms)}` +
      ` (decoys: ${s.decoyHits.join(", ") || "none"}). Real unplanted ${String(s.realUnplanted)}.` +
      ` Generic ${String(s.generic)}. Duplicates ${String(s.duplicates)}.`,
  );
  lines.push(
    `Precision ${s.precision === null ? "n/a" : pct(s.precision)}.` +
      ` Bad citations ${String(s.citations.bad.length)}/${String(s.citations.locations)}.`,
  );
  for (const f of s.perFinding) {
    const o = f.outcome;
    const what =
      o.kind === "issue" || o.kind === "decoy"
        ? `${o.how} ${o.items.join("+")}`
        : o.kind === "ungraded"
          ? `ungraded (${o.candidates.join(", ") || "no candidates"})`
          : `hand ${o.kind}`;
    lines.push(`  #${String(f.index)} ${what}: ${clean(f.title, 80)}`);
  }
  return lines.join("\n");
}
