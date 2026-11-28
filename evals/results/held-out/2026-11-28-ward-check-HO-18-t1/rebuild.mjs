// Rebuilds HO-18's report after the dependency reason fix (no agent rerun).
// Only the analyzer-written reason of MASTG-TEST-0272 changes: its advisory
// list is cut to the first 10 plus "and N more (see advisories)", exactly as
// the fixed dependencies.ts now writes it. Everything the agent wrote stays.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = "/Users/karlo/Dev/ward";
const dir = join(repo, "evals/results/held-out/2026-11-28-ward-check-HO-18-t1");
const { reportSchema } = await import(join(repo, "packages/report/dist/schema.js"));
const { reportToFindings } = await import(join(repo, "evals/dist/report-findings.js"));
const { validateFindings } = await import(join(repo, "evals/dist/findings.js"));

const orig = join(dir, "report.original.json");
if (!existsSync(orig)) copyFileSync(join(dir, "report.json"), orig);
const report = JSON.parse(readFileSync(orig, "utf8"));

let changed = 0;
for (const c of report.controls)
  for (const k of c.checks) {
    if (k.reason === null || k.reason.length <= 4000) continue;
    if (k.by !== "analyzer") throw new Error(`${k.id}: long reason not by analyzer`);
    k.reason = k.reason.replace(
      /(in the affected range of (\d+) OSV advisories: )([^.]*?)(\. )/g,
      (_m, head, n, list, tail) => {
        const ids = list.split(", ");
        if (ids.length !== Number(n)) throw new Error("count mismatch");
        if (ids.length <= 10) return head + list + tail;
        return `${head}${ids.slice(0, 10).join(", ")} and ${String(ids.length - 10)} more (see advisories)${tail}`;
      },
    );
    changed++;
    console.log(k.id, "reason now", k.reason.length, "chars");
  }
if (changed !== 1) throw new Error(`expected 1 long reason, got ${changed}`);

const parsed = reportSchema.safeParse(report);
if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
writeFileSync(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

const converted = reportToFindings(parsed.data, "");
const checked = validateFindings(converted.findings);
if (!checked.ok) throw new Error(checked.errors.join("; "));
writeFileSync(join(dir, "findings.json"), `${JSON.stringify(converted.findings, null, 2)}\n`);

const metaPath = join(dir, "meta.json");
const meta = JSON.parse(readFileSync(metaPath, "utf8"));
meta.rebuilt = {
  date: new Date().toISOString(),
  why: "Ward bug, not the agent: the dependencies analyzer named all 67 advisories of jackson-databind 2.9.6, so a merged analyzer reason passed the 4000-character cap. Fixed in code (first 10 named, rest counted); the report was rebuilt from the run's own report with only that analyzer reason shortened. No agent rerun. Karlo's call, 2026-11-28.",
  originalReport: "report.original.json",
  originalFailures: meta.failures,
};
meta.status = "ok";
meta.failures = [];
meta.findings = checked.value.findings.length;
meta.reportInfo = {
  projectPrefix: "",
  counts: parsed.data.counts,
  pending: parsed.data.gaps.pending.length,
  skippedNoEvidence: converted.skippedNoEvidence,
};
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
console.log("ok:", meta.findings, "findings");
