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

  it("returns an old test with no replacements for its own kind", () => {
    expect(ids("MASTG-TEST-0002", "test")).toEqual({
      from: null,
      ids: ["MASTG-TEST-0002"],
    });
  });
});

describe("KnowledgeBase.checklist", () => {
  const withFields = (
    r: IndexRecord,
    fields: IndexRecord["fields"],
  ): IndexRecord => ({ ...r, fields });
  const kb = new KnowledgeBase({
    ...index,
    records: [
      rec("MASVS-NETWORK-1", "control", { weaknesses: ["MASWE-0050"] }),
      rec("MASVS-STORAGE-1", "control", {
        weaknesses: ["MASWE-0001", "MASWE-0002", "MASWE-0003"],
      }),
      withFields(
        rec("MASWE-0001", "weakness", {
          tests: ["MASTG-TEST-0001", "MASTG-TEST-0200", "MASTG-TEST-0201"],
        }),
        { platform: ["android", "ios"], profiles: ["L1", "L2"] },
      ),
      withFields(rec("MASWE-0002", "weakness"), {
        platform: ["ios"],
        profiles: ["L1", "L2"],
      }),
      withFields(rec("MASWE-0003", "weakness"), {
        platform: ["android"],
        profiles: ["P"],
      }),
      withFields(
        rec("MASWE-0050", "weakness", { tests: ["MASTG-TEST-0233"] }),
        { platform: ["android"], profiles: ["L1", "L2"] },
      ),
      withFields(rec("MASTG-TEST-0001", "test", {}, "deprecated"), {
        profiles: ["L1"],
      }),
      withFields(rec("MASTG-TEST-0200", "test"), {
        profiles: ["L2"],
        type: ["dynamic"],
      }),
      withFields(rec("MASTG-TEST-0201", "test", {}, "placeholder"), {
        profiles: ["L1", "L2"],
        type: ["static", "code"],
      }),
      withFields(rec("MASTG-TEST-0233", "test"), {
        profiles: ["L1", "L2"],
        type: "static",
      }),
    ],
  });
  const shape = (filter = {}) =>
    kb.checklist(filter).map((c) => ({
      [c.id]: c.weaknesses.map((w) => ({ [w.id]: w.tests.map((t) => t.id) })),
    }));

  it("lists controls, Android weaknesses and their live tests", () => {
    expect(shape()).toEqual([
      { "MASVS-NETWORK-1": [{ "MASWE-0050": ["MASTG-TEST-0233"] }] },
      {
        "MASVS-STORAGE-1": [
          { "MASWE-0001": ["MASTG-TEST-0200", "MASTG-TEST-0201"] },
          { "MASWE-0003": [] },
        ],
      },
    ]);
  });

  it("keeps placeholder tests, marked, with their types", () => {
    const tests = kb.checklist()[1]?.weaknesses[0]?.tests;
    expect(tests?.map((t) => [t.id, t.status, t.type])).toEqual([
      ["MASTG-TEST-0200", "active", ["dynamic"]],
      ["MASTG-TEST-0201", "placeholder", ["static", "code"]],
    ]);
  });

  it("filters by group, any case", () => {
    expect(shape({ group: "masvs-network" })).toEqual([
      { "MASVS-NETWORK-1": [{ "MASWE-0050": ["MASTG-TEST-0233"] }] },
    ]);
    expect(shape({ group: "MASVS-NET" })).toEqual([]);
  });

  it("filters weaknesses and tests by profile", () => {
    expect(shape({ profile: "L1" })).toEqual([
      { "MASVS-NETWORK-1": [{ "MASWE-0050": ["MASTG-TEST-0233"] }] },
      { "MASVS-STORAGE-1": [{ "MASWE-0001": ["MASTG-TEST-0201"] }] },
    ]);
    expect(shape({ profile: "P" })).toEqual([
      { "MASVS-NETWORK-1": [] },
      { "MASVS-STORAGE-1": [{ "MASWE-0003": [] }] },
    ]);
  });
});

describe("search", () => {
  const recs = [
    { ...rec("MASWE-0001", "weakness"), title: "Sensitive data in logs" },
    rec("MASWE-0002", "weakness"),
    rec("MASTG-TEST-0200", "test"),
    {
      ...rec("MASTG-DEMO-0001", "demo"),
      chunks: ["MASTG-DEMO-0001#0", "MASTG-DEMO-0001#1"],
    },
    rec("MASWE-0099", "weakness", {}, "placeholder"),
  ];
  const chunk = (
    id: string,
    record: IndexRecord,
    text: string,
    section: string[] = [],
  ): Chunk => ({
    id,
    record: record.id,
    kind: record.kind,
    status: record.status,
    section,
    text,
    url: "",
    version: "",
    licence: "",
  });
  const [w1, w2, t1, d1, p1] = recs as [
    IndexRecord,
    IndexRecord,
    IndexRecord,
    IndexRecord,
    IndexRecord,
  ];
  const kb = new KnowledgeBase({
    format: 1,
    sources: [],
    overrides: [],
    embedding: null,
    records: recs,
    chunks: [
      chunk("MASWE-0001#0", w1, "Apps write tokens to logcat."),
      chunk("MASWE-0002#0", w2, "Keys are stored in plain SharedPreferences."),
      chunk("MASTG-TEST-0200#0", t1, "Check external storage for files."),
      chunk("MASTG-DEMO-0001#0", d1, "Run the sample and read the files."),
      chunk(
        "MASTG-DEMO-0001#1",
        d1,
        "external storage files; external storage files",
        ["MastgTest.kt"],
      ),
      chunk("MASWE-0099#0", p1, "Placeholder about logcat tokens."),
    ],
  });
  const ids = (q: string, o = {}) => kb.search(q, o).map((h) => h.chunk);

  it("finds text matches, with record and score", () => {
    const [hit] = kb.search("tokens in logcat");
    expect(hit).toMatchObject({
      chunk: "MASWE-0001#0",
      record: "MASWE-0001",
      match: "text",
    });
    expect(hit?.score).toBeGreaterThan(0);
  });

  it("searches the record title too", () => {
    expect(ids("sensitive")).toEqual(["MASWE-0001#0"]);
  });

  it("puts named IDs first, then text hits, without duplicates", () => {
    const hits = kb.search("maswe-0002: logcat tokens, MASWE-0002");
    expect(hits.map((h) => [h.chunk, h.match])).toEqual([
      ["MASWE-0002#0", "id"],
      ["MASWE-0001#0", "text"],
    ]);
    expect(hits[0]?.score).toBeNull();
  });

  it("never returns placeholders from text, but finds them by ID", () => {
    expect(ids("placeholder")).toEqual([]);
    expect(ids("MASWE-0099")).toEqual(["MASWE-0099#0"]);
  });

  it("returns nothing for unknown words, unknown IDs or stopwords only", () => {
    expect(ids("kerberos")).toEqual([]);
    expect(ids("MASWE-9999")).toEqual([]);
    expect(ids("the of", { stopwords: true })).toEqual([]);
    expect(ids("")).toEqual([]);
  });

  it("down-weights demo code with codeWeight", () => {
    expect(ids("external storage files")[0]).toBe("MASTG-DEMO-0001#1");
    expect(ids("external storage files", { codeWeight: 0.1 })[0]).toBe(
      "MASTG-TEST-0200#0",
    );
  });

  it("says which query words each hit matched, as written", () => {
    expect(kb.matchedTerms("Tokens in LOGCAT", "MASWE-0001#0")).toEqual([
      "tokens",
      "in",
      "logcat",
    ]);
    expect(
      kb.matchedTerms("tokens in logcat", "MASWE-0001#0", { stem: true }),
    ).toEqual(["tokens", "in", "logcat"]);
    expect(kb.matchedTerms("keys keys logcat", "MASWE-0002#0")).toEqual([
      "keys",
    ]);
    expect(kb.matchedTerms("logcat", "MASWE-0099#0")).toEqual([]);
  });

  it("lists query words found nowhere", () => {
    expect(kb.unmatchedTerms("kerberos tokens kerberos")).toEqual(["kerberos"]);
    expect(kb.unmatchedTerms("key", { stem: true })).toEqual([]);
    expect(kb.unmatchedTerms("key")).toEqual(["key"]);
  });

  it("respects limit and gives the same order every time", () => {
    expect(ids("files", { limit: 1 })).toHaveLength(1);
    expect(ids("storage files")).toEqual(ids("storage files"));
  });
});
