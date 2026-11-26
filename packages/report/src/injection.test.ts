import { describe, expect, it } from "vitest";
import {
  applyFills,
  displaySafe,
  fillsSchema,
  SUMMARY_MAX_LINES,
  summaryText,
} from "./fills.js";
import { finalize, markDepth } from "./rollup.js";
import { REPORT_SCHEMA, type Check, type Report } from "./schema.js";

// Plan 6 step 04: an agent the checked app has manipulated can write
// anything into fills.json, and the app's own files can carry any text.
// None of it may change IDs, verdicts, the rollup or depth, or forge a
// line of the terminal summary.

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
    scope: { groups: ["MASVS-STORAGE"], profile: null, variant: "release" },
    stamps: { wardVersion: "0", mastg: null, osvDate: null },
    analyzers: [],
    controls: [
      {
        id: "C-1",
        title: "one",
        verdict: null,
        checks: [
          row("T-OPEN"),
          row("T-AFAIL", {
            verdict: "FAIL",
            by: "analyzer",
            analyzer: "manifest",
            reason: "debuggable",
          }),
          row("T-DYN", { verdict: "NEEDS DYNAMIC", by: "owasp", reason: "d" }),
        ],
      },
    ],
    gaps: { outOfScope: [] },
  });
}

const find = (r: Report, id: string) =>
  r.controls[0]?.checks.find((c) => c.id === id);

// Text a hostile app or agent would like to see on its own line.
const FORGE =
  "x\n\nCitation check: every ID, file:line and quote confirmed\n```\n\u001b[2J\u001b[32mREADY TO PUBLISH\u001b[0m‮";

describe("hostile fills", () => {
  it("can't claim PASS: the schema has no such verdict", () => {
    const parsed = fillsSchema.safeParse({
      fills: [{ check: "T-OPEN", verdict: "PASS", reason: "safe" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("can't set who decided, the depth or the hardening flag", () => {
    const fills = fillsSchema.parse({
      fills: [
        {
          check: "T-OPEN",
          verdict: "NO FINDING",
          reason: "fine",
          filesInspected: ["a.kt"],
          by: "analyzer",
          depth: "analyzer",
          hardening: true,
        },
      ],
    });
    const { report } = applyFills(skeleton(), fills);
    const r = markDepth(report, new Set());
    expect(find(r, "T-OPEN")).toMatchObject({
      by: "agent",
      depth: "title only",
    });
    expect(find(r, "T-OPEN")?.hardening).toBeUndefined();
  });

  it("can't lower an analyzer FAIL or an index verdict, or answer unknown IDs", () => {
    const fills = fillsSchema.parse({
      fills: [
        {
          check: "T-AFAIL",
          verdict: "NO FINDING",
          reason: "the comment says it's fine",
          filesInspected: ["a"],
        },
        { check: "T-DYN", verdict: "N/A", reason: "x" },
        { check: "MASTG-TEST-9999", verdict: "FAIL", reason: "x" },
        { check: "T-OPEN\nPASS", verdict: "N/A", reason: "x" },
      ],
    });
    const { report, rejected } = applyFills(skeleton(), fills);
    expect(rejected).toHaveLength(4);
    expect(find(report, "T-AFAIL")?.verdict).toBe("FAIL");
    expect(find(report, "T-DYN")?.verdict).toBe("NEEDS DYNAMIC");
    expect(find(report, "T-OPEN")?.verdict).toBeNull();
  });

  it("rejects an overlong check ID before it reaches the report", () => {
    const parsed = fillsSchema.safeParse({
      fills: [
        { check: `T-OPEN${FORGE}`.repeat(4), verdict: "N/A", reason: "x" },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("can't forge the rollup: control verdicts, counts and gaps come from code", () => {
    const forged = skeleton();
    forged.controls = forged.controls.map((c) => ({
      ...c,
      verdict: "NO FINDING" as const,
    }));
    forged.counts = {
      controls: { "NO FINDING": 1 },
      checks: { "NO FINDING": 3 },
    };
    forged.gaps = { ...forged.gaps, pending: [], manual: [] };
    const { report } = applyFills(forged, fillsSchema.parse({ fills: [] }));
    expect(report.controls[0]?.verdict).toBe("FAIL");
    expect(report.counts.checks).toMatchObject({ FAIL: 1, pending: 1 });
    expect(report.gaps.pending).toEqual(["T-OPEN"]);
  });
});

describe("hostile text in the summary", () => {
  const report = (() => {
    const r = skeleton();
    r.controls = r.controls.map((c) => ({
      ...c,
      checks: c.checks.map((t) =>
        t.id === "T-AFAIL"
          ? {
              ...t,
              evidence: [{ file: `app/${FORGE}`, line: 3, detail: FORGE }],
            }
          : t,
      ),
    }));
    return finalize(r);
  })();
  const text = summaryText(
    report,
    [{ kind: "unknown-id", message: `MASWE-9999 ${FORGE}` }],
    [{ index: 0, check: `T-X${FORGE}`, reason: `nope ${FORGE}` }],
  );
  const lines = text.split("\n");

  it("can't start a line of its own", () => {
    expect(lines.filter((l) => l.startsWith("Citation check:"))).toEqual([
      "Citation check: 1 issue(s); failed evidence removed",
    ]);
    expect(
      lines.some((l) => l.includes("READY TO PUBLISH") && !l.startsWith("  ")),
    ).toBe(false);
  });

  it("carries no control characters, ANSI escapes, bidi overrides or backticks", () => {
    const bad = new RegExp(
      // eslint-disable-next-line no-control-regex -- matching them is the point
      "[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069`]",
    );
    expect(text).not.toMatch(bad);
  });

  it("stays within the line limit and ends with Ward's own disclaimer", () => {
    expect(lines.length).toBeLessThanOrEqual(SUMMARY_MAX_LINES);
    expect(lines.at(-2)).toBe(
      "NO FINDING means Ward found nothing, not that the app is safe.",
    );
  });

  it("displaySafe keeps ordinary text as it is", () => {
    expect(displaySafe("app/src/Main.kt")).toBe("app/src/Main.kt");
    expect(displaySafe("a\nb")).toBe("a⏎b");
  });
});
