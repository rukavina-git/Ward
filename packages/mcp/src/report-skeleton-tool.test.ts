import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportSchema, type Report } from "@ward/report";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterAll, describe, expect, it } from "vitest";
import { MASVS_GROUPS } from "./checklist-tool.js";
import { knowledgeBase } from "./knowledge.js";
import {
  reportSkeletonTool,
  TEST_TEXT_BUDGET,
  testTextFor,
} from "./report-skeleton-tool.js";
import { resetServed, servedIds } from "./served.js";
import { serverInfo } from "./server.js";

// Fixtures copied without build/ (gitignored, absent in CI).
function copy(name: string): string {
  const to = mkdtempSync(path.join(tmpdir(), `ward-skel-${name}-`));
  cpSync(
    fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url)),
    to,
    { recursive: true, filter: (s) => !/[/\\]build([/\\]|$)/.test(s) },
  );
  return to;
}
const app = copy("example-app");
const clean = copy("example-app-clean");
const cache = mkdtempSync(path.join(tmpdir(), "ward-skel-cache-"));
const env = { ...process.env };
process.env.WARD_CACHE_DIR = cache;
process.env.WARD_OSV_OFFLINE = "1";
afterAll(() => {
  process.env = env;
  for (const d of [app, clean, cache]) {
    rmSync(d, { recursive: true, force: true });
  }
});

const report = (r: CallToolResult): Report => {
  const text = r.content[0]?.type === "text" ? r.content[0].text : "";
  expect(JSON.parse(text)).toEqual(r.structuredContent);
  return reportSchema.parse(r.structuredContent);
};
const checks = (r: Report) => r.controls.flatMap((c) => c.checks);
const verdictOf = (r: Report, id: string) =>
  new Set(
    checks(r)
      .filter((c) => c.id === id)
      .map((c) => c.verdict),
  );

describe("report_skeleton", () => {
  it("covers every MASVS control with IDs from the pinned index", async () => {
    const r = report(await reportSkeletonTool.handler({ projectRoot: app }));
    const kb = knowledgeBase();
    expect(r.controls.map((c) => c.id)).toEqual(
      kb.checklist().map((c) => c.id),
    );
    expect(r.controls).toHaveLength(24);
    for (const c of checks(r)) {
      expect(kb.get(c.id)?.record.status, c.id).toMatch(/active|placeholder/);
      for (const w of c.maswe)
        expect(kb.get(w)?.record.kind, w).toBe("weakness");
    }
    expect(r.stamps).toMatchObject({
      wardVersion: serverInfo.version,
      mastg: { version: "v2.0.0" },
      osvDate: null,
    });
    expect(r.scope).toEqual({
      groups: [...MASVS_GROUPS],
      profile: null,
      variant: "release",
    });
    expect(r.gaps.outOfScope).toEqual([]);
  });

  it("prefills the example app's planted issues as FAIL", async () => {
    const r = report(await reportSkeletonTool.handler({ projectRoot: app }));
    for (const id of ["MASTG-TEST-0226", "MASTG-TEST-0235", "MASWE-0042"]) {
      expect(verdictOf(r, id), id).toEqual(new Set(["FAIL"]));
    }
    // Offline: no OSV data, so dependencies can't be judged.
    expect(verdictOf(r, "MASTG-TEST-0272")).toEqual(new Set(["MANUAL"]));
    const debuggable = checks(r).find((c) => c.id === "MASTG-TEST-0226");
    expect(debuggable).toMatchObject({ by: "analyzer", analyzer: "manifest" });
    expect(debuggable?.evidence.length).toBeGreaterThan(0);
    expect(
      r.analyzers.find((a) => a.name === "manifest")?.filesInspected,
    ).toContain("app/src/main/AndroidManifest.xml");
  });

  it("prefills the must-exist checks (EA-23: no account deletion)", async () => {
    const bad = report(await reportSkeletonTool.handler({ projectRoot: app }));
    expect(verdictOf(bad, "MASWE-0076")).toEqual(new Set(["FAIL"]));
    expect(verdictOf(bad, "MASWE-0072")).toEqual(new Set(["MANUAL"]));
    expect(verdictOf(bad, "MASWE-0073")).toEqual(new Set(["MANUAL"]));
    const row = checks(bad).find((c) => c.id === "MASWE-0076");
    expect(row).toMatchObject({ by: "analyzer", analyzer: "must_exist" });
    expect(row?.evidence[0]?.quote).toBeTruthy();

    const ok = report(await reportSkeletonTool.handler({ projectRoot: clean }));
    expect(verdictOf(ok, "MASWE-0076")).toEqual(new Set(["NO FINDING"]));
  });

  it("gives the clean twin no FAIL and never NO FINDING over a MANUAL", async () => {
    const r = report(await reportSkeletonTool.handler({ projectRoot: clean }));
    expect(checks(r).filter((c) => c.verdict === "FAIL")).toEqual([]);
    expect(verdictOf(r, "MASTG-TEST-0226")).toEqual(new Set(["NO FINDING"]));
    for (const c of r.controls) {
      const vs = c.checks.map((x) => x.verdict);
      if (c.verdict === "NO FINDING") {
        expect(vs, c.id).not.toContain("MANUAL");
        expect(vs, c.id).not.toContain("NEEDS DYNAMIC");
        expect(vs, c.id).not.toContain(null);
      }
    }
  });

  it("limits the scope to one group and lists the rest as out of scope", async () => {
    const r = report(
      await reportSkeletonTool.handler({
        projectRoot: app,
        group: "MASVS-NETWORK",
      }),
    );
    expect(r.controls.every((c) => c.id.startsWith("MASVS-NETWORK-"))).toBe(
      true,
    );
    expect(r.gaps.outOfScope).toHaveLength(7);
    expect(r.gaps.outOfScope).not.toContain("MASVS-NETWORK");
  });

  it("with a profile, drops controls with nothing in it into outOfScope", async () => {
    const r = report(
      await reportSkeletonTool.handler({ projectRoot: app, profile: "L1" }),
    );
    expect(r.controls.every((c) => c.checks.length > 0)).toBe(true);
    expect(r.gaps.outOfScope.length).toBeGreaterThan(0);
    expect(r.controls.length + r.gaps.outOfScope.length).toBe(24);
  });

  it("returns a tool error for a missing project folder", async () => {
    const r = await reportSkeletonTool.handler({
      projectRoot: path.join(tmpdir(), "no-such-ward-project"),
    });
    expect(r.isError).toBe(true);
  });

  // Claude Code caps an MCP result at about 25k tokens; keep 20% headroom.
  it("stays under 20k tokens for the full scope and per group, both fixtures", async () => {
    for (const projectRoot of [app, clean]) {
      const r = await reportSkeletonTool.handler({ projectRoot });
      expect(JSON.stringify(r.structuredContent).length / 4).toBeLessThan(
        20_000,
      );
      for (const group of MASVS_GROUPS) {
        const g = await reportSkeletonTool.handler({ projectRoot, group });
        expect(
          JSON.stringify(g.structuredContent).length / 4,
          group,
        ).toBeLessThan(20_000);
      }
    }
  });

  it("serves each pending check's deciding text per group, and marks it served", async () => {
    resetServed();
    const full = await reportSkeletonTool.handler({ projectRoot: app });
    expect(full.structuredContent).toHaveProperty("testTextHint");
    expect(full.structuredContent).not.toHaveProperty("testText");
    expect(servedIds().size).toBe(0);

    const r = await reportSkeletonTool.handler({
      projectRoot: app,
      group: "MASVS-NETWORK",
    });
    const s = r.structuredContent as {
      gaps: { pending: string[] };
      testText: Record<
        string,
        { citation: { licence: string }; sections: { section: string }[] }
      >;
      testTextOmitted: string[];
    };
    const pending = [...new Set(s.gaps.pending)];
    expect(pending.length).toBeGreaterThan(0);
    expect(Object.keys(s.testText).sort()).toEqual(pending.sort());
    expect(s.testTextOmitted).toEqual([]);
    for (const [id, t] of Object.entries(s.testText)) {
      expect(t.citation.licence, id).toBeTruthy();
      const names = t.sections.map((x) => x.section.split(" > ")[0]);
      expect(names, id).toContain("Overview");
      for (const n of names) expect(["Overview", "Evaluation"]).toContain(n);
    }
    expect([...servedIds()].sort()).toEqual(pending.sort());
    resetServed();
  });

  it("lists checks past the text budget as omitted, unserved", async () => {
    resetServed();
    const skel = report(await reportSkeletonTool.handler({ projectRoot: app }));
    const many = {
      ...skel,
      gaps: {
        ...skel.gaps,
        pending: checks(skel)
          .filter((c) => c.kind === "test")
          .map((c) => c.id),
      },
    };
    const out = testTextFor(many, "MASVS-STORAGE") as {
      testText: Record<string, { sections: { text: string }[] }>;
      testTextOmitted: string[];
    };
    const used = Object.values(out.testText)
      .flatMap((t) => t.sections)
      .reduce((n, x) => n + x.text.length, 0);
    expect(used).toBeLessThanOrEqual(TEST_TEXT_BUDGET);
    expect(out.testTextOmitted.length).toBeGreaterThan(0);
    for (const id of out.testTextOmitted)
      expect(servedIds().has(id)).toBe(false);
    resetServed();
  });
});
