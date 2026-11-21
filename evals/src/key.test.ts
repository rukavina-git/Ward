import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AnchorError,
  findAnchor,
  itemsInApp,
  loadKey,
  resolveItems,
  type AppKind,
} from "./key.js";
import { keyPath, repoRoot } from "./paths.js";

describe("findAnchor", () => {
  it("gives the line of the one match", () => {
    expect(findAnchor("a\nb\nc\n", "b")).toEqual({ startLine: 2, endLine: 2 });
  });

  it("spans lines for an anchor with a newline", () => {
    expect(findAnchor("a\nb\nc", "b\nc")).toEqual({ startLine: 2, endLine: 3 });
  });

  it("fails when the anchor is missing", () => {
    expect(() => findAnchor("a\nb", "z")).toThrow(AnchorError);
  });

  it("fails when the anchor occurs twice, overlapping included", () => {
    expect(() => findAnchor("x\nx", "x")).toThrow(/more than once/);
    expect(() => findAnchor("aaa", "aa")).toThrow(/more than once/);
  });
});

describe("the real answer key", () => {
  const key = loadKey(keyPath);

  it("has 23 issues and 10 decoys", () => {
    expect(key.items.filter((i) => !i.decoy)).toHaveLength(23);
    expect(key.items.filter((i) => i.decoy)).toHaveLength(10);
  });

  it("puts issues in the planted app only, and clean-only decoys in the twin only", () => {
    expect(itemsInApp(key, "clean").every((i) => i.decoy)).toBe(true);
    expect(itemsInApp(key, "planted").some((i) => i.app === "clean")).toBe(
      false,
    );
  });

  // Replaces step 02's one-off check: every anchor occurs exactly once.
  it.each<AppKind>(["planted", "clean"])(
    "resolves every anchor in the %s app",
    (app) => {
      const resolved = resolveItems(key, app, join(repoRoot, key.apps[app]));
      expect(resolved).toHaveLength(itemsInApp(key, app).length);
      for (const { locations } of resolved) {
        for (const loc of locations) expect(loc.startLine).toBeGreaterThan(0);
      }
    },
  );
});
