import { describe, expect, it } from "vitest";
import { compareMaven, inRange, isAffected } from "./maven-version.js";

const lt = (a: string, b: string) => {
  expect(compareMaven(a, b)).toBeLessThan(0);
  expect(compareMaven(b, a)).toBeGreaterThan(0);
};
const eq = (a: string, b: string) => {
  expect(compareMaven(a, b)).toBe(0);
};

describe("compareMaven", () => {
  it("compares numbers as numbers", () => {
    lt("2.8.5", "2.8.9");
    lt("2.8.9", "2.10");
    lt("1.9", "1.10");
    lt("9", "10.0.1");
    lt("1.0.0", "12345678901234567890");
  });

  it("ignores trailing zeros and release words", () => {
    eq("1", "1.0");
    eq("1.0", "1.0.0");
    eq("1.0", "1.0-final");
    eq("1.0.ga", "1");
    eq("1.0-release", "1.0");
    eq("2.0.RELEASE", "2.0");
  });

  it("orders qualifiers", () => {
    lt("1.0-alpha1", "1.0-beta1");
    lt("1.0-beta2", "1.0-milestone1");
    lt("1.0-m1", "1.0-rc1");
    lt("1.0-rc1", "1.0-SNAPSHOT");
    lt("1.0-SNAPSHOT", "1.0");
    lt("1.0", "1.0-sp1");
    lt("1.0-sp1", "1.0-foo");
    eq("1.0-cr1", "1.0-rc1");
    eq("1.0-a1", "1.0-alpha1");
    eq("1.0alpha1", "1.0-alpha-1");
    lt("1.0-rc1", "1.0-rc2");
  });

  it("puts a release before the next number and a dotted number after a dash", () => {
    lt("1.0", "1.0.1");
    lt("1.0-1", "1.0.1");
    lt("1.0-beta", "1.0.1");
    lt("5.0.0-alpha.14", "5.0.0");
    lt("4.9.3", "5.0.0-alpha.1");
  });

  it("handles Android-style versions", () => {
    lt("1.13.0-alpha01", "1.13.0-beta01");
    lt("1.13.0-rc01", "1.13.0");
    lt("2024.01.00", "2026.11.01");
    lt("33.0.0-android", "33.0.1-android");
    lt("31.1-jre", "32.0.0-jre");
  });
});

describe("inRange", () => {
  const r = (...events: object[]) =>
    ({ type: "ECOSYSTEM", events }) as Parameters<typeof inRange>[1];

  it("introduced 0 to fixed", () => {
    const range = r({ introduced: "0" }, { fixed: "2.8.9" });
    expect(inRange("2.8.5", range)).toBe(true);
    expect(inRange("2.8.9", range)).toBe(false);
    expect(inRange("2.15.0", range)).toBe(false);
    expect(inRange("2.8.9-rc1", range)).toBe(true);
  });

  it("last_affected is inclusive", () => {
    const range = r({ introduced: "1.2" }, { last_affected: "1.4.1" });
    expect(inRange("1.1", range)).toBe(false);
    expect(inRange("1.2", range)).toBe(true);
    expect(inRange("1.4.1", range)).toBe(true);
    expect(inRange("1.4.2", range)).toBe(false);
  });

  it("several intervals in one range, events out of order", () => {
    const range = r(
      { fixed: "3.0.5" },
      { introduced: "3.0.0" },
      { introduced: "0" },
      { fixed: "2.9.10" },
    );
    expect(inRange("2.9.9", range)).toBe(true);
    expect(inRange("2.9.10", range)).toBe(false);
    expect(inRange("2.9.99", range)).toBe(false);
    expect(inRange("3.0.1", range)).toBe(true);
    expect(inRange("3.0.5", range)).toBe(false);
  });

  it("matches the explicit versions list", () => {
    expect(isAffected("1.7", { versions: ["1.6", "1.7"] })).toBe(true);
    expect(isAffected("1.8", { versions: ["1.6", "1.7"] })).toBe(false);
  });
});
