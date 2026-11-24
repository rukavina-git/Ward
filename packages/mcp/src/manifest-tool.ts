import { analyzeManifest } from "@ward/analyzers";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { projectInput, runAnalyzer, type ProjectInput } from "./app-tool.js";
import { readOnly } from "./knowledge.js";

export const manifestTool = {
  name: "manifest",
  config: {
    title: "Analyze the Android manifest",
    description:
      "Reads the project's AndroidManifest.xml files and Gradle build files with plain code (no LLM) and returns exact facts with file:line: exported components, permissions (dangerous ones flagged), the application's backup and debuggable settings (including the build type's isDebuggable). One verdict per check, each with its MASTG test IDs. Prefers Gradle's merged manifest for the variant when a build left one; otherwise says the result is unmerged. Non-exported components are counted, not listed.",
    inputSchema: projectInput,
    annotations: readOnly,
  },
  handler: (input: ProjectInput): Promise<CallToolResult> =>
    runAnalyzer(input, async (root, variant) => {
      const report = await analyzeManifest(root, variant);
      const { components, ...facts } = report.facts;
      const listed = components.filter((c) => c.exported !== "no");
      return {
        ...report,
        facts: {
          ...facts,
          components: listed,
          notExportedCount: components.length - listed.length,
        },
      };
    }),
};
