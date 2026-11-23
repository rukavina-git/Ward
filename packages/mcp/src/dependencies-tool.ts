import { analyzeDependencies } from "@ward/analyzers";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { projectInput, runAnalyzer, type ProjectInput } from "./app-tool.js";

export const dependenciesTool = {
  name: "dependencies",
  config: {
    title: "Check dependencies against OSV",
    description:
      "Reads the Maven dependencies each module declares (build files and gradle/libs.versions.toml) with plain code (no LLM) and matches their versions against OSV's known-vulnerability ranges (MASTG-TEST-0272). Downloads OSV's public Maven data at most once a day into a local cache; nothing about the app is sent. FAIL per vulnerable dependency with advisory IDs, fixed versions and file:line; every verdict carries the data date. Direct dependencies only: transitive and BOM-managed versions are listed as unresolved in the MANUAL verdict. Lists release dependencies with versions; test, debug and build-time ones are only counted.",
    inputSchema: projectInput,
    // Reads the app only, but downloads public data from osv.dev's bucket.
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  handler: (input: ProjectInput): Promise<CallToolResult> =>
    runAnalyzer(input, async (root, variant) => {
      const report = await analyzeDependencies(root, variant);
      // Keeps the answer small: only release dependencies are judged, so
      // the rest are counted. Unresolved ones are in the MANUAL evidence.
      const notJudged: Record<string, number> = {};
      for (const d of report.dependencies) {
        if (d.scope !== "release") {
          notJudged[d.scope] = (notJudged[d.scope] ?? 0) + 1;
        }
      }
      return {
        ...report,
        dependencies: report.dependencies.filter(
          (d) => d.scope === "release" && d.version !== undefined,
        ),
        notJudged,
      };
    }),
};
