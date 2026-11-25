/**
 * Ward's report: one verdict per MASVS control in scope, with the MASTG
 * tests (and untested MASWE weaknesses) nested under it as evidence
 * (ADR 0012). Zod schemas, so the same definition validates a report and
 * gives its JSON Schema.
 */
import * as z from "zod/v4";

export const REPORT_SCHEMA = "ward-report/1";

/** PRODUCT.md's verdicts. Never PASS. */
export const VERDICTS = [
  "FAIL",
  "MANUAL",
  "NEEDS DYNAMIC",
  "NO FINDING",
  "N/A",
] as const;
export const verdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof verdictSchema>;

const id = z.string().min(1).max(64);

/**
 * One piece of evidence. `file` is relative to the project root. `detail`
 * and `quote` hold text from the checked app's files: data, never
 * instructions. `quote` is the exact text at `line`; the citation checker
 * compares it with the file byte for byte.
 */
export const evidenceSchema = z.object({
  file: z.string().min(1).max(1024),
  line: z.number().int().positive(),
  detail: z.string().max(2000),
  quote: z.string().max(2000).optional(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

/**
 * Who set a check's verdict. analyzer: Ward's plain code. owasp: follows
 * from the index (a placeholder test, a dynamic-only test). agent: the
 * coding agent, after reading the code.
 */
export const BY = ["analyzer", "owasp", "agent"] as const;

/**
 * How deep a verdict went, set in code (ADR 0013). analyzer: Ward's code
 * read the files. index: follows from the index (placeholder,
 * dynamic-only, no test). test text: the agent answered after Ward served
 * it the check's MASTG/MASWE text. title only: the agent answered without
 * it. "Served" is not "understood": it is what Ward gave the agent.
 */
export const DEPTHS = ["analyzer", "index", "test text", "title only"] as const;
export const depthSchema = z.enum(DEPTHS);
export type Depth = z.infer<typeof depthSchema>;

/** One MASTG test under a control, or a MASWE weakness that has no test. */
export const checkSchema = z.object({
  id,
  kind: z.enum(["test", "weakness"]),
  title: z.string(),
  /** placeholder: OWASP has the ID but no content yet. */
  status: z.enum(["active", "placeholder"]),
  /** The weaknesses of this control the test covers (from the index). */
  maswe: z.array(id),
  /** null: not decided yet (pending). */
  verdict: verdictSchema.nullable(),
  by: z.enum(BY).nullable(),
  /**
   * Analyzer(s) whose verdict this is, when `by` is analyzer; kept when
   * the agent settles an analyzer's MANUAL (`by` is then agent).
   */
  analyzer: z.string().optional(),
  reason: z.string().max(4000).nullable(),
  evidence: z.array(evidenceSchema),
  /**
   * Files the agent read to reach its verdict, relative to the project
   * root. An analyzer's files are in the report's `analyzers` entry.
   */
  filesInspected: z.array(z.string()),
  /** null while pending; absent in reports from before Ward 0.10. */
  depth: depthSchema.nullable().optional(),
  /**
   * A hardening check reported apart (ADR 0014): no profile given and the
   * test asks whether an L2/R protection is present. Its verdict stays out
   * of the control verdict and `counts.checks`. Absent: false.
   */
  hardening: z.boolean().optional(),
});
export type Check = z.infer<typeof checkSchema>;

export const controlSchema = z.object({
  id,
  title: z.string(),
  /** Rolled up from `checks` in code (rollup.ts); null while pending. */
  verdict: verdictSchema.nullable(),
  checks: z.array(checkSchema),
});
export type Control = z.infer<typeof controlSchema>;

const countsSchema = z.record(z.string(), z.number().int().nonnegative());

/** What wasn't checked, by ID. Computed in code from the checks. */
export const gapsSchema = z.object({
  /** Checks with no verdict yet. */
  pending: z.array(id),
  manual: z.array(id),
  needsDynamic: z.array(id),
  /**
   * MASVS groups not in this report's scope, and controls with nothing in
   * the chosen profile.
   */
  outOfScope: z.array(z.string()),
});
export type Gaps = z.infer<typeof gapsSchema>;

/** One analyzer's run: what it read and what it says it can't see. */
export const analyzerRunSchema = z.object({
  name: z.string(),
  filesInspected: z.array(z.string()),
  limits: z.array(z.string()),
  /** Set when the analyzer couldn't run; its checks stay pending. */
  error: z.string().optional(),
});
export type AnalyzerRun = z.infer<typeof analyzerRunSchema>;

export const reportSchema = z.object({
  schema: z.literal(REPORT_SCHEMA),
  notice: z.string(),
  scope: z.object({
    groups: z.array(z.string()),
    profile: z.string().nullable(),
    variant: z.string(),
  }),
  stamps: z.object({
    wardVersion: z.string(),
    mastg: z.object({ version: z.string(), commit: z.string() }).nullable(),
    /** When the OSV data was downloaded; null without data. */
    osvDate: z.string().nullable(),
  }),
  analyzers: z.array(analyzerRunSchema),
  controls: z.array(controlSchema),
  /** Per verdict (and "pending"), for controls and for checks. */
  counts: z.object({
    controls: countsSchema,
    checks: countsSchema,
    /** Decided checks per depth; absent before Ward 0.10. */
    depth: countsSchema.optional(),
    /** Hardening checks per verdict (ADR 0014); absent when there are none. */
    hardening: countsSchema.optional(),
  }),
  gaps: gapsSchema,
});
export type Report = z.infer<typeof reportSchema>;

/** The report's JSON Schema, for tools outside TypeScript. */
export function reportJsonSchema(): object {
  return z.toJSONSchema(reportSchema);
}
