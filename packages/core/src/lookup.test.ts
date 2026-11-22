import { describe, expect, it } from "vitest";
import type { Chunk, IndexRecord, KnowledgeIndex } from "./index-file.js";
import { KnowledgeBase } from "./lookup.js";
import type { RecordKind, RecordLinks, RecordStatus } from "./records.js";

function rec(
  id: string,
  kind: RecordKind,
  links: Partial<RecordLinks> = {},
  status: RecordStatus = "active",
): IndexRecord {
  return {
    id,
    kind,
    title: id,
    status,
    fields: {},
    links: {
      controls: [],
      weaknesses: [],
      tests: [],
      demos: [],
      coveredBy: [],
      ...links,
    },
    source: {
      name: "",
      version: "",
      commit: "",
      path: "",
      url: "",
      licence: "",
    },
    chunks: [`${id}#0`],
  };
}

// A tiny graph: control C1 → weaknesses W1, W2 → tests T1 (W1), T2 (W2)
// → demo D1 (T1). Old test V1 is covered by T2; old test V2 has no
// replacements, only a v1 control link.
const records = [
  rec("MASVS-STORAGE-1", "control", {
    weaknesses: ["MASWE-0001", "MASWE-0002"],
  }),
  rec("MASWE-0001", "weakness", {
    controls: ["MASVS-STORAGE-1"],
    tests: ["MASTG-TEST-0200"],
  }),
  rec("MASWE-0002", "weakness", {
    controls: ["MASVS-STORAGE-1"],
    tests: ["MASTG-TEST-0201"],
  }),
  rec("MASTG-TEST-0200", "test", {
    weaknesses: ["MASWE-0001"],
    demos: ["MASTG-DEMO-0001"],
  }),
  rec("MASTG-TEST-0201", "test", { weaknesses: ["MASWE-0002"] }),
  rec("MASTG-DEMO-0001", "demo", { tests: ["MASTG-TEST-0200"] }),
  rec(
    "MASTG-TEST-0001",
    "test",
    { controls: ["MASVS-STORAGE-1"], coveredBy: ["MASTG-TEST-0201"] },
    "deprecated",
  ),
  rec(
    "MASTG-TEST-0002",
    "test",
    { controls: ["MASVS-STORAGE-1"] },
    "deprecated",
  ),
];
const chunks: Chunk[] = records.map((r) => ({
  id: `${r.id}#0`,
  record: r.id,
  kind: r.kind,
  status: r.status,
  section: [],
  text: `text of ${r.id}`,
  url: "",
  version: "",
  licence: "",
}));
const index: KnowledgeIndex = {
  format: 1,
  sources: [],
  overrides: [],
  embedding: null,
  records,
  chunks,
};
const kb = new KnowledgeBase(index);
const ids = (
  id: string,
  kind: RecordKind,
): { from: string | null; ids: string[] } | undefined => {
  const r = kb.related(id, kind);
  return r && { from: r.redirectedFrom, ids: r.records.map((x) => x.id) };
};

describe("KnowledgeBase.get", () => {
  it("finds a record and its chunks by exact ID", () => {
    const hit = kb.get("MASWE-0001");
    expect(hit?.record.kind).toBe("weakness");
    expect(hit?.chunks.map((c) => c.text)).toEqual(["text of MASWE-0001"]);
  });

  it("ignores case and stray spaces", () => {
    expect(kb.get(" masvs-storage-1 ")?.record.id).toBe("MASVS-STORAGE-1");
  });

  it("returns nothing for an unknown ID, never a near match", () => {
    expect(kb.get("MASWE-0003")).toBeUndefined();
    expect(kb.get("MASWE-000")).toBeUndefined();
    expect(kb.related("MASWE-0003", "test")).toBeUndefined();
  });
});

describe("KnowledgeBase.related", () => {
  it("walks down the chain: a control's weaknesses, tests and demos", () => {
    expect(ids("MASVS-STORAGE-1", "weakness")?.ids).toEqual([
      "MASWE-0001",
      "MASWE-0002",
    ]);
    expect(ids("MASVS-STORAGE-1", "test")?.ids).toEqual([
      "MASTG-TEST-0200",
      "MASTG-TEST-0201",
    ]);
    expect(ids("MASVS-STORAGE-1", "demo")?.ids).toEqual(["MASTG-DEMO-0001"]);
  });

  it("walks up the chain: a demo's test, weakness and control", () => {
    expect(ids("MASTG-DEMO-0001", "test")?.ids).toEqual(["MASTG-TEST-0200"]);
    expect(ids("MASTG-DEMO-0001", "weakness")?.ids).toEqual(["MASWE-0001"]);
    expect(ids("MASTG-DEMO-0001", "control")).toEqual({
      from: null,
      ids: ["MASVS-STORAGE-1"],
    });
  });

  it("returns the record itself for its own kind", () => {
    expect(ids("MASTG-TEST-0200", "test")?.ids).toEqual(["MASTG-TEST-0200"]);
  });

  it("redirects an old v1 test to the tests that replace it", () => {
    expect(ids("MASTG-TEST-0001", "test")).toEqual({
      from: "MASTG-TEST-0001",
      ids: ["MASTG-TEST-0201"],
    });
    expect(ids("mastg-test-0001", "weakness")).toEqual({
      from: "MASTG-TEST-0001",
      ids: ["MASWE-0002"],
    });
  });

  it("uses an old test's own links when nothing replaces it", () => {
    expect(ids("MASTG-TEST-0002", "control")).toEqual({
      from: null,
      ids: ["MASVS-STORAGE-1"],
    });
    expect(ids("MASTG-TEST-0002", "weakness")?.ids).toEqual([]);
  });
});
