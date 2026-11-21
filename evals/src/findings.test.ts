import { describe, expect, it } from "vitest";
import {
  readSchemaText,
  validateFindings,
  type Finding,
  type Findings,
} from "./findings.js";

const finding: Finding = {
  title: "Something wrong",
  category: "security",
  severity: "high",
  verdict: "FAIL",
  masvs: ["MASVS-STORAGE-1"],
  maswe: [],
  locations: [{ file: "app/x.kt", line: 3, endLine: 5 }],
  explanation: "Why it matters.",
};
const valid: Findings = { findings: [finding], inspected: ["app/x.kt"] };

function withFinding(patch: Record<string, unknown>): unknown {
  return { findings: [{ ...finding, ...patch }], inspected: [] };
}

describe("validateFindings", () => {
  it("accepts valid output and returns it", () => {
    expect(validateFindings(valid)).toEqual({ ok: true, value: valid });
  });

  it("accepts no findings", () => {
    expect(validateFindings({ findings: [], inspected: [] }).ok).toBe(true);
  });

  it("rejects a missing field", () => {
    expect(validateFindings(withFinding({ explanation: undefined })).ok).toBe(
      false,
    );
  });

  it("rejects a verdict outside the list, such as PASS", () => {
    const result = validateFindings(withFinding({ verdict: "PASS" }));
    expect(result).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("verdict")],
    });
  });

  it("rejects unknown fields", () => {
    expect(validateFindings({ ...valid, note: "hi" }).ok).toBe(false);
    expect(validateFindings(withFinding({ fix: "x" })).ok).toBe(false);
  });

  it("rejects lines that aren't whole numbers from 1", () => {
    expect(
      validateFindings(withFinding({ locations: [{ file: "a", line: 0 }] })).ok,
    ).toBe(false);
    expect(
      validateFindings(withFinding({ locations: [{ file: "a", line: 2.5 }] }))
        .ok,
    ).toBe(false);
  });

  it("rejects an endLine before the line", () => {
    const result = validateFindings(
      withFinding({ locations: [{ file: "a", line: 9, endLine: 3 }] }),
    );
    expect(result).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("endLine")],
    });
  });

  it("rejects things that aren't findings at all", () => {
    for (const raw of [null, "text", [], { findings: "none" }]) {
      expect(validateFindings(raw).ok).toBe(false);
    }
  });
});

describe("the schema file", () => {
  // The TypeScript types are written by hand: this keeps them in step.
  const schema = JSON.parse(readSchemaText()) as {
    properties: {
      findings: {
        items: {
          required: string[];
          properties: {
            locations: { items: { properties: Record<string, unknown> } };
          };
        };
      };
    };
  };

  it("requires exactly the fields of a Finding", () => {
    expect([...schema.properties.findings.items.required].sort()).toEqual(
      Object.keys(finding).sort(),
    );
  });

  it("has the location fields of a FindingLocation", () => {
    const loc =
      schema.properties.findings.items.properties.locations.items.properties;
    expect(Object.keys(loc).sort()).toEqual(["endLine", "file", "line"]);
  });
});
