import { analyzeBuildConfig } from "@ward/analyzers";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { projectInput, runAnalyzer, type ProjectInput } from "./app-tool.js";
import { readOnly } from "./knowledge.js";

export const buildConfigTool = {
  name: "build_config",
  config: {
    title: "Analyze Gradle build config",
    description:
      "Reads the app module's Gradle build files (and version catalog) with plain code (no LLM): minSdk, targetSdk and compileSdk with file:line, the variant's build type (isDebuggable, initWith). Values Ward can't resolve to a literal are reported, never guessed. One verdict (MASWE-0042) on Google Play's target API rule for phone and tablet apps, with the rule's date and source.",
    inputSchema: projectInput,
    annotations: readOnly,
  },
  handler: (input: ProjectInput): Promise<CallToolResult> =>
    runAnalyzer(input, (root, variant) => analyzeBuildConfig(root, variant)),
};
