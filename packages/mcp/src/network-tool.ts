import { analyzeNetwork } from "@ward/analyzers";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { projectInput, runAnalyzer, type ProjectInput } from "./app-tool.js";
import { readOnly } from "./knowledge.js";

export const networkTool = {
  name: "network",
  config: {
    title: "Analyze network security settings",
    description:
      "Reads the app's network security config (resolved from the manifest for the variant's source sets), usesCleartextTraffic and SDK levels with plain code (no LLM). Returns each base-config, domain-config and debug-overrides with file:line, and verdicts with MASTG test IDs on cleartext traffic, user-installed CAs, certificate pinning and expired pins. Pinning in code is not read.",
    inputSchema: projectInput,
    annotations: readOnly,
  },
  handler: (input: ProjectInput): Promise<CallToolResult> =>
    runAnalyzer(input, (root, variant) => analyzeNetwork(root, variant)),
};
