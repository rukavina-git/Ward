import { posix } from "node:path";
import {
  INDEX_FORMAT,
  type Chunk,
  type IndexRecord,
  type KnowledgeIndex,
  type KnowledgeRecord,
  type RecordsFile,
} from "@ward/core";

/**
 * Longest chunk text, in characters: about 375 tokens, under the 512-token
 * limit of the embedding model planned for step 05 (bge-small-en-v1.5).
 * A single line longer than this can't be split and stays whole.
 */
export const CHUNK_MAX_CHARS = 1500;

/** A piece of a record before it gets its id and citation fields. */
interface Piece {
  section: string[];
  text: string;
  url: string;
}

interface Section {
  heading: string | null;
  anchor: string | null;
  lines: string[];
}

const fence = /^\s{0,3}(`{3,}|~{3,})/;
/** A closing fence uses the same character, at least as many times. */
function closes(open: string, marks: string | undefined): boolean {
  return (
    marks !== undefined && marks[0] === open[0] && marks.length >= open.length
  );
}

const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/**
 * Splits markdown at its `##` headings. Text before the first one is its
 * own section (heading null). Lines inside fenced code never count as
 * headings. Every heading, at any level, takes part in GitHub's anchor
 * numbering, so duplicate headings get the same anchors GitHub gives them.
 */
export function splitSections(markdown: string): Section[] {
  const sections: Section[] = [{ heading: null, anchor: null, lines: [] }];
  const slugs = new Map<string, number>();
  let open: string | null = null;
  for (const line of markdown.split("\n")) {
    const f = fence.exec(line);
    if (open) {
      if (closes(open, f?.[1])) open = null;
    } else if (f?.[1]) {
      open = f[1];
    } else {
      const h = heading.exec(line);
      if (h?.[1] && h[2] !== undefined) {
        const anchor = uniqueSlug(h[2], slugs);
        if (h[1].length === 2) {
          sections.push({ heading: plainText(h[2]), anchor, lines: [] });
          continue;
        }
      }
    }
    (sections.at(-1) as Section).lines.push(line);
  }
  return sections;
}

/** Heading text as shown: links reduced to their text, code marks removed. */
function plainText(md: string): string {
  return md.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`/g, "");
}

/**
 * GitHub's heading anchor: lower case, punctuation dropped, spaces to
 * hyphens; a repeat gets -1, -2… (the github-slugger rules).
 */
function uniqueSlug(md: string, seen: Map<string, number>): string {
  const base = plainText(md)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
  const n = seen.get(base);
  seen.set(base, (n ?? 0) + 1);
  return n === undefined ? base : `${base}-${String(n)}`;
}

/** Paragraphs and whole code blocks: split at blank lines outside fences. */
function blocks(lines: readonly string[]): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let open: string | null = null;
  for (const line of lines) {
    const f = fence.exec(line);
    if (open) {
      if (closes(open, f?.[1])) open = null;
    } else if (f?.[1]) {
      open = f[1];
    } else if (line.trim() === "") {
      if (current.length > 0) out.push(current.join("\n"));
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) out.push(current.join("\n"));
  return out;
}

/** Greedily joins parts with `sep` into texts of at most CHUNK_MAX_CHARS. */
function pack(parts: readonly string[], sep: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current === "") current = part;
    else if (current.length + sep.length + part.length <= CHUNK_MAX_CHARS) {
      current += sep + part;
    } else {
      out.push(current);
      current = part;
    }
  }
  if (current !== "") out.push(current);
  return out;
}

/** Long text split at blank lines; a block that alone is too long, at line breaks. */
function splitText(lines: readonly string[]): string[] {
  const parts = blocks(lines).flatMap((b) =>
    b.length <= CHUNK_MAX_CHARS ? [b] : pack(b.split("\n"), "\n"),
  );
  return pack(parts, "\n\n");
}

function bodyPieces(r: KnowledgeRecord): Piece[] {
  return splitSections(r.body).flatMap((s) =>
    splitText(s.lines).map((text) => ({
      section: s.heading === null ? [] : [s.heading],
      text,
      url: s.anchor === null ? r.source.url : `${r.source.url}#${s.anchor}`,
    })),
  );
}

/** A demo's code and output files: one or more chunks each, named by file. */
function filePieces(r: KnowledgeRecord): Piece[] {
  // The record URL ends with its own path; swap that for the file's.
  const base = r.source.url.slice(0, -r.source.path.length);
  return r.files.flatMap((f) =>
    pack(f.text.replace(/\n+$/, "").split("\n"), "\n").map((text) => ({
      section: [posix.basename(f.path)],
      text,
      url: base + f.path,
    })),
  );
}

/**
 * Short stand-in text for records without usable content: placeholders
 * (OWASP hasn't written them yet) and old v1 tests (replaced in v2; their
 * old text isn't shipped).
 */
function summaryPiece(r: KnowledgeRecord): Piece {
  const lines = [r.title];
  if (r.status === "deprecated") {
    lines.push(
      r.links.coveredBy.length > 0
        ? `Deprecated MASTG v1 test. Covered by: ${r.links.coveredBy.join(", ")}.`
        : "Deprecated MASTG v1 test.",
    );
  } else if (r.status === "placeholder") {
    const note = r.fields["note"];
    if (typeof note === "string") lines.push(note);
  }
  return { section: [], text: lines.join("\n\n"), url: r.source.url };
}

/** A record's chunks, in reading order: body sections, then demo files. */
export function chunkRecord(r: KnowledgeRecord): Chunk[] {
  let pieces =
    r.status === "active" ? [...bodyPieces(r), ...filePieces(r)] : [];
  if (pieces.length === 0) pieces = [summaryPiece(r)];
  return pieces.map((p, n) => ({
    id: `${r.id}#${String(n)}`,
    record: r.id,
    kind: r.kind,
    status: r.status,
    section: p.section,
    text: p.text,
    url: p.url,
    version: r.source.version,
    licence: r.source.licence,
  }));
}

/** The shipped index: records sorted by id, without body and files; their text in chunks. */
export function buildIndex(file: RecordsFile): KnowledgeIndex {
  const sorted = [...file.records].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const records: IndexRecord[] = [];
  const chunks: Chunk[] = [];
  for (const r of sorted) {
    const own = chunkRecord(r);
    records.push({
      id: r.id,
      kind: r.kind,
      title: r.title,
      status: r.status,
      fields: r.fields,
      links: r.links,
      source: r.source,
      chunks: own.map((c) => c.id),
    });
    chunks.push(...own);
  }
  return {
    format: INDEX_FORMAT,
    sources: file.sources,
    overrides: file.overrides,
    embedding: null,
    records,
    chunks,
  };
}
