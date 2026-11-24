import type { RecordKind } from "@ward/core";
import type { CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { citation, jsonResult, knowledgeBase, readOnly } from "./knowledge.js";

export const getCheckInput = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .describe(
      "One OWASP MAS ID, any case: a control (MASVS-NETWORK-1), weakness (MASWE-0050), test (MASTG-TEST-0233) or demo (MASTG-DEMO-0001).",
    ),
});

export type GetCheckInput = z.infer<typeof getCheckInput>;

const kinds: readonly RecordKind[] = ["control", "weakness", "test", "demo"];
const plural: Record<RecordKind, string> = {
  control: "controls",
  weakness: "weaknesses",
  test: "tests",
  demo: "demos",
};

export const getCheckTool = {
  name: "get_check",
  config: {
    title: "Get one OWASP MAS item",
    description:
      "Returns one MASVS control, MASWE weakness, MASTG test or demo by exact ID: its full text in sections, its front-matter fields, the IDs it links to (a control's weaknesses and tests, a test's demos, ...) and the citation (source, version, URL, licence). An old MASTG v1 test lists the tests that replace it. An unknown ID returns found: false; Ward never guesses a near match.",
    inputSchema: getCheckInput,
    annotations: readOnly,
  },
  handler: ({ id }: GetCheckInput): CallToolResult => {
    const kb = knowledgeBase();
    const found = kb.get(id);
    if (!found) {
      return jsonResult({
        found: false,
        id,
        message:
          "No MASVS, MASWE or MASTG record has this ID. Use checklist or search to find one.",
      });
    }
    const { record, chunks } = found;
    const links: Record<string, string[]> = {};
    for (const kind of kinds) {
      if (kind === record.kind) continue;
      links[plural[kind]] = (kb.related(record.id, kind)?.records ?? []).map(
        (r) => r.id,
      );
    }
    return jsonResult({
      found: true,
      id: record.id,
      kind: record.kind,
      title: record.title,
      status: record.status,
      statusNote: statusNote(record.status, record.links.coveredBy),
      replacedBy: record.links.coveredBy,
      fields: record.fields,
      links,
      citation: citation(record),
      sections: chunks.map((c) => ({
        chunk: c.id,
        section: c.section,
        url: c.url,
        text: c.text,
      })),
    });
  },
};

function statusNote(status: string, coveredBy: string[]): string | null {
  if (status === "placeholder") {
    return "OWASP lists this ID but has not written its content yet. Check the weakness by hand.";
  }
  if (status === "deprecated") {
    return coveredBy.length > 0
      ? "Old MASTG v1 test. Use the tests in replacedBy; links are theirs."
      : "Old MASTG v1 test with no replacement yet; links are its own v1 links.";
  }
  return null;
}
