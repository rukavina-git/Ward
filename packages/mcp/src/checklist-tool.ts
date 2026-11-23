import type { CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { jsonResult, knowledgeBase, readOnly } from "./knowledge.js";

/** The MASVS v2 groups; a test checks this list against the index. */
export const MASVS_GROUPS = [
  "MASVS-AUTH",
  "MASVS-CODE",
  "MASVS-CRYPTO",
  "MASVS-NETWORK",
  "MASVS-PLATFORM",
  "MASVS-PRIVACY",
  "MASVS-RESILIENCE",
  "MASVS-STORAGE",
] as const;

export const checklistInput = z.object({
  group: z
    .enum(MASVS_GROUPS)
    .optional()
    .describe("Only this MASVS group, e.g. 'MASVS-NETWORK'. Omit for all."),
  profile: z
    .enum(["L1", "L2", "R", "P"])
    .optional()
    .describe(
      "Only items in this MAS profile: L1 (baseline security), L2 (defence in depth), R (resilience against reverse engineering), P (privacy). Omit for all.",
    ),
});

export type ChecklistInput = z.infer<typeof checklistInput>;

export const checklistTool = {
  name: "checklist",
  config: {
    title: "Ward checklist (OWASP MAS, Android)",
    description:
      "Lists what to check in an Android app: each OWASP MASVS control, its MASWE weaknesses that apply to Android, and the MASTG tests for each weakness, with IDs, titles, profiles, and test types (static, dynamic, ...). No body text and no citations: call get_check with an ID for the text and its source URL. Tests with status 'placeholder' exist in OWASP but have no content yet: the weakness still needs checking by hand. Start an audit here.",
    inputSchema: checklistInput,
    annotations: readOnly,
  },
  handler: ({ group, profile }: ChecklistInput): CallToolResult => {
    const kb = knowledgeBase();
    const controls = kb.checklist({ group, profile });
    return jsonResult({
      filter: { group: group ?? null, profile: profile ?? null },
      sources: kb.index.sources.map((s) => ({
        name: s.name,
        version: s.version,
        licence: s.licence,
      })),
      controls,
    });
  },
};
