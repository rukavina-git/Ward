import { describe, expect, it } from "vitest";
import type { Finding } from "./findings.js";
import type { KeyItem, ResolvedItem } from "./key.js";
import {
  matchFinding,
  normalizePath,
  score,
  type Grades,
  type ScoreInput,
} from "./score.js";

function item(id: string, patch: Partial<KeyItem> = {}): KeyItem {
  return {
    id,
    decoy: false,
    title: id,
    category: "security",
    severity: "high",
    masvs: [],
    maswe: [],
    difficulty: "obvious",
    locations: [{ file: "unused", anchor: "unused" }],
    ...patch,
  };
}

function at(
  it: KeyItem,
  ...locs: [file: string, line: number][]
): ResolvedItem {
  return {
    item: it,
    locations: locs.map(([file, line]) => ({
      file,
      startLine: line,
      endLine: line,
    })),
  };
}

// A small made-up key: EA-12 and EA-13 are a chain, EA-03 sits 4 lines
// from EA-12, EA-D1 is a decoy in the same file as EA-01.
const planted: ResolvedItem[] = [
  at(item("EA-01", { masvs: ["MASVS-STORAGE-1"], maswe: ["MASWE-0001"] }), [
    "a.kt",
    10,
  ]),
  at(
    item("EA-03", {
      masvs: ["MASVS-STORAGE-2"],
      maswe: ["MASWE-0006"],
      difficulty: "config",
    }),
    ["m.xml", 24],
  ),
  at(item("EA-12", { masvs: ["MASVS-PLATFORM-1"], maswe: ["MASWE-0018"] }), [
    "m.xml",
    20,
  ]),
  at(
    item("EA-13", {
      masvs: ["MASVS-CODE-4"],
      maswe: ["MASWE-0050"],
      category: "privacy",
    }),
    ["q.kt", 40],
  ),
  at(
    item("EA-D1", {
      decoy: true,
      masvs: ["MASVS-CRYPTO-1"],
      maswe: ["MASWE-0008"],
    }),
    ["a.kt", 30],
  ),
];
const clean: ResolvedItem[] = planted.filter((r) => r.item.decoy);

const lineCounts = new Map([
  ["a.kt", 100],
  ["m.xml", 50],
  ["q.kt", 60],
]);

function finding(patch: Partial<Finding> = {}): Finding {
  return {
    title: "a finding",
    category: "security",
    severity: "high",
    verdict: "FAIL",
    masvs: [],
    maswe: ["MASWE-0001"],
    locations: [{ file: "a.kt", line: 10 }],
    explanation: "",
    ...patch,
  };
}

function run(findings: Finding[], patch: Partial<ScoreInput> = {}) {
  return score({
    app: "planted",
    findings,
    resolved: planted,
    lineCounts,
    grades: { grades: [] },
    ...patch,
  });
}

describe("normalizePath", () => {
  it("accepts the ways an agent writes a path inside the app", () => {
    for (const p of [
      "a.kt",
      "./a.kt",
      "penny-jar/a.kt",
      "/private/var/x/tmp-1/penny-jar/a.kt",
      "x/../a.kt",
    ]) {
      expect(normalizePath(p)).toBe("a.kt");
    }
  });

  it("rejects paths outside the app", () => {
    for (const p of ["../a.kt", "/etc/passwd", "..", "."])
      expect(normalizePath(p)).toBeNull();
  });
});

describe("matching", () => {
  it("matches on location and MASWE", () => {
    expect(matchFinding(finding(), planted).auto).toEqual({
      kind: "issue",
      items: ["EA-01"],
    });
  });

  it("matches on location and MASVS when there's no MASWE", () => {
    const f = finding({ maswe: [], masvs: ["MASVS-STORAGE-1"] });
    expect(matchFinding(f, planted).auto?.items).toEqual(["EA-01"]);
  });

  it("matches within 5 lines, not 6", () => {
    expect(
      matchFinding(
        finding({ locations: [{ file: "a.kt", line: 15 }] }),
        planted,
      ).auto,
    ).not.toBeNull();
    expect(
      matchFinding(
        finding({ locations: [{ file: "a.kt", line: 16 }] }),
        planted,
      ).auto,
    ).toBeNull();
    const range = (endLine: number) =>
      finding({ locations: [{ file: "a.kt", line: 1, endLine }] });
    expect(matchFinding(range(5), planted).auto).not.toBeNull();
    expect(matchFinding(range(4), planted).auto).toBeNull();
  });

  it("sends location without type to hand grading, with the item as candidate", () => {
    const m = matchFinding(finding({ maswe: ["MASWE-0099"] }), planted);
    expect(m).toEqual({ auto: null, candidates: ["EA-01"], near: true });
  });

  it("offers items in the same file when nothing is near", () => {
    const m = matchFinding(
      finding({ locations: [{ file: "a.kt", line: 60 }] }),
      planted,
    );
    expect(m.candidates.sort()).toEqual(["EA-01", "EA-D1"]);
  });

  it("treats two type matches at one location as a tie", () => {
    const f = finding({
      maswe: ["MASWE-0018", "MASWE-0006"],
      locations: [{ file: "m.xml", line: 22 }],
    });
    expect(matchFinding(f, planted).auto).toBeNull();
  });

  it("counts a chain finding for every item it cites", () => {
    const f = finding({
      maswe: ["MASWE-0018", "MASWE-0050"],
      // Line 18: near EA-12 (20), out of EA-03's reach (24).
      locations: [
        { file: "m.xml", line: 18 },
        { file: "q.kt", line: 40 },
      ],
    });
    expect(matchFinding(f, planted).auto).toEqual({
      kind: "issue",
      items: ["EA-12", "EA-13"],
    });
  });

  it("matches a decoy", () => {
    const f = finding({
      maswe: ["MASWE-0008"],
      locations: [{ file: "a.kt", line: 31 }],
    });
    expect(matchFinding(f, planted).auto).toEqual({
      kind: "decoy",
      items: ["EA-D1"],
    });
  });
});

describe("partial matches", () => {
  // EA-02 sits 3 lines from EA-01 but shares no ID with the finding.
  const withNeighbour: ResolvedItem[] = [
    ...planted,
    at(item("EA-02", { maswe: ["MASWE-0002"] }), ["a.kt", 13]),
  ];

  it("sends an automatic match with another issue nearby to hand grading", () => {
    const m = matchFinding(finding(), withNeighbour);
    expect(m).toMatchObject({
      auto: null,
      suggested: "EA-01",
      candidates: ["EA-01", "EA-02"],
    });
  });

  it("ignores a decoy nearby that shares no ID", () => {
    const f = finding({
      locations: [{ file: "a.kt", line: 26 }],
      maswe: ["MASWE-0001"],
    });
    const near: ResolvedItem[] = [
      at(item("EA-01", { maswe: ["MASWE-0001"] }), ["a.kt", 22]),
      ...planted.filter((r) => r.item.id === "EA-D1"),
    ];
    expect(matchFinding(f, near).auto).toEqual({
      kind: "issue",
      items: ["EA-01"],
    });
  });
});

describe("score, planted app", () => {
  it("counts found and missed issues, by difficulty, group and category", () => {
    const { score: s } = run([finding()]);
    expect(s.issues).toMatchObject({
      found: 1,
      total: 4,
      recall: 0.25,
      missed: ["EA-03", "EA-12", "EA-13"],
    });
    expect(s.issues?.byDifficulty).toEqual({
      obvious: { found: 1, total: 3 },
      config: { found: 0, total: 1 },
    });
    expect(s.issues?.byMasvsGroup.STORAGE).toEqual({ found: 1, total: 2 });
    expect(s.issues?.byCategory.privacy).toEqual({ found: 0, total: 1 });
    expect(s).toMatchObject({
      provisional: false,
      precision: 1,
      falseAlarms: 0,
    });
  });

  it("counts a second finding on the same issue as a duplicate, not a second find", () => {
    const { score: s } = run([
      finding(),
      finding({ locations: [{ file: "a.kt", line: 12 }] }),
    ]);
    expect(s.issues?.found).toBe(1);
    expect(s.duplicates).toBe(1);
  });

  it("counts a decoy hit as a false alarm", () => {
    const decoy = finding({
      maswe: ["MASWE-0008"],
      locations: [{ file: "a.kt", line: 30 }],
    });
    const { score: s } = run([finding(), decoy]);
    expect(s).toMatchObject({
      falseAlarms: 1,
      decoyHits: ["EA-D1"],
      precision: 0.5,
    });
  });

  it("adds ungraded findings to the grades file and marks the score provisional", () => {
    const { score: s, grades } = run([finding({ maswe: [] })]);
    expect(s).toMatchObject({ provisional: true, ungraded: 1 });
    expect(grades.grades).toEqual([
      {
        finding: 0,
        title: "a finding",
        candidates: ["EA-01"],
        suggested: "EA-01",
        label: null,
      },
    ]);
    // Scoring again with the same file doesn't add the entry twice.
    expect(
      run([finding({ maswe: [] })], { grades }).grades.grades,
    ).toHaveLength(1);
  });

  it("applies hand labels", () => {
    const grades = (label: string): Grades => ({
      grades: [
        { finding: 0, title: "", candidates: [], suggested: null, label },
      ],
    });
    const f = [finding({ maswe: [] })];
    expect(run(f, { grades: grades("EA-01") }).score.issues?.found).toBe(1);
    expect(run(f, { grades: grades("generic") }).score).toMatchObject({
      generic: 1,
      provisional: false,
      precision: null,
    });
    expect(run(f, { grades: grades("real-unplanted") }).score).toMatchObject({
      realUnplanted: 1,
      precision: 1,
    });
    expect(run(f, { grades: grades("EA-D1") }).score.decoyHits).toEqual([
      "EA-D1",
    ]);
  });

  it("accepts several items joined with +, but not issues mixed with decoys", () => {
    const grades = (label: string): Grades => ({
      grades: [
        { finding: 0, title: "", candidates: [], suggested: null, label },
      ],
    });
    const f = [finding({ maswe: [] })];
    expect(run(f, { grades: grades("EA-01+EA-13") }).score.issues?.found).toBe(
      2,
    );
    expect(() => run(f, { grades: grades("EA-01+EA-D1") })).toThrow(/mixes/);
  });

  it("lets a hand label overrule an automatic match", () => {
    const grades: Grades = {
      grades: [
        {
          finding: 0,
          title: "",
          candidates: [],
          suggested: null,
          label: "false-alarm",
        },
      ],
    };
    expect(run([finding()], { grades }).score).toMatchObject({
      falseAlarms: 1,
      issues: { found: 0 },
    });
  });

  it("rejects labels that aren't items or hand labels, and grades for missing findings", () => {
    const bad = (label: string, index = 0): Grades => ({
      grades: [
        { finding: index, title: "", candidates: [], suggested: null, label },
      ],
    });
    expect(() => run([finding()], { grades: bad("EA-99") })).toThrow(
      /not an item/,
    );
    expect(() => run([finding()], { grades: bad("generic", 3) })).toThrow(
      /doesn't exist/,
    );
  });

  it("flags citations to missing files, lines past the end and paths outside the app", () => {
    const f = finding({
      locations: [
        { file: "a.kt", line: 100 },
        { file: "a.kt", line: 99, endLine: 101 },
        { file: "nope.kt", line: 1 },
        { file: "../../etc/passwd", line: 1 },
      ],
    });
    const { citations } = run([f]).score;
    expect(citations.locations).toBe(4);
    expect(citations.bad.map((b) => b.why)).toEqual([
      "line past the end",
      "no such file",
      "outside the app",
    ]);
  });
});

describe("score, clean twin", () => {
  const runClean = (findings: Finding[]) =>
    score({
      app: "clean",
      findings,
      resolved: clean,
      lineCounts,
      grades: { grades: [] },
    });

  it("matches decoys automatically and has no issue numbers", () => {
    const { score: s } = runClean([
      finding({
        maswe: ["MASWE-0008"],
        locations: [{ file: "a.kt", line: 30 }],
      }),
    ]);
    expect(s).toMatchObject({
      falseAlarms: 1,
      decoyHits: ["EA-D1"],
      provisional: false,
      precision: null,
    });
    expect(s.issues).toBeUndefined();
  });

  it("sends every other finding to hand grading, suggesting a false alarm", () => {
    const { score: s, grades } = runClean([finding()]);
    expect(s.provisional).toBe(true);
    expect(grades.grades[0]).toMatchObject({
      suggested: "false-alarm",
      label: null,
    });
  });

  it("refuses an issue label in the twin", () => {
    const grades: Grades = {
      grades: [
        {
          finding: 0,
          title: "",
          candidates: [],
          suggested: null,
          label: "EA-01",
        },
      ],
    };
    expect(() =>
      score({
        app: "clean",
        findings: [finding()],
        resolved: clean,
        lineCounts,
        grades,
      }),
    ).toThrow();
  });
});
