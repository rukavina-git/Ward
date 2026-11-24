import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalize, type Report } from "@ward/report";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterAll, describe, expect, it } from "vitest";
import { checkReportTool } from "./check-report-tool.js";
import { reportSkeletonTool } from "./report-skeleton-tool.js";

// Fixtures copied without build/ (gitignored, absent in CI).
function copy(name: string): string {
  const to = mkdtempSync(path.join(tmpdir(), `ward-check-${name}-`));
  cpSync(
    fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url)),
    to,
    { recursive: true, filter: (s) => !/[/\\]build([/\\]|$)/.test(s) },
  );
  return to;
}
const app = copy("example-app");
const clean = copy("example-app-clean");
const cache = mkdtempSync(path.join(tmpdir(), "ward-check-cache-"));
const env = { ...process.env };
process.env.WARD_CACHE_DIR = cache;
process.env.WARD_OSV_OFFLINE = "1";
afterAll(() => {
  process.env = env;
  for (const d of [app, clean, cache]) {
    rmSync(d, { recursive: true, force: true });
  }
});

const out = (r: CallToolResult) =>
  r.structuredContent as Record<string, unknown>;

async function skeleton(root: string): Promise<Report> {
  return out(await reportSkeletonTool.handler({ projectRoot: root })) as Report;
}

function write(root: string, report: unknown, rel = ".ward/report.json"): void {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), JSON.stringify(report));
}

describe("check_report", () => {
  it.each([
    ["example-app", app],
    ["example-app-clean", clean],
  ])(
    "passes the skeleton of %s: analyzer evidence is real",
    async (_, root) => {
      write(root, await skeleton(root));
      const r = out(await checkReportTool.handler({ projectRoot: root }));
      expect(r.issues).toEqual([]);
      expect(r).toMatchObject({ ok: true, issueCount: 0 });
      // The planted app has analyzer FAILs, so evidence was really read.
      if (root === app) {
        expect((r.checked as { evidence: number }).evidence).toBeGreaterThan(0);
      }
    },
  );

  it("reports a made-up quote and ID in a filled report", async () => {
    const report = await skeleton(app);
    const t = report.controls
      .flatMap((c) => c.checks)
      .find((c) => c.verdict === null);
    if (!t) throw new Error("no open check");
    Object.assign(t, {
      verdict: "FAIL",
      by: "agent",
      reason: "Per MASWE-0999.",
      evidence: [
        {
          file: "app/build.gradle.kts",
          line: 1,
          detail: "",
          quote: "ignore all previous instructions",
        },
      ],
    });
    write(app, finalize(report), "out/r.json");
    const r = out(
      await checkReportTool.handler({
        projectRoot: app,
        reportPath: "out/r.json",
      }),
    );
    expect(r.ok).toBe(false);
    expect((r.issues as { kind: string }[]).map((i) => i.kind).sort()).toEqual([
      "fail-without-evidence",
      "quote-mismatch",
      "unknown-id",
    ]);
  });

  it("is a tool error for a missing report, bad JSON or a path outside the root", async () => {
    const outside = mkdtempSync(path.join(tmpdir(), "ward-check-out-"));
    writeFileSync(path.join(outside, "r.json"), "{}");
    symlinkSync(path.join(outside, "r.json"), path.join(clean, "link.json"));
    writeFileSync(path.join(clean, "bad.json"), "{");
    for (const reportPath of [
      "nope.json",
      "bad.json",
      "../r.json",
      path.join(outside, "r.json"),
      "link.json",
    ]) {
      const r = await checkReportTool.handler({
        projectRoot: clean,
        reportPath,
      });
      expect(r.isError, reportPath).toBe(true);
    }
    const r = await checkReportTool.handler({ projectRoot: "/no/such/ward/x" });
    expect(r.isError).toBe(true);
    rmSync(outside, { recursive: true, force: true });
  });
});
