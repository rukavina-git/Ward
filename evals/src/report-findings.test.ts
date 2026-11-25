import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Check, Report } from "@ward/report";
import { afterAll, describe, expect, it } from "vitest";
import { validateFindings } from "./findings.js";
import {
  findReport,
  projectPrefix,
  reportToFindings,
} from "./report-findings.js";

function check(over: Partial<Check> & Pick<Check, "id">): Check {
  return {
    kind: "test",
    title: `Title of ${over.id}`,
    status: "active",
    maswe: [],
    verdict: null,
    by: null,
    reason: null,
    evidence: [],
    filesInspected: [],
    ...over,
  };
}

function report(controls: Report["controls"]): Report {
  return {
    schema: "ward-report/1",
    notice: "",
    scope: { groups: [], profile: null, variant: "release" },
    stamps: { wardVersion: "0", mastg: null, osvDate: null },
    analyzers: [
      { name: "manifest", filesInspected: ["app/x.xml"], limits: [] },
    ],
    controls,
    counts: { controls: {}, checks: {} },
    gaps: { pending: [], manual: [], needsDynamic: [], outOfScope: [] },
  };
}

const ev = (file: string, line: number) => ({ file, line, detail: "why" });

describe("reportToFindings", () => {
  const shared = check({
    id: "MASTG-TEST-0001",
    verdict: "FAIL",
    by: "agent",
    maswe: ["MASWE-0005"],
    reason: "bad",
    evidence: [ev("app/A.kt", 12)],
    filesInspected: ["app/A.kt"],
  });
  const r = report([
    {
      id: "MASVS-STORAGE-1",
      title: "",
      verdict: "FAIL",
      checks: [
        shared,
        check({ id: "MASTG-TEST-0002", verdict: "FAIL", by: "agent" }),
        check({
          id: "MASTG-TEST-0003",
          verdict: "NO FINDING",
          evidence: [ev("app/B.kt", 1)],
        }),
        check({ id: "MASTG-TEST-0004", verdict: "MANUAL", by: "owasp" }),
      ],
    },
    {
      id: "MASVS-PRIVACY-1",
      title: "",
      verdict: "FAIL",
      checks: [
        shared,
        check({
          id: "MASWE-0108",
          kind: "weakness",
          verdict: "NEEDS DYNAMIC",
          evidence: [ev("app/C.kt", 3)],
        }),
      ],
    },
  ]);

  it("makes one finding per evidenced check, controls merged", () => {
    const { findings, skippedNoEvidence } = reportToFindings(r);
    expect(findings.findings).toHaveLength(2);
    const [first, second] = findings.findings;
    expect(first).toMatchObject({
      title: "MASTG-TEST-0001: Title of MASTG-TEST-0001",
      verdict: "FAIL",
      category: "privacy",
      masvs: ["MASVS-PRIVACY-1", "MASVS-STORAGE-1"],
      maswe: ["MASWE-0005"],
      locations: [{ file: "app/A.kt", line: 12 }],
    });
    expect(first?.explanation).toContain("app/A.kt:12: why");
    expect(second).toMatchObject({
      verdict: "NEEDS DYNAMIC",
      maswe: ["MASWE-0108"],
      locations: [{ file: "app/C.kt", line: 3 }],
    });
    expect(skippedNoEvidence).toEqual({ fail: 1, other: 1 });
    expect(findings.inspected).toEqual(["app/A.kt", "app/x.xml"]);
    expect(validateFindings(findings).ok).toBe(true);
  });

  it("prefixes paths when the project is in a subfolder", () => {
    const { findings } = reportToFindings(r, "android/");
    expect(findings.findings[0]?.locations[0]?.file).toBe("android/app/A.kt");
    expect(findings.inspected).toContain("android/app/x.xml");
  });
});

describe("reportToFindings and hardening", () => {
  it("leaves hardening rows out of the findings", () => {
    const r = report([
      {
        id: "MASVS-RESILIENCE-1",
        title: "",
        verdict: "MANUAL",
        checks: [
          check({
            id: "MASTG-TEST-0324",
            verdict: "FAIL",
            by: "agent",
            reason: "no root detection",
            evidence: [ev("app/A.kt", 3)],
            hardening: true,
          }),
        ],
      },
    ]);
    expect(reportToFindings(r).findings.findings).toEqual([]);
  });
});

describe("findReport", () => {
  const work = mkdtempSync(join(tmpdir(), "ward-find-report-"));
  afterAll(() => {
    rmSync(work, { recursive: true, force: true });
  });
  const put = (rel: string) => {
    mkdirSync(join(work, rel, ".ward"), { recursive: true });
    writeFileSync(join(work, rel, ".ward", "report.json"), "{}");
  };

  it("finds one report at the root or a level down, else null", () => {
    expect(findReport(work)).toBeNull();
    put("android");
    const found = findReport(work);
    expect(found).toBe(join(work, "android", ".ward", "report.json"));
    expect(projectPrefix(work, found ?? "")).toBe("android/");
    put("");
    expect(findReport(work)).toBeNull();
    expect(projectPrefix(work, join(work, ".ward", "report.json"))).toBe("");
  });
});
