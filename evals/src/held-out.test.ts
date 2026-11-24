import { readFileSync } from "node:fs";
import { KnowledgeBase, loadIndex } from "@ward/core";
import { describe, expect, it } from "vitest";
import {
  fileSha256,
  heldOutKinds,
  loadHeldOut,
  locationProblem,
  offlineProblems,
  parseHeldOut,
} from "./held-out.js";
import { heldOutBarPath, heldOutKeyPath } from "./paths.js";

describe("locationProblem", () => {
  const text = "a\nb\nanchor here\nc\nd";

  it("accepts an anchor inside its lines", () => {
    expect(locationProblem(text, { lines: [2, 4], anchor: "anchor" })).toBe(
      null,
    );
  });

  it("rejects an anchor outside its lines", () => {
    expect(locationProblem(text, { lines: [4, 5], anchor: "anchor" })).toMatch(
      /line 3, outside 4-5/,
    );
  });

  it("rejects a missing or repeated anchor", () => {
    expect(locationProblem(text, { lines: [1, 5], anchor: "zzz" })).toMatch(
      /not found/,
    );
    expect(locationProblem(text, { lines: [1, 5], anchor: "\n" })).toMatch(
      /more than once/,
    );
  });

  it("rejects lines past the end of the file", () => {
    expect(locationProblem(text, { lines: [5, 9] })).toMatch(/past end/);
    expect(locationProblem(text, { lines: [1, 5] })).toBe(null);
  });
});

describe("the held-out answer key", () => {
  const key = loadHeldOut(heldOutKeyPath);
  const kb = new KnowledgeBase(loadIndex());

  it("has no offline problems (IDs in the index, at most 3 per repo, cutoffs)", () => {
    expect(offlineProblems(key, kb)).toEqual([]);
  });

  it("has unique case IDs, in order", () => {
    const ids = key.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      ids.map((_, i) => `HO-${String(i + 1).padStart(2, "0")}`),
    );
  });

  it("keeps any one kind to at most 40% of the cases", () => {
    for (const kind of heldOutKinds) {
      const n = key.cases.filter((c) => c.kind === kind).length;
      expect(n, kind).toBeLessThanOrEqual(Math.ceil(key.cases.length * 0.4));
    }
  });

  it("is pinned by the bar file, which was written before any run", () => {
    const bar = readFileSync(heldOutBarPath, "utf8");
    expect(bar).toContain(fileSha256(heldOutKeyPath));
  });

  it("flags an unknown ID and too many cases from one repo", () => {
    const first = key.cases[0];
    if (!first) throw new Error("no cases");
    const bad = parseHeldOut({
      ...key,
      cases: [0, 1, 2, 3].map((i) => ({
        ...first,
        id: `HO-0${String(i + 1)}`,
        maswe: ["MASWE-9999"],
      })),
    });
    const problems = offlineProblems(bad, kb);
    expect(problems).toContain("HO-01: MASWE-9999 is not in the index");
    expect(problems.some((p) => /4 cases \(max 3\)/.test(p))).toBe(true);
  });

  it("rejects a short commit hash", () => {
    const first = key.cases[0];
    expect(() =>
      parseHeldOut({ ...key, cases: [{ ...first, parent: "abc123" }] }),
    ).toThrow(/40-hex/);
  });
});
