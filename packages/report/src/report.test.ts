import type { ChecklistControl } from "@ward/core";
import { describe, expect, it } from "vitest";
import { finalize, rollupControl, worst } from "./rollup.js";
import {
  reportJsonSchema,
  reportSchema,
  type Check,
  type Verdict,
} from "./schema.js";
import { buildSkeleton, filesIn, type AnalyzerInput } from "./skeleton.js";

const check = (verdict: Verdict | null): Pick<Check, "verdict"> => ({
  verdict,
});
const roll = (...vs: (Verdict | null)[]) =>
  rollupControl({ checks: vs.map(check) as Check[] });

describe("rollup", () => {
  it("orders verdicts worst first", () => {
    expect(worst(["N/A", "NO FINDING", "NEEDS DYNAMIC"])).toBe("NEEDS DYNAMIC");
    expect(worst(["NO FINDING", "MANUAL", "NEEDS DYNAMIC"])).toBe("MANUAL");
    expect(worst(["MANUAL", "FAIL"])).toBe("FAIL");
    expect(worst([])).toBeUndefined();
  });

  it("never lets NO FINDING cover a MANUAL or NEEDS DYNAMIC", () => {
    expect(roll("NO FINDING", "MANUAL")).toBe("MANUAL");
    expect(roll("NO FINDING", "NEEDS DYNAMIC")).toBe("NEEDS DYNAMIC");
    expect(roll("NO FINDING", "N/A")).toBe("NO FINDING");
    expect(roll("N/A", "N/A")).toBe("N/A");
  });

  it("FAIL wins over pending; otherwise pending stays pending", () => {
    expect(roll(null, "FAIL")).toBe("FAIL");
    expect(roll(null, "NO FINDING")).toBeNull();
    expect(roll(null, "MANUAL")).toBeNull();
  });

  it("a control with no checks is MANUAL", () => {
    expect(roll()).toBe("MANUAL");
  });
});

const t = (id: string, type: string[], status = "active") => ({
  id,
  title: `test ${id}`,
  status: status as "active",
  profiles: [],
  type,
});

const controls: ChecklistControl[] = [
  {
    id: "MASVS-NETWORK-1",
    title: "net",
    status: "active",
    profiles: [],
    weaknesses: [
      {
        id: "MASWE-0050",
        title: "cleartext",
        status: "active",
        profiles: [],
        tests: [
          t("MASTG-TEST-0001", ["static", "config"]),
          t("MASTG-TEST-0002", ["dynamic", "network"]),
          t("MASTG-TEST-0003", ["static"], "placeholder"),
        ],
      },
      {
        id: "MASWE-0051",
        title: "pinning",
        status: "active",
        profiles: [],
        tests: [t("MASTG-TEST-0001", ["static", "config"])],
      },
      {
        id: "MASWE-0052",
        title: "untested",
        status: "active",
        profiles: [],
        tests: [],
      },
    ],
  },
  {
    id: "MASVS-CODE-1",
    title: "code",
    status: "active",
    profiles: [],
    weaknesses: [
      {
        id: "MASWE-0042",
        title: "target sdk",
        status: "active",
        profiles: [],
        tests: [t("MASTG-TEST-0009", ["static"])],
      },
    ],
  },
];

const analyzers: AnalyzerInput[] = [
  {
    name: "network",
    report: {
      limits: ["pinning in code is not read"],
      verdicts: [
        {
          check: "cleartext",
          verdict: "NO FINDING",
          mastg: ["MASTG-TEST-0001"],
          reason: "no cleartext",
          evidence: [{ file: "app/nsc.xml", line: 3, detail: "base-config" }],
        },
        {
          check: "dyn",
          verdict: "FAIL",
          mastg: ["MASTG-TEST-0002"],
          reason: "seen in config",
          evidence: [],
        },
      ],
    },
  },
  {
    name: "manifest",
    report: {
      limits: [],
      verdicts: [
        {
          check: "cleartext-attr",
          verdict: "MANUAL",
          mastg: ["MASTG-TEST-0001"],
          reason: "can't resolve",
          evidence: [{ file: "app/AndroidManifest.xml", line: 9, detail: "x" }],
        },
      ],
    },
  },
  {
    name: "build_config",
    report: {
      limits: [],
      verdicts: [
        {
          check: "target-sdk",
          verdict: "FAIL",
          mastg: [],
          maswe: ["MASWE-0042"],
          reason: "targetSdk 34",
          evidence: [],
        },
      ],
    },
  },
  { name: "dependencies", error: "boom" },
];

const build = () =>
  buildSkeleton({
    controls,
    analyzers,
    scope: {
      groups: ["MASVS-NETWORK", "MASVS-CODE"],
      profile: null,
      variant: "release",
    },
    stamps: { wardVersion: "0.6.0", mastg: null, osvDate: null },
    allGroups: ["MASVS-CODE", "MASVS-NETWORK", "MASVS-STORAGE"],
  });

describe("buildSkeleton", () => {
  const report = build();
  const net = report.controls[0];
  const row = (id: string) => net?.checks.find((c) => c.id === id);

  it("validates against the schema", () => {
    expect(reportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(reportJsonSchema())).toContain("NEEDS DYNAMIC");
  });

  it("gives one row per test, with every weakness of the control that links it", () => {
    expect(net?.checks.map((c) => c.id)).toEqual([
      "MASTG-TEST-0001",
      "MASTG-TEST-0002",
      "MASTG-TEST-0003",
      "MASWE-0052",
    ]);
    expect(row("MASTG-TEST-0001")?.maswe).toEqual(["MASWE-0050", "MASWE-0051"]);
  });

  it("prefills placeholders and untested weaknesses MANUAL from the index", () => {
    expect(row("MASTG-TEST-0003")).toMatchObject({
      verdict: "MANUAL",
      by: "owasp",
    });
    expect(row("MASWE-0052")).toMatchObject({
      kind: "weakness",
      verdict: "MANUAL",
      by: "owasp",
    });
  });

  it("merges analyzer verdicts on one test: worst wins, evidence joined", () => {
    expect(row("MASTG-TEST-0001")).toMatchObject({
      verdict: "MANUAL",
      by: "analyzer",
      analyzer: "network, manifest",
      reason: "no cleartext can't resolve",
    });
    expect(row("MASTG-TEST-0001")?.evidence).toHaveLength(2);
  });

  it("an analyzer verdict replaces the dynamic-only prefill", () => {
    expect(row("MASTG-TEST-0002")).toMatchObject({
      verdict: "FAIL",
      by: "analyzer",
    });
  });

  it("a verdict with only MASWE IDs lands on a weakness row", () => {
    const code = report.controls[1];
    expect(code?.checks.map((c) => c.id)).toEqual([
      "MASTG-TEST-0009",
      "MASWE-0042",
    ]);
    expect(code?.checks[1]).toMatchObject({
      kind: "weakness",
      title: "target sdk",
      verdict: "FAIL",
    });
  });

  it("rolls up, counts and lists the gaps", () => {
    expect(net?.verdict).toBe("FAIL");
    expect(report.controls[1]?.verdict).toBe("FAIL");
    expect(report.counts.controls).toEqual({ FAIL: 2 });
    expect(report.counts.checks).toEqual({ MANUAL: 3, FAIL: 2, pending: 1 });
    expect(report.gaps).toEqual({
      pending: ["MASTG-TEST-0009"],
      manual: ["MASTG-TEST-0001", "MASTG-TEST-0003", "MASWE-0052"],
      needsDynamic: [],
      outOfScope: ["MASVS-STORAGE"],
    });
  });

  it("records each analyzer's files, limits and errors", () => {
    expect(report.analyzers).toEqual([
      {
        name: "network",
        filesInspected: ["app/nsc.xml"],
        limits: ["pinning in code is not read"],
      },
      {
        name: "manifest",
        filesInspected: ["app/AndroidManifest.xml"],
        limits: [],
      },
      { name: "build_config", filesInspected: [], limits: [] },
      { name: "dependencies", filesInspected: [], limits: [], error: "boom" },
    ]);
  });

  it("finalize recomputes a control after the agent fills a check", () => {
    const filled = structuredClone(report);
    const code = filled.controls[1];
    if (!code?.checks[1] || !code.checks[0]) throw new Error("fixture");
    code.checks[1].verdict = "NO FINDING";
    code.checks[0].verdict = "NO FINDING";
    code.verdict = "FAIL"; // stale: finalize replaces it
    const out = finalize(filled);
    expect(finalize(out)).toEqual(out);
    expect(out.controls[1]?.verdict).toBe("NO FINDING");
    expect(out.gaps.pending).toEqual([]);
    expect(out.gaps.outOfScope).toEqual(["MASVS-STORAGE"]);
  });
});

describe("profile scope", () => {
  it("lists controls with nothing in the profile as out of scope", () => {
    const r = buildSkeleton({
      controls: [
        ...controls,
        {
          id: "MASVS-RESILIENCE-1",
          title: "r",
          status: "active",
          profiles: [],
          weaknesses: [],
        },
      ],
      analyzers: [],
      scope: {
        groups: ["MASVS-NETWORK", "MASVS-CODE", "MASVS-RESILIENCE"],
        profile: "L1",
        variant: "release",
      },
      stamps: { wardVersion: "0.6.0", mastg: null, osvDate: null },
      allGroups: [
        "MASVS-CODE",
        "MASVS-NETWORK",
        "MASVS-RESILIENCE",
        "MASVS-STORAGE",
      ],
    });
    expect(r.controls.map((c) => c.id)).toEqual([
      "MASVS-NETWORK-1",
      "MASVS-CODE-1",
    ]);
    expect(r.gaps.outOfScope).toEqual(["MASVS-STORAGE", "MASVS-RESILIENCE-1"]);
    expect(r.gaps.manual).not.toContain("MASVS-RESILIENCE-1");
  });
});

describe("filesIn", () => {
  it("collects file fields, the NSC file and the catalog", () => {
    expect(
      filesIn({
        nscFile: "b.xml",
        catalog: "gradle/libs.versions.toml",
        filesRead: [{ file: "a.xml" }],
        verdicts: [{ evidence: [{ file: "a.xml", detail: "file" }] }],
      }),
    ).toEqual(["a.xml", "b.xml", "gradle/libs.versions.toml"]);
  });
});
