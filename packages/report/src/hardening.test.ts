import { KnowledgeBase, loadIndex } from "@ward/core";
import { describe, expect, it } from "vitest";
import { HARDENING_TESTS, isHardening } from "./hardening.js";
import { finalize, rollupControl } from "./rollup.js";
import { summaryText } from "./fills.js";
import { REPORT_SCHEMA, type Check } from "./schema.js";

const kb = new KnowledgeBase(loadIndex());

const row = (id: string, extra: Partial<Check> = {}): Check => ({
  id,
  kind: "test",
  title: `test ${id}`,
  status: "active",
  maswe: [],
  verdict: null,
  by: null,
  reason: null,
  evidence: [],
  filesInspected: [],
  ...extra,
});

describe("HARDENING_TESTS", () => {
  it("lists only tests in the index whose profiles have neither L1 nor P", () => {
    for (const id of HARDENING_TESTS) {
      const r = kb.get(id)?.record;
      expect(r, id).toBeDefined();
      const p = r?.fields.profiles;
      expect(Array.isArray(p) && p.length > 0, id).toBe(true);
      expect(p, id).not.toContain("L1");
      expect(p, id).not.toContain("P");
    }
  });

  it("keeps concrete misconfigurations out (debuggable, WebView debugging)", () => {
    expect(HARDENING_TESTS.has("MASTG-TEST-0226")).toBe(false);
    expect(HARDENING_TESTS.has("MASTG-TEST-0227")).toBe(false);
  });

  it("applies only when no profile is given", () => {
    expect(isHardening("MASTG-TEST-0324", null)).toBe(true);
    expect(isHardening("MASTG-TEST-0324", "R")).toBe(false);
    expect(isHardening("MASTG-TEST-0216", null)).toBe(false);
  });
});

describe("rollup with hardening checks", () => {
  const fail = (id: string, hardening = false) =>
    row(id, {
      verdict: "FAIL",
      by: "agent",
      reason: "r",
      ...(hardening && { hardening }),
    });
  const clean = (id: string) =>
    row(id, { verdict: "NO FINDING", by: "agent", reason: "r" });

  it("leaves a hardening FAIL out of a mixed control's verdict", () => {
    expect(rollupControl({ checks: [clean("A"), fail("H", true)] })).toBe(
      "NO FINDING",
    );
    expect(rollupControl({ checks: [fail("A"), fail("H", true)] })).toBe(
      "FAIL",
    );
  });

  it("reads FAIL as MANUAL in a control with only hardening checks", () => {
    expect(rollupControl({ checks: [fail("H", true)] })).toBe("MANUAL");
    expect(
      rollupControl({ checks: [row("H", { hardening: true })] }),
    ).toBeNull();
  });

  it("counts hardening checks apart and lists them in the summary", () => {
    const r = finalize({
      schema: REPORT_SCHEMA,
      notice: "n",
      scope: { groups: ["MASVS-X"], profile: null, variant: "release" },
      stamps: { wardVersion: "0", mastg: null, osvDate: null },
      analyzers: [],
      controls: [
        {
          id: "C-1",
          title: "one",
          verdict: null,
          checks: [clean("A"), fail("MASTG-TEST-0324", true)],
        },
      ],
      gaps: { outOfScope: [] },
    });
    expect(r.counts.checks).toEqual({ "NO FINDING": 1 });
    expect(r.counts.hardening).toEqual({ FAIL: 1 });
    expect(r.controls[0]?.verdict).toBe("NO FINDING");
    const text = summaryText(r, [], []);
    expect(text).toMatch(/Hardening not present .*: 1\n {2}MASTG-TEST-0324/);
    expect(text).not.toMatch(/FAIL \(by finding\)/);
  });
});
