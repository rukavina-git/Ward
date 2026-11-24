import {
  analyzeBuildConfig,
  analyzeDependencies,
  analyzeManifest,
  analyzeMustExist,
  analyzeNetwork,
  ProjectRootError,
} from "@ward/analyzers";
import { buildSkeleton, type AnalyzerInput, type Report } from "@ward/report";
import type { CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { mastgPin, projectInput, withMaswe } from "./app-tool.js";
import { MASVS_GROUPS } from "./checklist-tool.js";
import { knowledgeBase } from "./knowledge.js";
import { WARD_VERSION } from "./version.js";

export const reportSkeletonInput = projectInput.extend({
  group: z
    .enum(MASVS_GROUPS)
    .optional()
    .describe(
      "Only this MASVS group, e.g. 'MASVS-NETWORK'. Omit for all eight (about 20k tokens; ask one group at a time if your client truncates).",
    ),
  profile: z
    .enum(["L1", "L2", "R", "P"])
    .optional()
    .describe("Only items in this MAS profile. Omit for all."),
});

export type ReportSkeletonInput = z.input<typeof reportSkeletonInput>;

const ANALYZERS: [
  string,
  (root: string, variant: string) => Promise<object>,
][] = [
  ["manifest", analyzeManifest],
  ["network", analyzeNetwork],
  ["build_config", analyzeBuildConfig],
  ["dependencies", analyzeDependencies],
  ["must_exist", (root) => analyzeMustExist(root)],
];

export const reportSkeletonTool = {
  name: "report_skeleton",
  config: {
    title: "Ward report skeleton",
    description:
      "Start a Ward check here. Returns the report to fill: every MASVS control in scope with its MASTG tests (and MASWE weaknesses that have no test) nested under it, IDs and titles from the pinned OWASP index. Runs Ward's analyzers (manifest, network, build_config, dependencies, must_exist) and prefills their verdicts with evidence; placeholder tests and weaknesses without a test are MANUAL, dynamic-only tests NEEDS DYNAMIC. Checks with verdict null are yours to fill by reading the code. Control verdicts, counts and the coverage gaps are computed in code: worst check wins.",
    inputSchema: reportSkeletonInput,
    // Reads the app only, but the dependencies analyzer downloads OSV data.
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  handler: async (input: ReportSkeletonInput): Promise<CallToolResult> => {
    const built = await buildReport(input);
    if ("error" in built) return error(built.error);
    return {
      content: [{ type: "text", text: JSON.stringify(built.report) }],
      structuredContent: built.report,
    };
  },
};

/**
 * Runs the analyzers and builds the skeleton for a scope. Shared with
 * write_report, so the prefills there are the code's, never the agent's.
 * A bad root is `{ error }`; one analyzer failing leaves its checks
 * pending.
 */
export async function buildReport(
  input: ReportSkeletonInput,
): Promise<{ report: Report } | { error: string }> {
  const { projectRoot, variant, group, profile } =
    reportSkeletonInput.parse(input);
  const analyzers: AnalyzerInput[] = [];
  let osvDate: string | null = null;
  for (const [name, analyze] of ANALYZERS) {
    try {
      const report = withMaswe(await analyze(projectRoot, variant));
      analyzers.push({
        name,
        report: report as NonNullable<AnalyzerInput["report"]>,
      });
      const osv = (report as { osv?: { downloadedAt?: string | null } }).osv;
      if (osv) osvDate = osv.downloadedAt ?? null;
    } catch (e) {
      if (e instanceof ProjectRootError) return { error: e.message };
      analyzers.push({ name, error: (e as Error).message });
    }
  }
  const kb = knowledgeBase();
  const report = buildSkeleton({
    controls: kb.checklist({ group, profile }),
    analyzers,
    scope: {
      groups: group ? [group] : [...MASVS_GROUPS],
      profile: profile ?? null,
      variant,
    },
    stamps: { wardVersion: WARD_VERSION, mastg: mastgPin(), osvDate },
    allGroups: MASVS_GROUPS,
  });
  return { report };
}

function error(message: string): CallToolResult {
  const out = { error: message };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(out) }],
    structuredContent: out,
  };
}
