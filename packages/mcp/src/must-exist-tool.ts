import { analyzeMustExist } from "@ward/analyzers";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { projectInput, runAnalyzer, type ProjectInput } from "./app-tool.js";
import { readOnly } from "./knowledge.js";

export const mustExistTool = {
  name: "must_exist",
  config: {
    title: "Check what Google Play requires to exist",
    description:
      "Scans the app's Kotlin, Java and res/ XML with plain code (no LLM) for things Google Play requires the app to contain. Three verdicts: account-deletion (MASWE-0076: sign-up code with no delete-account code, text or link is FAIL), privacy-policy (MASWE-0072: no in-app link or text is FAIL; a found link is MANUAL, the policy isn't read), data-deletion-url (MASWE-0073: always MANUAL, it lives in Play Console). Signals are text patterns, not proof: read `limits`.",
    inputSchema: projectInput,
    annotations: readOnly,
  },
  handler: (input: ProjectInput): Promise<CallToolResult> =>
    runAnalyzer(input, (root) => analyzeMustExist(root)),
};
