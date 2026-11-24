import { finalize, REPORT_SCHEMA, type Check, type Report } from "@ward/report";
import { describe, expect, it } from "vitest";
import { toolCalls } from "./isolation.js";
import type { KeyItem } from "./key.js";
import { proxyMetrics } from "./proxy.js";

const row = (id: string, extra: Partial<Check> = {}): Check => ({
  id,
  kind: "test",
  title: id,
  status: "active",
  maswe: [],
  verdict: "NO FINDING",
  by: "agent",
  reason: "r",
  evidence: [],
  filesInspected: ["a.kt"],
  ...extra,
});

const report = (checks: Check[]): Report =>
  finalize({
    schema: REPORT_SCHEMA,
    notice: "n",
    scope: { groups: ["MASVS-X"], profile: null, variant: "release" },
    stamps: { wardVersion: "0", mastg: null, osvDate: null },
    analyzers: [],
    controls: [{ id: "C-1", title: "c", verdict: null, checks }],
  });

const line = (o: object) => JSON.stringify(o);
const transcript = [
  line({
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "1",
          name: "mcp__ward__get_check",
          input: { id: "t-read" },
        },
        { type: "tool_use", id: "2", name: "mcp__ward__report_skeleton" },
        { type: "tool_use", id: "3", name: "Read", input: {} },
      ],
    },
  }),
].join("\n");

const item = (id: string, mastg: string[], decoy = false): KeyItem => ({
  id,
  decoy,
  title: id,
  category: "security",
  masvs: [],
  maswe: [],
  mastg,
  locations: [{ file: "a.kt", anchor: "x" }],
});

describe("proxyMetrics", () => {
  const checks = [
    row("T-READ"),
    row("T-TITLE", { verdict: "FAIL", filesInspected: [] }),
    row("T-BARE", { filesInspected: [] }),
    row("T-CODE", { by: "analyzer" }),
    row("T-OPEN", { verdict: null, by: null }),
  ];

  it("counts tool calls and takes depth from get_check for old reports", () => {
    const p = proxyMetrics(report(checks), toolCalls(transcript), {
      planted: [item("EA-1", ["T-CODE"]), item("EA-2", ["T-TITLE"])],
    });
    expect(p.wardCalls).toEqual({ get_check: 1, report_skeleton: 1 });
    expect(p).toMatchObject({
      agentAnswers: 3,
      testText: 1,
      depthFrom: "transcript",
      agentNoFinding: 2,
      noFindingNoFiles: 1,
      noFindingNoEvidence: 2,
      falseNoFinding: { "EA-1": ["T-CODE"] },
      gate: false,
    });
    expect(p.share).toBeCloseTo(1 / 3);
  });

  it("prefers the report's depth and passes the gate at 80%", () => {
    const deep = checks.map((c) => ({
      ...c,
      depth: c.by === "agent" ? ("test text" as const) : null,
    }));
    const p = proxyMetrics(report(deep), [], {
      planted: [item("EA-3", ["T-READ"], true)],
    });
    expect(p).toMatchObject({
      testText: 3,
      share: 1,
      depthFrom: "report",
      falseNoFinding: {},
      gate: true,
    });
  });
});
