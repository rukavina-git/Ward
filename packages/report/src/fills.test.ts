import { describe, expect, it } from "vitest";
import {
  applyFills,
  fillsSchema,
  SUMMARY_MAX_LINES,
  summaryText,
  type Fills,
} from "./fills.js";
import { finalize, markDepth } from "./rollup.js";
import { REPORT_SCHEMA, type Check, type Report } from "./schema.js";

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

function skeleton(): Report {
  return finalize({
    schema: REPORT_SCHEMA,
    notice: "n",
    scope: { groups: ["MASVS-NETWORK"], profile: null, variant: "release" },
    stamps: { wardVersion: "0", mastg: null, osvDate: null },
    analyzers: [],
    controls: [
      {
        id: "C-1",
        title: "one",
        verdict: null,
        checks: [
          row("T-PENDING"),
          row("T-SHARED"),
          row("T-OWASP", { verdict: "MANUAL", by: "owasp", reason: "x" }),
          row("T-ANALYZER", {
            verdict: "NO FINDING",
            by: "analyzer",
            reason: "y",
          }),
          row("T-AMANUAL", {
            verdict: "MANUAL",
            by: "analyzer",
            analyzer: "manifest",
            reason: "check the backup rules",
          }),
        ],
      },
      { id: "C-2", title: "two", verdict: null, checks: [row("T-SHARED")] },
    ],
    gaps: { outOfScope: [] },
  });
}

const fill = (check: string, verdict = "NO FINDING", control?: string) => ({
  check,
  verdict,
  reason: "read it",
  filesInspected: verdict === "NO FINDING" ? ["app/x.kt"] : [],
  ...(control && { control }),
});
const fills = (...f: ReturnType<typeof fill>[]): Fills =>
  fillsSchema.parse({ fills: f });
const find = (r: Report, c: string, t: string) =>
  r.controls.find((x) => x.id === c)?.checks.find((x) => x.id === t);

describe("applyFills", () => {
  it("fills pending rows, every control the check sits under", () => {
    const { report, applied, rejected } = applyFills(
      skeleton(),
      fills(fill("T-PENDING"), fill("T-SHARED", "N/A")),
    );
    expect(applied).toBe(2);
    expect(rejected).toEqual([]);
    expect(find(report, "C-1", "T-PENDING")).toMatchObject({
      verdict: "NO FINDING",
      by: "agent",
      reason: "read it",
    });
    expect(find(report, "C-2", "T-SHARED")?.verdict).toBe("N/A");
    expect(report.controls[1]?.verdict).toBe("N/A");
    expect(report.gaps.pending).toEqual([]);
  });

  it("scopes a fill to one control when asked", () => {
    const { report } = applyFills(
      skeleton(),
      fills(fill("T-SHARED", "MANUAL", "C-2"), fill("T-SHARED", "N/A")),
    );
    expect(find(report, "C-2", "T-SHARED")?.verdict).toBe("MANUAL");
    expect(find(report, "C-1", "T-SHARED")?.verdict).toBe("N/A");
  });

  it("raises an owasp prefill to FAIL but never lowers it", () => {
    const up = applyFills(skeleton(), fills(fill("T-OWASP", "FAIL")));
    expect(find(up.report, "C-1", "T-OWASP")).toMatchObject({
      verdict: "FAIL",
      by: "agent",
    });
    expect(up.report.controls[0]?.verdict).toBe("FAIL");
    const down = applyFills(skeleton(), fills(fill("T-OWASP", "NO FINDING")));
    expect(find(down.report, "C-1", "T-OWASP")?.verdict).toBe("MANUAL");
    expect(down.rejected[0]?.reason).toMatch(/only FAIL/);
  });

  it("never changes an analyzer verdict", () => {
    const { report, rejected } = applyFills(
      skeleton(),
      fills(fill("T-ANALYZER", "FAIL")),
    );
    expect(find(report, "C-1", "T-ANALYZER")?.verdict).toBe("NO FINDING");
    expect(rejected[0]?.reason).toMatch(/analyzers/);
  });

  it("lets the agent settle an analyzer MANUAL, keeping the analyzer name", () => {
    const { report, rejected } = applyFills(
      skeleton(),
      fills(fill("T-AMANUAL", "NO FINDING")),
    );
    expect(rejected).toEqual([]);
    expect(find(report, "C-1", "T-AMANUAL")).toMatchObject({
      verdict: "NO FINDING",
      by: "agent",
      analyzer: "manifest",
      filesInspected: ["app/x.kt"],
    });
  });

  it("rejects unknown IDs, wrong controls and second answers", () => {
    const { rejected, applied } = applyFills(
      skeleton(),
      fills(
        fill("MASTG-TEST-9999"),
        fill("T-PENDING", "N/A", "C-2"),
        fill("T-PENDING"),
        fill("T-PENDING", "FAIL"),
      ),
    );
    expect(applied).toBe(1);
    expect(rejected.map((r) => r.index)).toEqual([0, 1, 3]);
    expect(rejected[2]?.reason).toMatch(/already answered/);
  });

  it("rejects PASS and missing reasons in the fills file", () => {
    expect(fillsSchema.safeParse({ fills: [fill("T", "PASS")] }).success).toBe(
      false,
    );
    expect(
      fillsSchema.safeParse({ fills: [{ check: "T", verdict: "N/A" }] })
        .success,
    ).toBe(false);
  });
});

describe("summaryText", () => {
  it("stays on one screen and never says PASS", () => {
    const base = skeleton();
    const checks = Array.from({ length: 200 }, (_, i) =>
      row(`T-${String(i)}`, {
        verdict: "FAIL",
        by: "agent",
        evidence: [{ file: "a.kt", line: i + 1, detail: "d" }],
      }),
    );
    const r = finalize({
      ...base,
      controls: [{ id: "C-1", title: "one", verdict: null, checks }],
    });
    const issues = Array.from({ length: 50 }, () => ({
      kind: "quote-mismatch" as const,
      message: "bad\nquote",
    }));
    const text = summaryText(r, issues, [
      { index: 0, check: "X", reason: "no" },
    ]);
    const lines = text.split("\n");
    expect(lines.length).toBeLessThanOrEqual(SUMMARY_MAX_LINES);
    expect(text).toMatch(/more in the report/);
    expect(text).toMatch(/Full report: \.ward\/report\.json/);
    expect(text).toMatch(/Citation check: 50 issue/);
    expect(text).not.toMatch(/\bPASS\b|ready/);
  });

  it("lists failing checks with their first evidence", () => {
    const { report } = applyFills(
      skeleton(),
      fillsSchema.parse({
        fills: [
          {
            ...fill("T-PENDING", "FAIL"),
            evidence: [{ file: "app/x.kt", line: 3, detail: "d" }],
          },
        ],
      }),
    );
    const text = summaryText(report, [], []);
    expect(text).toMatch(/app\/x\.kt:3 {2}T-PENDING/);
    expect(text).toMatch(/every ID, file:line and quote confirmed/);
    expect(text).toMatch(/Controls: FAIL 1 · pending 1/);
  });
});

describe("NO FINDING and grouped FAILs", () => {
  it("rejects a NO FINDING that lists no files read", () => {
    const { rejected, report } = applyFills(
      skeleton(),
      fillsSchema.parse({
        fills: [{ check: "T-PENDING", verdict: "NO FINDING", reason: "ok" }],
      }),
    );
    expect(rejected[0]?.reason).toMatch(/needs filesInspected/);
    expect(find(report, "C-1", "T-PENDING")?.verdict).toBeNull();
  });

  it("shows one line per finding with all its checks", () => {
    const ev = [{ file: "app/x.kt", line: 3, detail: "d" }];
    const { report } = applyFills(
      skeleton(),
      fillsSchema.parse({
        fills: [
          { ...fill("T-PENDING", "FAIL"), evidence: ev },
          { ...fill("T-SHARED", "FAIL"), evidence: ev },
        ],
      }),
    );
    const text = summaryText(report, [], []);
    expect(text).toMatch(
      /FAIL \(by finding\)\n {2}app\/x\.kt:3 {2}T-PENDING, T-SHARED\n\n/,
    );
  });
});

describe("markDepth", () => {
  it("sets depth from who decided and what Ward served, and counts it", () => {
    const { report } = applyFills(
      skeleton(),
      fills(fill("T-PENDING"), fill("T-SHARED", "FAIL", "C-1")),
    );
    const r = markDepth(report, new Set(["T-SHARED", "T-OWASP"]));
    expect(find(r, "C-1", "T-PENDING")?.depth).toBe("title only");
    expect(find(r, "C-1", "T-SHARED")?.depth).toBe("test text");
    expect(find(r, "C-2", "T-SHARED")?.depth).toBeNull();
    expect(find(r, "C-1", "T-OWASP")?.depth).toBe("index");
    expect(find(r, "C-1", "T-ANALYZER")?.depth).toBe("analyzer");
    expect(r.counts.depth).toEqual({
      "title only": 1,
      "test text": 1,
      index: 1,
      analyzer: 2,
    });
    expect(summaryText(r, [], [])).toMatch(
      /Depth: +2 by Ward's code · 1 of 2 agent answers after reading the test text/,
    );
  });

  it("leaves counts.depth out of reports without depth", () => {
    expect(skeleton().counts.depth).toBeUndefined();
    expect(summaryText(skeleton(), [], [])).not.toMatch(/Depth:/);
  });
});
