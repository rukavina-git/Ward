import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { KnowledgeBase } from "@ward/core";
import { z } from "zod";
import { heldOutKey2Path, heldOutKeyPath } from "./paths.js";

const HELD_OUT_KEYS = [heldOutKeyPath, heldOutKey2Path];

// The held-out set (plan 4, step 01): real security fixes in open-source
// Android apps. The parent commit is the flawed app, the fix commit its
// clean twin. Only URLs, hashes, paths, lines and our own words are stored.

const sha = z.string().regex(/^[0-9a-f]{40}$/, "a full 40-hex commit hash");

const locationSchema = z
  .object({
    file: z.string().min(1),
    /** First and last line in the parent commit, from 1. */
    lines: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
    /** Short text that occurs exactly once in the file, inside `lines`. */
    anchor: z.string().min(1).optional(),
  })
  .refine((l) => l.lines[0] <= l.lines[1], "lines must be [start, end]");

const decoySchema = z.object({
  file: z.string().min(1),
  lines: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  anchor: z.string().min(1).optional(),
  why: z.string().min(1),
});

export const heldOutKinds = [
  "code",
  "config",
  "absence",
  "dependency",
] as const;

const caseSchema = z.object({
  id: z.string().regex(/^HO-\d{2}$/),
  repo: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/),
  parent: sha,
  fix: sha,
  fixDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  found: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(heldOutKinds),
  difficulty: z.string().optional(),
  severity: z.enum(["high", "medium"]),
  masvs: z.array(z.string()).min(1),
  maswe: z.array(z.string()).min(1),
  mastg: z.array(z.string()),
  verdict: z.enum(["FAIL", "NEEDS DYNAMIC", "MANUAL"]),
  anchors: z.array(locationSchema).min(1),
  fixSummary: z.string().min(1),
  decoys: z.array(decoySchema),
  defensible: z.array(decoySchema).optional(),
  afterCutoff: z.record(z.string(), z.boolean()),
});

const keySchema = z.object({
  name: z.literal("held-out"),
  keyVersion: z.number().int(),
  created: z.string(),
  frozen: z.string(),
  batch: z.number().int(),
  sources: z.array(z.object({ name: z.string(), version: z.string() })),
  models: z
    .array(z.object({ id: z.string(), trainingCutoff: z.string() }))
    .min(1),
  notes: z.array(z.string()),
  cases: z.array(caseSchema).min(1),
});

export type HeldOutCase = z.infer<typeof caseSchema>;
export type HeldOutKey = z.infer<typeof keySchema>;
export type HeldOutLocation = z.infer<typeof locationSchema>;

export function parseHeldOut(json: unknown): HeldOutKey {
  return keySchema.parse(json);
}

export function loadHeldOut(path: string): HeldOutKey {
  return parseHeldOut(JSON.parse(readFileSync(path, "utf8")));
}

/** sha256 of the file's bytes: the bar file pins this to prove the order. */
export function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** "owner/name" from a GitHub URL. */
export function repoSlug(url: string): string {
  return url.replace("https://github.com/", "");
}

/**
 * Problems that need no network: IDs unknown to Ward's index (or
 * placeholders), too many cases from one repo, duplicate IDs, and a model
 * without an `afterCutoff` entry.
 */
export function offlineProblems(
  key: HeldOutKey,
  kb: KnowledgeBase,
  maxPerRepo = 3,
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const perRepo = new Map<string, number>();
  for (const c of key.cases) {
    if (ids.has(c.id)) problems.push(`${c.id}: duplicate id`);
    ids.add(c.id);
    perRepo.set(c.repo, (perRepo.get(c.repo) ?? 0) + 1);
    for (const id of [...c.masvs, ...c.maswe, ...c.mastg]) {
      const found = kb.get(id);
      if (!found) problems.push(`${c.id}: ${id} is not in the index`);
      else if (found.record.status !== "active")
        problems.push(`${c.id}: ${id} is ${found.record.status}`);
    }
    for (const m of key.models) {
      if (!(m.id in c.afterCutoff))
        problems.push(`${c.id}: no afterCutoff for ${m.id}`);
    }
    if (c.parent === c.fix) problems.push(`${c.id}: parent equals fix`);
  }
  for (const [repo, n] of perRepo) {
    if (n > maxPerRepo)
      problems.push(`${repo}: ${String(n)} cases (max ${String(maxPerRepo)})`);
  }
  return problems;
}

/**
 * Checks one location against the file's text in the parent commit: the
 * lines exist, and the anchor (if any) occurs once and inside the lines.
 */
export function locationProblem(
  text: string,
  loc: { lines: [number, number]; anchor?: string | undefined },
): string | null {
  const lineCount = text.split("\n").length;
  if (loc.lines[1] > lineCount)
    return `lines ${loc.lines.join("-")} past end of file (${String(lineCount)} lines)`;
  if (loc.anchor === undefined) return null;
  const first = text.indexOf(loc.anchor);
  if (first === -1) return `anchor not found: ${JSON.stringify(loc.anchor)}`;
  if (text.indexOf(loc.anchor, first + 1) !== -1)
    return `anchor occurs more than once: ${JSON.stringify(loc.anchor)}`;
  const line = text.slice(0, first).split("\n").length;
  if (line < loc.lines[0] || line > loc.lines[1])
    return `anchor is on line ${String(line)}, outside ${loc.lines.join("-")}`;
  return null;
}

/**
 * Every frozen held-out case, batch 1 then batch 2, each with the key it
 * comes from. Batches stay separate files so each keeps its pinned hash.
 */
export function heldOutCases(
  paths: readonly string[] = HELD_OUT_KEYS,
): (HeldOutCase & { batch: number; keyPath: string })[] {
  return paths.flatMap((p) => {
    const key = loadHeldOut(p);
    return key.cases.map((c) => ({ ...c, batch: key.batch, keyPath: p }));
  });
}
