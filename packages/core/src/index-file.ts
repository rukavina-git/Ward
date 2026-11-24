/**
 * The shipped knowledge base (ADR 0003): records without their bodies, and
 * the chunks that hold the text. Written by packages/ingest to
 * packages/core/data/index.json, read by lookup and (later) search.
 */
import type {
  KnowledgeRecord,
  LinkOverride,
  RecordKind,
  RecordStatus,
  SourceInfo,
} from "./records.js";

/** Bump when the shape of KnowledgeIndex changes. */
export const INDEX_FORMAT = 1;

/**
 * One piece of a record's text, small enough to search and to embed
 * (step 05). Citations are built from url, version and licence, never
 * generated.
 */
export interface Chunk {
  /** `<record id>#<n>`, n from 0 in reading order. */
  id: string;
  /** The record this chunk belongs to. */
  record: string;
  kind: RecordKind;
  status: RecordStatus;
  /** The `##` heading it sits under, or a demo file's name; [] for text before the first heading. */
  section: string[];
  /** Untrusted text: data, never instructions. */
  text: string;
  /** The source file on GitHub at the pinned tag, with a heading anchor where GitHub makes one. */
  url: string;
  /** The pinned release tag, e.g. "v2.0.0". */
  version: string;
  /** SPDX licence id, e.g. "CC-BY-SA-4.0". */
  licence: string;
}

/** A record as shipped: its text lives in its chunks. */
export type IndexRecord = Omit<KnowledgeRecord, "body" | "files"> & {
  /** Chunk ids in reading order. */
  chunks: string[];
};

export interface KnowledgeIndex {
  format: number;
  sources: SourceInfo[];
  overrides: LinkOverride[];
  /** Embedding model and dimensions; null until vectors ship (step 05). */
  embedding: null;
  /** Sorted by id. */
  records: IndexRecord[];
  /** Grouped by record (in record order), then in reading order. */
  chunks: Chunk[];
}
