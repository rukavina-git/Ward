/**
 * The citation checker: plain code that confirms what a filled report
 * cites before anything is shown as evidence. IDs must be in the pinned
 * index, where the index puts them; files must be inside the checked app;
 * lines must exist; quotes must match the file byte for byte.
 */
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { idPattern, type KnowledgeBase } from "@ward/core";
import { finalize } from "./rollup.js";
import { reportSchema, type Report } from "./schema.js";

/** Larger files aren't read; a citation into one fails. */
export const MAX_CITED_FILE_BYTES = 1_000_000;

export const ISSUE_KINDS = [
  "schema",
  "unknown-id",
  "misplaced-id",
  "title-mismatch",
  "stale-pin",
  "path-outside",
  "no-such-file",
  "not-a-file",
  "file-too-large",
  "line-past-end",
  "blank-quote",
  "quote-mismatch",
  "rollup-mismatch",
  "fail-without-evidence",
] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

/**
 * One thing that failed. `evidence` is the index in the check's evidence
 * list; set only for issues that make that evidence unusable.
 * `message` may quote file paths from the report: data, not instructions.
 */
export interface CitationIssue {
  kind: IssueKind;
  control?: string;
  check?: string;
  evidence?: number;
  message: string;
}

export interface CitationResult {
  ok: boolean;
  /** What was checked, so a clean result can be told from an empty one. */
  checked: { ids: number; files: number; evidence: number; quotes: number };
  issues: CitationIssue[];
}

type FileState =
  | { ok: true; lines: string[] }
  | {
      ok: false;
      kind: "path-outside" | "no-such-file" | "not-a-file" | "file-too-large";
    };

/** Where each control's tests and weaknesses sit in the pinned index. */
interface Placement {
  weaknesses: Map<string, string>;
  /** Test ID → title and the control's weaknesses that link to it. */
  tests: Map<string, { title: string; maswe: Set<string> }>;
}

/**
 * Checks a filled report against the index and the app under `root`.
 * `input` is untrusted JSON: a bad shape is one `schema` issue and nothing
 * else is checked. Throws only when `root` itself can't be resolved.
 */
export async function checkReport(
  input: unknown,
  root: string,
  kb: KnowledgeBase,
): Promise<CitationResult> {
  const checked = { ids: 0, files: 0, evidence: 0, quotes: 0 };
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      checked,
      issues: [
        {
          kind: "schema",
          message:
            `Not a ward-report/1 report: ${first ? `${first.path.join(".")}: ${first.message}` : "invalid"}`.slice(
              0,
              500,
            ),
        },
      ],
    };
  }
  const report = parsed.data;
  const issues: CitationIssue[] = [];
  const files = new FileReader(await realpath(root));

  // Stamps: the IDs must come from the index this report says it used.
  const pin = kb.index.sources.find((s) => s.name === "OWASP MASTG");
  const stamped = report.stamps.mastg;
  if (
    pin &&
    (stamped === null ||
      stamped.version !== pin.version ||
      stamped.commit !== pin.commit)
  ) {
    issues.push({
      kind: "stale-pin",
      message: `stamps.mastg is not the pinned index (${pin.version} ${pin.commit}).`,
    });
  }

  const placement = placements(kb);
  const textIds = (
    text: string | null,
    where: Omit<CitationIssue, "kind" | "message">,
  ): void => {
    if (text === null) return;
    for (const m of text.matchAll(new RegExp(idPattern.source, "gi"))) {
      checked.ids++;
      if (!kb.get(m[0])) {
        issues.push({
          kind: "unknown-id",
          ...where,
          message: `${m[0]} in the text is not in the pinned index.`,
        });
      }
    }
  };

  for (const run of report.analyzers) {
    for (const f of run.filesInspected) {
      checked.files++;
      const s = await files.get(f);
      if (!s.ok) {
        issues.push({
          kind: s.kind,
          message: `Analyzer ${run.name} lists ${clip(f)}: ${s.kind}.`,
        });
      }
    }
  }

  for (const control of report.controls) {
    checked.ids++;
    const place = placement.get(control.id.toUpperCase());
    const record = kb.get(control.id)?.record;
    if (!record || record.kind !== "control" || !place) {
      issues.push({
        kind: "unknown-id",
        control: control.id,
        message: `${control.id} is not a MASVS control in the pinned index.`,
      });
    } else if (control.title !== record.title) {
      issues.push({
        kind: "title-mismatch",
        control: control.id,
        message: `${control.id}: title differs from the index.`,
      });
    }

    for (const check of control.checks) {
      const where = { control: control.id, check: check.id };
      checked.ids++;
      const found = kb.get(check.id)?.record;
      const kindOk =
        found !== undefined &&
        (check.kind === "test"
          ? found.kind === "test"
          : found.kind === "weakness");
      if (!kindOk) {
        issues.push({
          kind: "unknown-id",
          ...where,
          message: `${check.id} is not a MASTG ${check.kind} in the pinned index.`,
        });
      } else if (place) {
        const title =
          check.kind === "test"
            ? place.tests.get(found.id)?.title
            : place.weaknesses.get(found.id);
        if (title === undefined) {
          issues.push({
            kind: "misplaced-id",
            ...where,
            message: `${check.id} is not under ${control.id} in the pinned index.`,
          });
        } else if (check.title !== title) {
          issues.push({
            kind: "title-mismatch",
            ...where,
            message: `${check.id}: title differs from the index.`,
          });
        }
      }

      for (const w of check.maswe) {
        checked.ids++;
        const rec = kb.get(w)?.record;
        if (rec?.kind !== "weakness") {
          issues.push({
            kind: "unknown-id",
            ...where,
            message: `${w} is not a MASWE weakness in the pinned index.`,
          });
          continue;
        }
        if (!place) continue;
        const allowed =
          check.kind === "test"
            ? place.tests.get(check.id.toUpperCase())?.maswe.has(rec.id)
            : place.weaknesses.has(rec.id);
        if (!allowed) {
          issues.push({
            kind: "misplaced-id",
            ...where,
            message: `${w} doesn't link ${check.id} to ${control.id} in the pinned index.`,
          });
        }
      }

      textIds(check.reason, where);

      for (const f of check.filesInspected) {
        checked.files++;
        const s = await files.get(f);
        if (!s.ok) {
          issues.push({
            kind: s.kind,
            ...where,
            message: `filesInspected ${clip(f)}: ${s.kind}.`,
          });
        }
      }

      let goodEvidence = 0;
      for (const [i, e] of check.evidence.entries()) {
        checked.evidence++;
        const at = { ...where, evidence: i };
        textIds(e.detail, at);
        const s = await files.get(e.file);
        if (!s.ok) {
          issues.push({
            kind: s.kind,
            ...at,
            message: `${clip(e.file)}: ${s.kind}.`,
          });
          continue;
        }
        if (e.line > s.lines.length) {
          issues.push({
            kind: "line-past-end",
            ...at,
            message: `${clip(e.file)}:${String(e.line)} is past the end (${String(s.lines.length)} lines).`,
          });
          continue;
        }
        if (e.quote !== undefined) {
          checked.quotes++;
          const q = quoteMatches(s.lines, e.line, e.quote);
          if (q !== null) {
            issues.push({
              kind: q,
              ...at,
              message:
                q === "blank-quote"
                  ? `${clip(e.file)}:${String(e.line)}: the quote is blank.`
                  : `${clip(e.file)}:${String(e.line)}: the quote is not at that line.`,
            });
            continue;
          }
        }
        goodEvidence++;
      }
      if (check.verdict === "FAIL" && goodEvidence === 0) {
        issues.push({
          kind: "fail-without-evidence",
          ...where,
          message: `${check.id} is FAIL with no evidence that passed the check.`,
        });
      }
    }
  }

  issues.push(...rollupIssues(report));
  return { ok: issues.length === 0, checked, issues };
}

/**
 * The report without the evidence that failed the checker, with control
 * verdicts, counts and gaps recomputed. Verdicts are kept: a FAIL that
 * lost its evidence is still listed as `fail-without-evidence`.
 */
export function dropBadEvidence(
  report: Report,
  issues: CitationIssue[],
): Report {
  const bad = new Set(
    issues
      .filter((i) => i.evidence !== undefined)
      .map((i) => key(i.control, i.check, i.evidence)),
  );
  // An ID the index doesn't put there makes every piece of evidence
  // under it unusable: the check (or control) itself isn't real.
  const idIssue = (i: CitationIssue): boolean =>
    i.evidence === undefined &&
    (i.kind === "unknown-id" ||
      i.kind === "misplaced-id" ||
      i.kind === "title-mismatch");
  const badChecks = new Set(
    issues
      .filter((i) => idIssue(i) && i.check !== undefined)
      .map((i) => key(i.control, i.check)),
  );
  const badControls = new Set(
    issues
      .filter((i) => idIssue(i) && i.check === undefined)
      .map((i) => i.control),
  );
  return finalize({
    ...report,
    controls: report.controls.map((c) => ({
      ...c,
      checks: c.checks.map((t) => ({
        ...t,
        evidence:
          badControls.has(c.id) || badChecks.has(key(c.id, t.id))
            ? []
            : t.evidence.filter((_, i) => !bad.has(key(c.id, t.id, i))),
      })),
    })),
  });
}

const key = (c?: string, t?: string, i?: number): string =>
  `${c ?? ""}\u0000${t ?? ""}\u0000${String(i)}`;

/**
 * null when `quote` is found byte for byte in the text starting at `line`
 * (1-based). A quote with newlines spans the next lines. CR before LF is
 * ignored on both sides, so CRLF files match quotes written with LF.
 */
export function quoteMatches(
  lines: readonly string[],
  line: number,
  quote: string,
): "blank-quote" | "quote-mismatch" | null {
  if (quote.trim() === "") return "blank-quote";
  const want = splitLines(quote).join("\n");
  const n = want.split("\n").length;
  const span = lines.slice(line - 1, line - 1 + n).join("\n");
  return span.includes(want) ? null : "quote-mismatch";
}

/** Lines without their CR; a final newline doesn't add an empty line. */
export function splitLines(text: string): string[] {
  const lines = text
    .split("\n")
    .map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  if (lines.length > 1 && lines.at(-1) === "") lines.pop();
  return lines;
}

/** Reads cited files once each, refusing anything outside the root. */
class FileReader {
  private readonly cache = new Map<string, Promise<FileState>>();
  constructor(private readonly root: string) {}

  get(rel: string): Promise<FileState> {
    let s = this.cache.get(rel);
    if (!s) {
      s = this.load(rel);
      this.cache.set(rel, s);
    }
    return s;
  }

  private async load(rel: string): Promise<FileState> {
    if (rel.includes("\0") || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) {
      return { ok: false, kind: "path-outside" };
    }
    const abs = path.resolve(this.root, rel);
    if (!inside(this.root, abs)) return { ok: false, kind: "path-outside" };
    let real: string;
    try {
      real = await realpath(abs);
    } catch {
      return { ok: false, kind: "no-such-file" };
    }
    // A symlink inside the app may point out of it.
    if (!inside(this.root, real)) return { ok: false, kind: "path-outside" };
    const info = await lstat(real);
    if (!info.isFile()) return { ok: false, kind: "not-a-file" };
    if (info.size > MAX_CITED_FILE_BYTES) {
      return { ok: false, kind: "file-too-large" };
    }
    return { ok: true, lines: splitLines(await readFile(real, "utf8")) };
  }
}

function inside(root: string, p: string): boolean {
  const rel = path.relative(root, p);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** Every control in the index with its tests and weaknesses. */
function placements(kb: KnowledgeBase): Map<string, Placement> {
  const out = new Map<string, Placement>();
  for (const c of kb.checklist()) {
    const p: Placement = { weaknesses: new Map(), tests: new Map() };
    for (const w of c.weaknesses) {
      p.weaknesses.set(w.id, w.title);
      for (const t of w.tests) {
        const seen = p.tests.get(t.id) ?? { title: t.title, maswe: new Set() };
        seen.maswe.add(w.id);
        p.tests.set(t.id, seen);
      }
    }
    out.set(c.id, p);
  }
  return out;
}

/** The derived fields must be what the checks give (ADR 0012). */
function rollupIssues(report: Report): CitationIssue[] {
  const want = finalize(report);
  const out: CitationIssue[] = [];
  want.controls.forEach((c, i) => {
    const had = report.controls[i]?.verdict;
    if (had !== c.verdict) {
      out.push({
        kind: "rollup-mismatch",
        control: c.id,
        message: `${c.id} is ${String(had)}; its checks give ${String(c.verdict)}.`,
      });
    }
  });
  const same = (a: object, b: object): boolean =>
    JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  if (!same(report.counts, want.counts)) {
    out.push({
      kind: "rollup-mismatch",
      message: "counts differ from the checks.",
    });
  }
  if (!same(report.gaps, want.gaps)) {
    out.push({
      kind: "rollup-mismatch",
      message: "gaps differ from the checks.",
    });
  }
  return out;
}

function sortKeys(x: unknown): unknown {
  if (Array.isArray(x)) {
    return x
      .map(sortKeys)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (x && typeof x === "object") {
    return Object.fromEntries(
      Object.entries(x)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return x;
}

const clip = (s: string): string =>
  s.length > 200 ? `${s.slice(0, 200)}…` : s;
