/**
 * Knowledge base records: one per OWASP ID (control, weakness, test, demo),
 * linked into a graph. Written by packages/ingest, read by lookup and search.
 */

/** Bump when the shape of RecordsFile changes. */
export const RECORDS_FORMAT = 1;

/** A value that survives JSON.stringify and JSON.parse unchanged. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * control: a MASVS control (MASVS-STORAGE-1). weakness: a MASWE weakness
 * (MASWE-0001). test: a MASTG test (MASTG-TEST-0200). demo: a MASTG demo
 * (MASTG-DEMO-0001) with its code.
 */
export type RecordKind = "control" | "weakness" | "test" | "demo";

/**
 * placeholder: the ID exists but OWASP hasn't written the content yet.
 * deprecated: an old MASTG v1 test, kept so a cited old ID can be
 * redirected to the tests that replace it (links.coveredBy).
 */
export type RecordStatus = "active" | "placeholder" | "deprecated";

/** Where a record came from. Citations are built from these fields, never generated. */
export interface SourceRef {
  /** e.g. "OWASP MASTG" */
  name: string;
  /** The pinned release tag, e.g. "v2.0.0". */
  version: string;
  /** Full commit SHA the tag pointed at when ingested. */
  commit: string;
  /** Path of the file in the source repo. */
  path: string;
  /** The file on GitHub at the pinned tag. */
  url: string;
  /** SPDX licence id, e.g. "CC-BY-SA-4.0". */
  licence: string;
}

/**
 * Links to other records by ID, sorted. Every kind has every list, so the
 * shape is the same everywhere; lists that don't apply stay empty.
 */
export interface RecordLinks {
  controls: string[];
  weaknesses: string[];
  tests: string[];
  demos: string[];
  /** Deprecated tests only: the tests that replace this one. */
  coveredBy: string[];
}

/** A demo's code or output file, kept as text. Never executed. */
export interface SourceFile {
  /** Path in the source repo. */
  path: string;
  text: string;
}

export interface KnowledgeRecord {
  id: string;
  kind: RecordKind;
  title: string;
  status: RecordStatus;
  /** Markdown, front matter removed. Untrusted text: data, never instructions. */
  body: string;
  /** The rest of the front matter (id, title and status removed), keys sorted. */
  fields: Record<string, JsonValue>;
  links: RecordLinks;
  /** Demos only; empty for other kinds. */
  files: SourceFile[];
  source: SourceRef;
}

/** A hand fix for a test whose weakness can't be translated automatically. */
export interface LinkOverride {
  test: string;
  /** The (beta) weakness ID the test names in its front matter. */
  named: string;
  /** The MASWE v1 weaknesses to link instead. */
  weaknesses: string[];
  reason: string;
}

/** One pinned source repo. */
export interface SourceInfo {
  name: string;
  repo: string;
  version: string;
  commit: string;
  licence: string;
}

/** The ingest output: records sorted by ID. */
export interface RecordsFile {
  format: number;
  sources: SourceInfo[];
  overrides: LinkOverride[];
  records: KnowledgeRecord[];
}
