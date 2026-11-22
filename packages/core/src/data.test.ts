import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultIndexPath, loadIndex } from "./load.js";
import { KnowledgeBase } from "./lookup.js";

// Checks on the committed index itself (packages/core/data/index.json),
// so CI catches a broken or stale file without running ingest.
const index = loadIndex();
const kb = new KnowledgeBase(index);
const CHUNK_MAX_CHARS = 1500;

describe("shipped index", () => {
  it("has step 01's record counts", () => {
    const counts: Record<string, number> = {};
    for (const r of index.records) {
      const key = `${r.kind} ${r.status}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts).toEqual({
      "control active": 24,
      "weakness active": 77,
      "test active": 98,
      "test placeholder": 14,
      "test deprecated": 51,
      "demo active": 89,
      "demo placeholder": 5,
    });
  });

  it("has no embeddings yet, and the three pinned sources", () => {
    expect(index.embedding).toBeNull();
    expect(index.sources.map((s) => `${s.name} ${s.version}`)).toEqual([
      "OWASP MASVS v2.1.0",
      "OWASP MASWE v1.0.0",
      "OWASP MASTG v2.0.0",
    ]);
  });

  it("links every chunk to one record and every record to its chunks", () => {
    const byId = new Map(index.records.map((r) => [r.id, r]));
    for (const c of index.chunks) {
      expect(byId.get(c.record)?.chunks).toContain(c.id);
    }
    const listed = index.records.flatMap((r) => r.chunks);
    expect(new Set(listed).size).toBe(index.chunks.length);
    expect(index.records.every((r) => r.chunks.length > 0)).toBe(true);
  });

  it("gives every chunk its citation fields", () => {
    for (const c of index.chunks) {
      expect(c.url).toMatch(
        /^https:\/\/github\.com\/OWASP\/(masvs|maswe|mastg)\/blob\/v\d/,
      );
      expect(c.url).toContain(`/blob/${c.version}/`);
      expect(c.licence).toBe("CC-BY-SA-4.0");
      expect(c.text.trim()).not.toBe("");
    }
  });

  it("keeps chunks under the limit, except single lines that can't split", () => {
    const over = index.chunks.filter((c) => c.text.length > CHUNK_MAX_CHARS);
    for (const c of over)
      expect(c.text.split("\n").some((l) => l.length > 500)).toBe(true);
    expect(over.length).toBeLessThan(10);
  });

  it("is sorted by ID", () => {
    const ids = index.records.map((r) => r.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("walks the 18 known answer-key mappings from control to test", () => {
    const keyPath = join(
      defaultIndexPath,
      "../../../../evals/answer-keys/example-app.json",
    );
    const key = JSON.parse(readFileSync(keyPath, "utf8")) as {
      items: {
        decoy?: boolean;
        masvs?: string[];
        maswe?: string[];
        mastg?: string[];
      }[];
    };
    let checked = 0;
    for (const item of key.items) {
      if (item.decoy || !item.mastg?.length) continue;
      checked++;
      for (const test of item.mastg) {
        const viaControl = (item.masvs ?? []).some((c) =>
          kb.related(c, "test")?.records.some((r) => r.id === test),
        );
        const weaknesses =
          kb.related(test, "weakness")?.records.map((r) => r.id) ?? [];
        expect(viaControl, `${test} from ${String(item.masvs)}`).toBe(true);
        expect(
          weaknesses.some((w) => item.maswe?.includes(w)),
          test,
        ).toBe(true);
      }
    }
    expect(checked).toBe(18);
  });
});
