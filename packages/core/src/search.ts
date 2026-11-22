/**
 * Keyword search over chunks: what gets indexed, and the knobs the
 * retrieval eval tunes. KnowledgeBase.search puts named IDs first, then
 * these BM25 hits.
 */
import { Bm25Index, BM25_DEFAULTS, type Bm25Params } from "./bm25.js";
import type { Chunk, IndexRecord } from "./index-file.js";
import { tokenize, type TokenizeOptions } from "./tokenize.js";

export interface SearchOptions extends Partial<Bm25Params>, TokenizeOptions {
  /** How many times the record title and section path are indexed. Default 1. */
  titleWeight?: number;
  /** Score multiplier for demo code and output files. Default 1. */
  codeWeight?: number;
  /** Most chunks returned. Default 20. */
  limit?: number;
}

export interface SearchHit {
  chunk: string;
  record: string;
  /** "id": the query named this record; "text": a BM25 match. */
  match: "id" | "text";
  /** BM25 score after codeWeight; null for an ID match. */
  score: number | null;
}

/**
 * Settings picked on the retrieval eval's dev split (plan 3 step 04,
 * `npm run eval:tune-bm25`): dev MRR 0.568 → 0.785. The gain is stemming
 * and halving demo code scores; k1 adds a little. Test was scored once,
 * with these.
 */
export const TUNED_SEARCH: Required<Omit<SearchOptions, "limit">> = {
  k1: 0.9,
  b: 0.75,
  stopwords: false,
  stem: true,
  titleWeight: 1,
  codeWeight: 0.5,
};

/**
 * A demo chunk whose section is a file name (`MastgTest.kt`, `output.txt`)
 * holds code or tool output rather than prose.
 */
export function isCodeChunk(chunk: Chunk): boolean {
  return chunk.kind === "demo" && /\.\w+$/.test(chunk.section.at(-1) ?? "");
}

/** BM25 over every searchable chunk, for one set of indexing options. */
export class ChunkSearch {
  private readonly bm25: Bm25Index;
  private readonly code = new Set<string>();
  private readonly recordOf = new Map<string, string>();

  constructor(
    chunks: readonly Chunk[],
    titles: ReadonlyMap<string, IndexRecord>,
    private readonly tokens: TokenizeOptions & { titleWeight: number },
  ) {
    const docs = [];
    for (const chunk of chunks) {
      // Placeholders hold only a title and status: lookup finds them, search doesn't.
      if (chunk.status === "placeholder") continue;
      if (isCodeChunk(chunk)) this.code.add(chunk.id);
      this.recordOf.set(chunk.id, chunk.record);
      const head = `${titles.get(chunk.record)?.title ?? ""} ${chunk.section.join(" ")}`;
      const headTokens = tokenize(head, tokens);
      const all = [];
      for (let i = 0; i < tokens.titleWeight; i++) all.push(...headTokens);
      all.push(...tokenize(chunk.text, tokens));
      docs.push({ id: chunk.id, tokens: all });
    }
    this.bm25 = new Bm25Index(docs);
  }

  search(query: string, options: SearchOptions): SearchHit[] {
    const params: Bm25Params = {
      k1: options.k1 ?? BM25_DEFAULTS.k1,
      b: options.b ?? BM25_DEFAULTS.b,
    };
    const codeWeight = options.codeWeight ?? 1;
    const hits = this.bm25.search(tokenize(query, this.tokens), params);
    return hits
      .map((h) => ({
        chunk: h.id,
        record: this.recordOf.get(h.id) ?? "",
        match: "text" as const,
        score: this.code.has(h.id) ? h.score * codeWeight : h.score,
      }))
      .sort((x, y) => y.score - x.score || (x.chunk < y.chunk ? -1 : 1));
  }
}

/** Cache key for the options that change what is indexed. */
export function indexKey(options: SearchOptions): string {
  return [
    options.stopwords ? 1 : 0,
    options.stem ? 1 : 0,
    options.titleWeight ?? 1,
  ].join("|");
}
