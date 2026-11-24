import type { Report } from "@ward/report";
import type { KeyItem } from "./key.js";
import type { ToolCall } from "./isolation.js";

// Free proxy metrics for a `ward-check` run (ADR 0013): read from the saved
// report and transcript, no model call. They say how deep the agent went,
// not whether it was right. The gate: the agent read the test text for at
// least GATE_SHARE of the checks it answered.

export const GATE_SHARE = 0.8;

export interface Proxy {
  /** Calls to Ward's tools, by tool name (server prefix dropped). */
  wardCalls: Record<string, number>;
  /** Distinct check IDs the agent answered. */
  agentAnswers: number;
  /** Of those, answered after Ward served their text. */
  testText: number;
  /** testText / agentAnswers; null with no answers. */
  share: number | null;
  /** Where `testText` came from: the report's depth, or get_check calls. */
  depthFrom: "report" | "transcript";
  /** Distinct IDs the agent marked NO FINDING. */
  agentNoFinding: number;
  /** Of those, with no file read listed. */
  noFindingNoFiles: number;
  /** Of those, with no file:line evidence. */
  noFindingNoEvidence: number;
  /**
   * Planted issues (key items, not decoys) with a NO FINDING on one of
   * their MASTG tests or MASWE weaknesses: item ID → check IDs. Only with
   * a key. A lead for a hand check, not a verdict: an item may list a
   * test that rightly finds nothing.
   */
  falseNoFinding: Record<string, string[]>;
  gate: boolean;
}

/** The IDs get_check returned in a run, as the index spells them. */
export function servedFromCalls(calls: readonly ToolCall[], server: string) {
  const ids = new Set<string>();
  for (const c of calls)
    if (
      c.name === `mcp__${server}__get_check` &&
      c.isError !== true &&
      typeof c.input.id === "string"
    )
      ids.add(c.input.id.trim().toUpperCase());
  return ids;
}

export function proxyMetrics(
  report: Report,
  calls: readonly ToolCall[],
  opts: { server?: string; planted?: readonly KeyItem[] | undefined } = {},
): Proxy {
  const server = opts.server ?? "ward";
  const prefix = `mcp__${server}__`;
  const wardCalls: Record<string, number> = {};
  for (const c of calls)
    if (c.name.startsWith(prefix)) {
      const t = c.name.slice(prefix.length);
      wardCalls[t] = (wardCalls[t] ?? 0) + 1;
    }

  const rows = report.controls.flatMap((c) => c.checks);
  const hasDepth = rows.some((r) => r.depth !== undefined);
  const served = servedFromCalls(calls, server);
  const answered = new Set<string>();
  const read = new Set<string>();
  const nf = new Set<string>();
  const nfNoFiles = new Set<string>();
  const nfNoEvidence = new Set<string>();
  for (const r of rows) {
    if (r.by !== "agent" || r.verdict === null) continue;
    answered.add(r.id);
    const deep = hasDepth ? r.depth === "test text" : served.has(r.id);
    if (deep) read.add(r.id);
    if (r.verdict === "NO FINDING") {
      nf.add(r.id);
      if (r.filesInspected.length === 0) nfNoFiles.add(r.id);
      if (r.evidence.length === 0) nfNoEvidence.add(r.id);
    }
  }

  const falseNoFinding: Record<string, string[]> = {};
  for (const item of opts.planted ?? []) {
    if (item.decoy) continue;
    const ids = new Set([...(item.mastg ?? []), ...item.maswe]);
    const hits = [
      ...new Set(
        rows
          .filter((r) => r.verdict === "NO FINDING" && ids.has(r.id))
          .map((r) => r.id),
      ),
    ].sort();
    if (hits.length > 0) falseNoFinding[item.id] = hits;
  }

  const share = answered.size === 0 ? null : read.size / answered.size;
  return {
    wardCalls,
    agentAnswers: answered.size,
    testText: read.size,
    share,
    depthFrom: hasDepth ? "report" : "transcript",
    agentNoFinding: nf.size,
    noFindingNoFiles: nfNoFiles.size,
    noFindingNoEvidence: nfNoEvidence.size,
    falseNoFinding,
    gate: share !== null && share >= GATE_SHARE,
  };
}
