import type {
  KnowledgeRecord,
  LinkOverride,
  RecordKind,
  RecordStatus,
} from "@ward/core";
import { describe, expect, it } from "vitest";
import { linkRecords } from "./graph.js";
import { emptyLinks, type Parsed } from "./parse.js";

function record(
  id: string,
  kind: RecordKind,
  links: Partial<KnowledgeRecord["links"]> = {},
  status: RecordStatus = "active",
): KnowledgeRecord {
  return {
    id,
    kind,
    title: id,
    status,
    body: "",
    fields: {},
    links: { ...emptyLinks(), ...links },
    files: [],
    source: {
      name: "",
      version: "",
      commit: "",
      path: "",
      url: "",
      licence: "",
    },
  };
}

const control = (id: string): Parsed => ({
  record: record(id, "control"),
  betaIds: [],
  namedWeakness: null,
});
const weakness = (
  id: string,
  controls: string[],
  betaIds: string[],
): Parsed => ({
  record: record(id, "weakness", { controls }),
  betaIds,
  namedWeakness: null,
});
const test = (id: string, named: string): Parsed => ({
  record: record(id, "test"),
  betaIds: [],
  namedWeakness: named,
});
const demo = (id: string, testId: string): Parsed => ({
  record: record(id, "demo", { tests: [testId] }),
  betaIds: [],
  namedWeakness: null,
});

const get = (records: KnowledgeRecord[], id: string): KnowledgeRecord => {
  const found = records.find((r) => r.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("linkRecords", () => {
  it("translates beta IDs, never trusting the number (MASWE renumbering)", () => {
    // The test names beta MASWE-0069. In v1, MASWE-0069 is something else;
    // MASWE-0034 is the weakness that lists beta 0069.
    const { records, problems } = linkRecords(
      [
        control("MASVS-PLATFORM-2"),
        weakness("MASWE-0069", ["MASVS-PLATFORM-2"], ["MASWE-0120"]),
        weakness(
          "MASWE-0034",
          ["MASVS-PLATFORM-2"],
          ["MASWE-0069", "MASWE-0073"],
        ),
        test("MASTG-TEST-0001", "MASWE-0069"),
      ],
      [],
    );
    expect(problems).toEqual([]);
    expect(get(records, "MASTG-TEST-0001").links.weaknesses).toEqual([
      "MASWE-0034",
    ]);
  });

  it("stores links both ways, sorted and without duplicates", () => {
    const { records, problems } = linkRecords(
      [
        demo("MASTG-DEMO-0002", "MASTG-TEST-0001"),
        demo("MASTG-DEMO-0001", "MASTG-TEST-0001"),
        test("MASTG-TEST-0001", "MASWE-0099"),
        weakness(
          "MASWE-0001",
          ["MASVS-B-1", "MASVS-A-1", "MASVS-A-1"],
          ["MASWE-0099"],
        ),
        control("MASVS-B-1"),
        control("MASVS-A-1"),
      ],
      [],
    );
    expect(problems).toEqual([]);
    expect(records.map((r) => r.id)).toEqual([
      "MASTG-DEMO-0001",
      "MASTG-DEMO-0002",
      "MASTG-TEST-0001",
      "MASVS-A-1",
      "MASVS-B-1",
      "MASWE-0001",
    ]);
    expect(get(records, "MASVS-A-1").links.weaknesses).toEqual(["MASWE-0001"]);
    expect(get(records, "MASWE-0001").links.controls).toEqual([
      "MASVS-A-1",
      "MASVS-B-1",
    ]);
    expect(get(records, "MASWE-0001").links.tests).toEqual(["MASTG-TEST-0001"]);
    expect(get(records, "MASTG-TEST-0001").links.demos).toEqual([
      "MASTG-DEMO-0001",
      "MASTG-DEMO-0002",
    ]);
  });

  it("reports a beta ID that translates to several weaknesses or none", () => {
    const { problems } = linkRecords(
      [
        weakness("MASWE-0007", ["MASVS-C-1"], ["MASWE-0012"]),
        weakness("MASWE-0010", ["MASVS-C-1"], ["MASWE-0012"]),
        test("MASTG-TEST-0307", "MASWE-0012"),
        test("MASTG-TEST-0324", "MASWE-0097"),
      ],
      [],
    );
    expect(problems).toEqual([
      "MASTG-TEST-0307 names beta MASWE-0012, which translates to MASWE-0007, MASWE-0010: add an override",
      "MASTG-TEST-0324 names beta MASWE-0097, which translates to no weakness: add an override",
    ]);
  });

  it("applies an override, and reports stale and unused ones", () => {
    const fix = (test: string, named: string): LinkOverride => ({
      test,
      named,
      weaknesses: ["MASWE-0051"],
      reason: "r",
    });
    const { records, applied, problems } = linkRecords(
      [
        weakness("MASWE-0051", ["MASVS-R-1"], []),
        test("MASTG-TEST-0325", "MASWE-0097"),
        test("MASTG-TEST-0324", "MASWE-0097"),
        test("MASTG-TEST-0400", "MASWE-0200"),
      ],
      [
        fix("MASTG-TEST-0325", "MASWE-0097"),
        fix("MASTG-TEST-0324", "MASWE-0097"),
        fix("MASTG-TEST-0400", "MASWE-0012"),
        fix("MASTG-TEST-9999", "MASWE-0001"),
      ],
    );
    expect(get(records, "MASTG-TEST-0324").links.weaknesses).toEqual([
      "MASWE-0051",
    ]);
    expect(get(records, "MASWE-0051").links.tests).toEqual([
      "MASTG-TEST-0324",
      "MASTG-TEST-0325",
    ]);
    expect(applied.map((o) => o.test)).toEqual([
      "MASTG-TEST-0324",
      "MASTG-TEST-0325",
    ]);
    expect(problems).toEqual([
      "override for MASTG-TEST-0400 expects MASWE-0012, but the test names MASWE-0200: review it",
      "override for MASTG-TEST-9999 matches no test",
    ]);
  });

  it("keeps deprecated tests out of weakness → test links", () => {
    const old: Parsed = {
      record: record(
        "MASTG-TEST-0017",
        "test",
        { controls: ["MASVS-A-1"], coveredBy: ["MASTG-TEST-0327"] },
        "deprecated",
      ),
      betaIds: [],
      namedWeakness: null,
    };
    const { records, problems } = linkRecords([control("MASVS-A-1"), old], []);
    expect(problems).toEqual([]);
    expect(get(records, "MASVS-A-1").links).toEqual(emptyLinks());
  });

  it("reports duplicate IDs", () => {
    const { problems } = linkRecords(
      [control("MASVS-A-1"), control("MASVS-A-1")],
      [],
    );
    expect(problems).toEqual(["MASVS-A-1 appears twice"]);
  });
});
