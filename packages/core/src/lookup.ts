import type { Chunk, IndexRecord, KnowledgeIndex } from "./index-file.js";
import type { RecordKind, RecordLinks } from "./records.js";
import {
  ChunkSearch,
  indexKey,
  type SearchHit,
  type SearchOptions,
} from "./search.js";
import { idPattern } from "./tokenize.js";

/** The chain the graph is built on: control → weakness → test → demo. */
const chain: readonly RecordKind[] = ["control", "weakness", "test", "demo"];

/** Which links list leads to which kind. */
const listFor: Record<RecordKind, keyof RecordLinks> = {
  control: "controls",
  weakness: "weaknesses",
  test: "tests",
  demo: "demos",
};

export interface Related {
  /** Set when the ID was an old v1 test: the walk started from its replacements. */
  redirectedFrom: string | null;
  /** Sorted by id. */
  records: IndexRecord[];
}

/**
 * Exact lookup and graph walks over a loaded index. No ranking and no
 * guessing: an unknown ID gives undefined.
 */
export class KnowledgeBase {
  private readonly records = new Map<string, IndexRecord>();
  private readonly chunks = new Map<string, Chunk>();
  /** Built on first search, one per set of indexing options. */
  private readonly searchers = new Map<string, ChunkSearch>();

  constructor(readonly index: KnowledgeIndex) {
    for (const r of index.records) this.records.set(r.id, r);
    for (const c of index.chunks) this.chunks.set(c.id, c);
  }

  /** A record and its chunks in reading order. Case-insensitive. */
  get(id: string): { record: IndexRecord; chunks: Chunk[] } | undefined {
    const record = this.records.get(normalize(id));
    if (!record) return undefined;
    const chunks = record.chunks.map((c) => {
      const chunk = this.chunks.get(c);
      if (!chunk) throw new Error(`index: ${record.id} lists missing ${c}`);
      return chunk;
    });
    return { record, chunks };
  }

  /**
   * The records of `kind` linked to `id`, following the chain one step at a
   * time (a control's tests go through its weaknesses). An old v1 test
   * with replacements walks from those instead.
   */
  related(id: string, kind: RecordKind): Related | undefined {
    const start = this.records.get(normalize(id));
    if (!start) return undefined;

    let redirectedFrom: string | null = null;
    let current: IndexRecord[] = [start];
    if (start.status === "deprecated" && start.links.coveredBy.length > 0) {
      redirectedFrom = start.id;
      current = this.resolve(start.links.coveredBy);
    } else if (start.status === "deprecated") {
      // No replacements: only its direct (v1) links are known.
      return {
        redirectedFrom,
        records: this.resolve(start.links[listFor[kind]]),
      };
    }

    let at = chain.indexOf(start.kind);
    const to = chain.indexOf(kind);
    while (at !== to) {
      at += at < to ? 1 : -1;
      const list = listFor[chain[at] as RecordKind];
      current = this.resolve(current.flatMap((r) => r.links[list]));
    }
    return { redirectedFrom, records: current };
  }

  /**
   * Records named by ID in the query come first (their first chunk, in the
   * order named), then BM25 matches. Unknown IDs are dropped, never
   * guessed; a query with no known words returns nothing.
   */
  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const limit = options.limit ?? 20;
    const hits: SearchHit[] = [];
    const seen = new Set<string>();
    for (const match of query.matchAll(idPattern)) {
      const found = this.get(match[0]);
      const first = found?.chunks[0];
      if (!found || !first || seen.has(first.id)) continue;
      seen.add(first.id);
      hits.push({
        chunk: first.id,
        record: found.record.id,
        match: "id",
        score: null,
      });
    }
    for (const hit of this.searcher(options).search(query, options)) {
      if (hits.length >= limit) break;
      if (seen.has(hit.chunk)) continue;
      seen.add(hit.chunk);
      hits.push(hit);
    }
    return hits.slice(0, limit);
  }

  private searcher(options: SearchOptions): ChunkSearch {
    const key = indexKey(options);
    let s = this.searchers.get(key);
    if (!s) {
      s = new ChunkSearch(this.index.chunks, this.records, {
        stopwords: options.stopwords ?? false,
        stem: options.stem ?? false,
        titleWeight: options.titleWeight ?? 1,
      });
      this.searchers.set(key, s);
    }
    return s;
  }

  private resolve(ids: readonly string[]): IndexRecord[] {
    const unique = [...new Set(ids)].sort();
    return unique.map((id) => {
      const r = this.records.get(id);
      if (!r) throw new Error(`index: link to missing ${id}`);
      return r;
    });
  }
}

/** OWASP IDs are upper case; accept any case and stray spaces. */
function normalize(id: string): string {
  return id.trim().toUpperCase();
}
