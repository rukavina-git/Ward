import { describe, expect, it } from "vitest";
import {
  END,
  renderTables,
  spliceTables,
  START,
  stats,
  summarize,
  type RunRecord,
} from "./summary.js";

type Score = NonNullable<RunRecord["score"]>;

function planted(found: number, missed: string[], patch: Partial<Score> = {}) {
  return {
    provisional: false,
    findings: found + 2,
    falseAlarms: 1,
    decoyHits: [],
    realUnplanted: 0,
    generic: 1,
    duplicates: 0,
    precision: 0.9,
    citations: { locations: 10, bad: 1 },
    issues: { found, total: 23, missed },
    ...patch,
  } satisfies Score;
}

function twin(falseAlarms: number, decoyHits: string[] = []): Score {
  return {
    provisional: false,
    findings: falseAlarms + 1,
    falseAlarms,
    decoyHits,
    realUnplanted: 1,
    generic: 0,
    duplicates: 0,
    precision: null,
    citations: { locations: 4, bad: 0 },
  };
}

function rec(patch: Partial<RunRecord>): RunRecord {
  return {
    name: "r",
    setup: "alone",
    app: "planted",
    trial: 1,
    failed: false,
    model: "m",
    claudeCodeVersion: "1.0",
    wallMs: 60_000,
    tokens: 1000,
    apiUsd: 0.2,
    plugin: null,
    skillsInvoked: [],
    score: null,
    ...patch,
  };
}

// Two misses of 23 means 21 found.
const missTwo = ["EA-08", "EA-09"];

const runs: RunRecord[] = [
  rec({ trial: 1, score: planted(21, missTwo) }),
  rec({ trial: 2, score: planted(20, [...missTwo, "EA-11"]) }),
  rec({ trial: 3, score: planted(22, ["EA-08"]), wallMs: 120_000 }),
  rec({ app: "clean", trial: 1, score: twin(0) }),
  rec({ app: "clean", trial: 2, score: twin(1, ["EA-D7"]) }),
  rec({ app: "clean", trial: 3, score: twin(1, ["EA-D7"]) }),
  rec({ trial: 4, failed: true }),
  rec({
    setup: "checklist",
    plugin: "masvs-checklist",
    skillsInvoked: ["masvs-checklist:masvs-checklist"],
    score: planted(19, ["EA-08", "EA-01", "EA-02", "EA-03"]),
  }),
  rec({
    setup: "checklist",
    trial: 2,
    plugin: "masvs-checklist",
    skillsInvoked: ["security-review"],
    score: planted(22, ["EA-08"]),
  }),
];

describe("stats", () => {
  it("gives mean, min, max and count, or null for nothing", () => {
    expect(stats([1, 2, 6])).toEqual({ mean: 3, min: 1, max: 6, n: 3 });
    expect(stats([])).toBeNull();
  });
});

describe("summarize", () => {
  const s = summarize(runs, ["alone", "checklist", "owasp"]);
  const alone = s.cells.find((c) => c.setup === "alone" && c.app === "planted");
  const aloneTwin = s.cells.find(
    (c) => c.setup === "alone" && c.app === "clean",
  );
  const checklist = s.cells.find((c) => c.setup === "checklist");

  it("averages found issues and false passes, with spread", () => {
    expect(alone).toMatchObject({
      trials: 3,
      failed: 1,
      found: { mean: 21, min: 20, max: 22, n: 3 },
      missedBy: { "EA-08": 3, "EA-09": 2, "EA-11": 1 },
    });
    expect(alone?.falsePassRate?.mean).toBeCloseTo(2 / 23);
    expect(alone?.falsePassRate?.max).toBeCloseTo(3 / 23);
    expect(alone?.badCitationRate?.mean).toBeCloseTo(0.1);
    expect(alone?.minutes).toMatchObject({ min: 1, max: 2 });
  });

  it("counts twin false alarms and decoy hits per run", () => {
    expect(aloneTwin).toMatchObject({
      trials: 3,
      falseAlarms: { mean: 2 / 3, min: 0, max: 1 },
      decoyHits: { "EA-D7": 2 },
      found: null,
      skillUsed: null,
    });
  });

  it("counts only invocations of the arm's own skill", () => {
    expect(checklist?.skillUsed).toBe(1);
  });

  it("lists issues every run of every arm missed", () => {
    expect(s.neverFound).toEqual(["EA-08"]);
  });

  it("applies the pre-registered revisit bar", () => {
    // alone averages 21 (bar 21) and its worst twin run has 1 false alarm (bar 1).
    expect(s.revisit?.triggered).toBe(true);
    const worse = summarize(
      [...runs, rec({ app: "clean", trial: 4, score: twin(2) })],
      ["alone"],
    );
    expect(worse.revisit?.triggered).toBe(false);
  });

  it("refuses two scored runs of one trial", () => {
    expect(() =>
      summarize([runs[0] as RunRecord, runs[0] as RunRecord], ["alone"]),
    ).toThrow(/two scored runs/);
  });
});

describe("baseline.md", () => {
  const tables = renderTables(summarize(runs, ["alone", "checklist", "owasp"]));

  it("renders a row per arm with mean and range", () => {
    expect(tables).toContain("| alone | 3 (+1 failed) | 21.0 (20.0–22.0) |");
    expect(tables).toContain("| EA-08 | 3/3 | 2/2 |");
    expect(tables).toContain("Never found by any arm: EA-08.");
  });

  it("replaces only the generated block and keeps the note", () => {
    const first = spliceTables(null, "T1");
    expect(first).toContain(`${START}\nT1\n${END}`);
    const edited = first.replace(
      "(To write once every run is graded.)",
      "My note.",
    );
    const second = spliceTables(edited, "T2");
    expect(second).toContain("My note.");
    expect(second).toContain(`${START}\nT2\n${END}`);
    expect(second).not.toContain("T1");
    expect(() => spliceTables("no markers", "T")).toThrow();
  });
});
