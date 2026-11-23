import { KnowledgeBase, loadIndex } from "@ward/core";
import { describe, expect, it } from "vitest";
import type { Findings } from "./findings.js";
import {
  barOutcome,
  buildGrades,
  candidateFindings,
  decoyFindings,
  tally,
} from "./held-out-score.js";
import type { HeldOutCase } from "./held-out.js";

const base: HeldOutCase = {
  id: "HO-99",
  repo: "https://github.com/example/app",
  parent: "a".repeat(40),
  fix: "b".repeat(40),
  fixDate: "2026-11-01",
  found: "test",
  title: "test case",
  kind: "config",
  severity: "high",
  masvs: ["MASVS-PLATFORM-1"],
  maswe: ["MASWE-0050"],
  mastg: [],
  verdict: "FAIL",
  anchors: [{ file: "app/Main.kt", lines: [100, 104] }],
  fixSummary: "test",
  decoys: [{ file: "app/Other.kt", lines: [10, 10], why: "fine" }],
  afterCutoff: {},
};

function findings(...locs: [string, number][]): Findings {
  return {
    inspected: [],
    findings: locs.map(([file, line]) => ({
      title: `${file}:${String(line)}`,
      category: "security",
      severity: "medium",
      verdict: "FAIL",
      masvs: [],
      maswe: [],
      locations: [{ file, line }],
      explanation: "x",
    })),
  };
}

describe("candidateFindings", () => {
  it("matches the anchor file within 10 lines either side", () => {
    const fs = findings(
      ["app/Main.kt", 90],
      ["app/Main.kt", 114],
      ["app/Main.kt", 89],
      ["app/Main.kt", 115],
      ["app/Other.kt", 100],
    );
    expect(candidateFindings(base, fs)).toEqual([0, 1]);
  });

  it("matches anywhere in the anchor file for an absence", () => {
    const fs = findings(["app/Main.kt", 1], ["app/Other.kt", 100]);
    expect(candidateFindings({ ...base, kind: "absence" }, fs)).toEqual([0]);
  });

  it("finds decoy hits", () => {
    const fs = findings(["app/Other.kt", 15], ["app/Other.kt", 40]);
    expect(decoyFindings(base, fs)).toEqual([0]);
  });
});

describe("buildGrades", () => {
  const kb = new KnowledgeBase(loadIndex());

  it("proposes found/missed and flags IDs missing from the index", () => {
    const fs = findings(["app/Main.kt", 101]);
    const f0 = fs.findings[0];
    if (f0 !== undefined) f0.maswe = ["MASWE-0050", "MASWE-9999"];
    const g = buildGrades("run", base, fs, kb);
    expect(g.found.proposed).toBe("found");
    expect(g.citations.map((c) => [c.id, c.exists, c.proposed])).toEqual([
      ["MASWE-0050", true, null],
      ["MASWE-9999", false, "wrong"],
    ]);
  });

  it("keeps Karlo's labels when regraded", () => {
    const fs = findings(["app/Main.kt", 101]);
    const first = buildGrades("run", base, fs, kb);
    first.found.label = "missed";
    const again = buildGrades("run", base, fs, kb, first);
    expect(again.found.label).toBe("missed");
    expect(tally([again]).missed).toEqual(["HO-99"]);
    expect(tally([again]).harderMissed).toEqual(["HO-99"]);
  });
});

describe("barOutcome", () => {
  const clean = {
    found: 10,
    harderMissed: 0,
    decoysFlagged: 0,
    wrongCitations: 0,
  };

  it("rethink when every Rethink rule holds", () => {
    expect(barOutcome(clean).outcome).toBe("rethink");
    expect(barOutcome({ ...clean, found: 9, wrongCitations: 1 }).outcome).toBe(
      "rethink",
    );
  });

  it("room when any room rule fires", () => {
    expect(barOutcome({ ...clean, found: 7 }).outcome).toBe("room");
    expect(barOutcome({ ...clean, harderMissed: 2, found: 8 }).outcome).toBe(
      "room",
    );
    expect(barOutcome({ ...clean, wrongCitations: 2 }).outcome).toBe("room");
  });

  it("room wins when Rethink would also hold", () => {
    // 9 found, no harder miss, but 2 wrong citations.
    expect(barOutcome({ ...clean, found: 9, wrongCitations: 2 }).outcome).toBe(
      "room",
    );
  });

  it("in between otherwise", () => {
    expect(barOutcome({ ...clean, found: 8 }).outcome).toBe("in between");
    expect(barOutcome({ ...clean, decoysFlagged: 2 }).outcome).toBe(
      "in between",
    );
  });
});
