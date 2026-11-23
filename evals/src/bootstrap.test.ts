import { describe, expect, it } from "vitest";
import { pairedBootstrap, seededRandom } from "./bootstrap.js";

describe("seededRandom", () => {
  it("repeats for a seed and stays in [0, 1)", () => {
    const a = seededRandom(1);
    const b = seededRandom(1);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe("pairedBootstrap", () => {
  it("gives [0, 0] when both lists are equal", () => {
    const r = pairedBootstrap([1, 0.5, 0], [1, 0.5, 0]);
    expect(r).toMatchObject({ diff: 0, low: 0, high: 0 });
  });

  it("is reproducible with a fixed seed", () => {
    const a = [1, 0.5, 0, 0.33, 1, 0];
    const b = [1, 1, 0.5, 0.33, 0.5, 1];
    expect(pairedBootstrap(a, b, { seed: 3 })).toEqual(
      pairedBootstrap(a, b, { seed: 3 }),
    );
  });

  it("puts a steady gain above 0 and a one-query gain around 0", () => {
    const steady = pairedBootstrap(
      Array<number>(30).fill(0.5),
      Array<number>(30).fill(0.6),
    );
    expect(steady.diff).toBeCloseTo(0.1);
    expect(steady.low).toBeGreaterThan(0);
    const lucky = pairedBootstrap(Array<number>(30).fill(0.5), [
      1,
      ...Array<number>(29).fill(0.5),
    ]);
    expect(lucky.low).toBe(0);
    expect(lucky.high).toBeGreaterThan(0);
  });

  it("refuses unequal or empty lists", () => {
    expect(() => pairedBootstrap([1], [1, 2])).toThrow();
    expect(() => pairedBootstrap([], [])).toThrow();
  });
});
