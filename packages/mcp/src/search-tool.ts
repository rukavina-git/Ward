import { TUNED_SEARCH } from "@ward/core";
import type { CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { jsonResult, knowledgeBase, readOnly } from "./knowledge.js";

export const searchInput = z.object({
  query: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "Words to look for, e.g. 'cleartext traffic network security config' or a finding in plain English. IDs in the query (MASWE-0050) are looked up exactly and come first.",
    ),
  k: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(8)
    .describe("How many results, 1 to 20. Default 8."),
});

export type SearchInput = z.input<typeof searchInput>;

export const searchTool = {
  name: "search",
  config: {
    title: "Search OWASP MAS text",
    description:
      "Keyword search (BM25) over the text of MASVS controls, MASWE weaknesses and MASTG tests and demos. Returns the top k passages with their record ID, section, text, citation, and matchedTerms (the query words found in that passage). unmatchedTerms lists query words found nowhere. There is no relevance cutoff: the top results can be unrelated, so judge each by its text and matchedTerms, and say so if none fits. Use get_check for a full record.",
    inputSchema: searchInput,
    annotations: readOnly,
  },
  handler: ({ query, k = 8 }: SearchInput): CallToolResult => {
    const kb = knowledgeBase();
    const options = { ...TUNED_SEARCH, limit: k };
    const hits = kb.search(query, options).map((hit, i) => {
      const chunk = kb.chunk(hit.chunk);
      const record = kb.get(hit.record)?.record;
      return {
        rank: i + 1,
        chunk: hit.chunk,
        record: hit.record,
        title: record?.title ?? "",
        kind: chunk?.kind ?? null,
        status: chunk?.status ?? null,
        section: chunk?.section ?? [],
        match: hit.match,
        score: hit.score === null ? null : Number(hit.score.toFixed(3)),
        matchedTerms: kb.matchedTerms(query, hit.chunk, options),
        url: chunk?.url ?? "",
        version: chunk?.version ?? "",
        licence: chunk?.licence ?? "",
        text: chunk?.text ?? "",
      };
    });
    return jsonResult({
      query,
      unmatchedTerms: kb.unmatchedTerms(query, options),
      hits,
      note:
        hits.length === 0
          ? "Nothing matched. Ward's sources have nothing on this query; say so rather than guess."
          : "Ranked by keyword overlap only; no cutoff. Results may be unrelated.",
    });
  },
};
