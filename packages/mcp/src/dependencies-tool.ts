import { analyzeDependencies } from "@ward/analyzers";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { projectInput, runAnalyzer, type ProjectInput } from "./app-tool.js";

export const dependenciesTool = {
  name: "dependencies",
  config: {
    title: "Check dependencies against OSV",
    description:
      "Reads the Maven dependencies each module declares (build files and gradle/libs.versions.toml) with plain code (no LLM) and matches their versions against OSV's known-vulnerability ranges (MASTG-TEST-0272). Downloads OSV's public Maven data at most once a day into a local cache; nothing about the app is sent. FAIL per vulnerable dependency with advisory IDs, fixed versions and file:line; every verdict carries the data date. Direct dependencies only: transitive and BOM-managed versions are listed as unresolved.",
    inputSchema: projectInput,
    // Reads the app only, but downloads public data from osv.dev's bucket.
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  handler: (input: ProjectInput): Promise<CallToolResult> =>
    runAnalyzer(input, (root, variant) => analyzeDependencies(root, variant)),
};
