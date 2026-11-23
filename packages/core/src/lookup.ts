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

  /** One chunk by its ID (`<record id>#<n>`), exact. */
  chunk(id: string): Chunk | undefined {
    return this.chunks.get(id);
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
        records:
          kind === start.kind
            ? [start]
            : this.resolve(start.links[listFor[kind]]),
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
    const hits = this.named(query);
    const seen = new Set(hits.map((h) => h.chunk));
    for (const hit of this.searcher(options).search(query, options)) {
      if (hits.length >= limit) break;
      if (seen.has(hit.chunk)) continue;
      seen.add(hit.chunk);
      hits.push(hit);
    }
    return hits.slice(0, limit);
  }

  /**
   * Records named by ID in the query, in the order named: each one's first
   * chunk. Unknown IDs are dropped, never guessed.
   */
  named(query: string): SearchHit[] {
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
    return hits;
  }

  /** Query words found in this chunk; used to show why a hit matched. */
  matchedTerms(
    query: string,
    chunkId: string,
    options: SearchOptions = {},
  ): string[] {
    return this.searcher(options).matchedTerms(query, chunkId);
  }

  /** Query words found in no searchable chunk: the agent's hint that search can't help. */
  unmatchedTerms(query: string, options: SearchOptions = {}): string[] {
    return this.searcher(options).unmatchedTerms(query);
  }

  /**
   * What to check for an Android app: MASVS controls, their weaknesses
   * (Android ones) and each weakness's active and placeholder tests, all
   * sorted by ID. Filters: a MASVS group (MASVS-NETWORK) and a profile
   * (L1, L2, R, P). A weakness or test without profiles is kept by any
   * profile filter. Weaknesses with no test stay, with an empty list.
   */
  checklist(filter: ChecklistFilter = {}): ChecklistControl[] {
    const group = filter.group?.trim().toUpperCase();
    const inProfile = (r: IndexRecord): boolean => {
      if (!filter.profile) return true;
      const p = r.fields.profiles;
      return !Array.isArray(p) || p.includes(filter.profile);
    };
    const controls = this.index.records.filter(
      (r) =>
        r.kind === "control" &&
        (!group || r.id === group || r.id.startsWith(`${group}-`)),
    );
    return controls.map((control) => ({
      ...item(control),
      weaknesses: this.resolve(control.links.weaknesses)
        .filter((w) => isAndroid(w) && inProfile(w))
        .map((w) => ({
          ...item(w),
          tests: this.resolve(w.links.tests)
            .filter((t) => t.status !== "deprecated" && inProfile(t))
            .map((t) => ({ ...item(t), type: strings(t.fields.type) })),
        })),
    }));
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

export interface ChecklistFilter {
  /** A MASVS group such as "MASVS-NETWORK", or one control ID. */
  group?: string | undefined;
  /** A MAS profile: L1, L2, R (resilience) or P (privacy). */
  profile?: string | undefined;
}

/**
 * One checklist entry: enough to choose it and fetch the rest by ID. No
 * URL: the full list stays small, and get_check gives the citation.
 */
export interface ChecklistItem {
  id: string;
  title: string;
  status: IndexRecord["status"];
  profiles: string[];
}

export interface ChecklistTest extends ChecklistItem {
  /** MASTG test types, e.g. ["static", "code"] or ["dynamic"]. */
  type: string[];
}

export interface ChecklistWeakness extends ChecklistItem {
  tests: ChecklistTest[];
}

export interface ChecklistControl extends ChecklistItem {
  weaknesses: ChecklistWeakness[];
}

function item(r: IndexRecord): ChecklistItem {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    profiles: strings(r.fields.profiles),
  };
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/** A weakness is Android's if its platform list names android (or is missing). */
function isAndroid(r: IndexRecord): boolean {
  const p = strings(r.fields.platform);
  return p.length === 0 || p.includes("android");
}

/** OWASP IDs are upper case; accept any case and stray spaces. */
function normalize(id: string): string {
  return id.trim().toUpperCase();
}
