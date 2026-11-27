// npm run eval:analyzers-heldout [-- HO-NN …]
// The analyzers-only arm (ADR 0013): Ward's plain-code analyzers on each
// held-out case's parent commit, no LLM. It builds the report the same
// way report_skeleton does, keeps only the rows the analyzers decided,
// and saves them as findings in evals/results/held-out/ for the held-out
// scorer (setup "analyzers"). Needs the clones from heldout:check.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { buildReport } from "@ward/mcp/dist/report-skeleton-tool.js";
import type { Report } from "@ward/report";
import { heldOutCases } from "./held-out.js";
import { repoSlug } from "./held-out.js";
import { heldOutCacheRoot, heldOutResultsRoot } from "./paths.js";
import { reportToFindings } from "./report-findings.js";
import { exportTree } from "./run.js";

/** The Android project folder: the export root or one level down. */
function projectRoot(dir: string): string | null {
  const has = (d: string) =>
    existsSync(join(d, "settings.gradle")) || existsSync(join(d, "settings.gradle.kts"));
  if (has(dir)) return dir;
  for (const e of readdirSync(dir, { withFileTypes: true }))
    if (e.isDirectory() && has(join(dir, e.name))) return join(dir, e.name);
  return null;
}

/** Only the rows Ward's analyzers decided; every other row is left open. */
function analyzerRowsOnly(report: Report): Report {
  return {
    ...report,
    controls: report.controls.map((c) => ({
      ...c,
      checks: c.checks.map((t) =>
        t.by === "analyzer" ? t : { ...t, verdict: null, by: null, evidence: [] },
      ),
    })),
  };
}

const only = new Set(process.argv.slice(2));
const date = new Date().toLocaleDateString("sv-SE");
for (const c of heldOutCases()) {
  if (only.size > 0 && !only.has(c.id)) continue;
  const gitDir = join(heldOutCacheRoot, repoSlug(c.repo).replace("/", "__"));
  if (!existsSync(gitDir)) {
    console.error(`${c.id}: no clone, run heldout:check first`);
    continue;
  }
  const started = Date.now();
  const { dir, parent } = exportTree(gitDir, c.parent, "app");
  try {
    const root = projectRoot(dir);
    const outDir = join(heldOutResultsRoot, `${date}-analyzers-${c.id}-t1`);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    const meta: Record<string, unknown> = {
      setup: "analyzers",
      case: c.id,
      smoke: false,
      modelReported: null,
      result: null,
      commit: c.parent,
    };
    if (root === null) {
      writeFileSync(join(outDir, "meta.json"), JSON.stringify({ ...meta, status: "failed", error: "no settings.gradle" }, null, 2));
      console.error(`${c.id}: no Android project folder`);
      continue;
    }
    const built = await buildReport({ projectRoot: root });
    if ("error" in built) throw new Error(built.error);
    const prefix = relative(dir, root) === "" ? "" : `${relative(dir, root)}/`;
    const { findings } = reportToFindings(analyzerRowsOnly(built.report), prefix);
    writeFileSync(join(outDir, "findings.json"), `${JSON.stringify(findings, null, 2)}\n`);
    writeFileSync(
      join(outDir, "meta.json"),
      `${JSON.stringify({ ...meta, status: "ok", wallMs: Date.now() - started, wardVersion: built.report.stamps.wardVersion }, null, 2)}\n`,
    );
    console.log(`${c.id}: ${String(findings.findings.length)} findings`);
  } catch (e) {
    console.error(`${c.id}: ${(e as Error).message.split("\n")[0] ?? ""}`);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}
