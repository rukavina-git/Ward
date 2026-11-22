import { describe, expect, it } from "vitest";
import { Bm25Index } from "./bm25.js";

// a: cat dog (2 tokens), b: cat ×4 (4), c: bird (1). N = 3, avg length 7/3.
const index = new Bm25Index([
  { id: "a", tokens: ["cat", "dog"] },
  { id: "b", tokens: ["cat", "cat", "cat", "cat"] },
  { id: "c", tokens: ["bird"] },
]);

describe("bm25", () => {
  it("computes IDF by hand", () => {
    // ln(1 + (N - n + 0.5) / (n + 0.5))
    expect(index.idf("cat")).toBeCloseTo(Math.log(1.6), 10); // n = 2
    expect(index.idf("dog")).toBeCloseTo(Math.log(8 / 3), 10); // n = 1
    expect(index.idf("fish")).toBeGreaterThan(index.idf("dog")); // n = 0
  });

  it("computes a score by hand", () => {
    // a for "dog": tf 1, length 2. norm = 0.25 + 0.75 × 2 / (7/3) = 0.892857
    // idf × 1 × 2.2 / (1 + 1.2 × norm) = 0.980829 × 1.062069 = 1.041708
    const [hit] = index.search(["dog"]);
    expect(hit?.id).toBe("a");
    expect(hit?.score).toBeCloseTo(1.041708, 5);
  });

  it("ranks a rare word above a common one", () => {
    // a has the rare "dog"; b has "cat" four times.
    expect(index.search(["cat", "dog"]).map((h) => h.id)).toEqual(["a", "b"]);
  });

  it("saturates repeated terms (k1)", () => {
    const flat = { k1: 1.2, b: 0 };
    const [b, a] = index.search(["cat"], flat);
    // tf 4 vs tf 1: far less than 4 times the score.
    expect(b?.id).toBe("b");
    const ratio = (b?.score ?? 0) / (a?.score ?? 1);
    expect(ratio).toBeCloseTo((4 * 2.2) / (4 + 1.2) / 1, 5);
    expect(ratio).toBeLessThan(2);
    // k1 = 0: only presence counts, so a and b tie and sort by id.
    const binary = index.search(["cat"], { k1: 0, b: 0 });
    expect(binary[0]?.score).toBeCloseTo(binary[1]?.score ?? 0, 10);
    expect(binary.map((h) => h.id)).toEqual(["a", "b"]);
  });

  it("penalises long documents (b)", () => {
    const docs = new Bm25Index([
      { id: "long", tokens: ["key", "a1", "a2", "a3", "a4", "a5"] },
      { id: "short", tokens: ["key", "b1"] },
    ]);
    expect(docs.search(["key"]).map((h) => h.id)).toEqual(["short", "long"]);
    // b = 0 ignores length: a tie, broken by id.
    const flat = docs.search(["key"], { k1: 1.2, b: 0 });
    expect(flat[0]?.score).toBe(flat[1]?.score);
    expect(flat.map((h) => h.id)).toEqual(["long", "short"]);
  });

  it("returns nothing for unknown or no terms", () => {
    expect(index.search(["fish"])).toEqual([]);
    expect(index.search([])).toEqual([]);
    expect(new Bm25Index([]).search(["cat"])).toEqual([]);
  });

  it("counts a repeated query term once", () => {
    expect(index.search(["dog", "dog"])).toEqual(index.search(["dog"]));
  });
});
