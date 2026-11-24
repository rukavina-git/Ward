import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Tokenizer } from "@huggingface/tokenizers";
import * as ort from "onnxruntime-node";
import { MODEL } from "./model.js";

/**
 * The part of @huggingface/tokenizers used here. Its own .d.ts files use
 * extensionless imports, which don't resolve under `nodenext`, so the
 * class is typed by hand.
 */
interface WordPieceTokenizer {
  encode(text: string): { ids: number[] };
}
const TokenizerClass = Tokenizer as unknown as new (
  tokenizer: object,
  config: object,
) => WordPieceTokenizer;

/**
 * Text → embedding, by hand: tokenize into word pieces, run the ONNX model,
 * take the CLS vector (pooling), scale it to length 1 (L2 normalisation).
 * Reads only the local model folder from ensureModel; never downloads.
 * One text per model run: no padding, and the same text always gives the
 * same numbers.
 */
export class Embedder {
  /** Texts so far that were longer than the model reads and got cut. */
  truncated = 0;

  private constructor(
    private readonly tokenizer: WordPieceTokenizer,
    private readonly session: ort.InferenceSession,
  ) {}

  static async load(dir: string): Promise<Embedder> {
    const json = (file: string): object =>
      JSON.parse(readFileSync(join(dir, file), "utf8")) as object;
    const tokenizer = new TokenizerClass(
      json("tokenizer.json"),
      json("tokenizer_config.json"),
    );
    const session = await ort.InferenceSession.create(
      join(dir, "onnx/model_quantized.onnx"),
      // One thread: the same float sums in the same order on every run.
      { intraOpNumThreads: 1, interOpNumThreads: 1 },
    );
    return new Embedder(tokenizer, session);
  }

  /** Word-piece IDs with [CLS] … [SEP], cut to the model's 512. */
  tokenIds(text: string): number[] {
    const ids = this.tokenizer.encode(text).ids;
    if (ids.length <= MODEL.maxTokens) return ids;
    this.truncated++;
    // Keep [CLS] and the first 510 pieces, end with the [SEP] the model expects.
    const sep = ids.at(-1) ?? 0;
    return [...ids.slice(0, MODEL.maxTokens - 1), sep];
  }

  async embed(text: string): Promise<Float32Array> {
    const ids = this.tokenIds(text);
    const n = ids.length;
    const shape = [1, n];
    const feeds = {
      input_ids: new ort.Tensor(
        "int64",
        BigInt64Array.from(ids, BigInt),
        shape,
      ),
      attention_mask: new ort.Tensor(
        "int64",
        new BigInt64Array(n).fill(1n),
        shape,
      ),
      token_type_ids: new ort.Tensor("int64", new BigInt64Array(n), shape),
    };
    const out = await this.session.run(feeds);
    const hidden = out.last_hidden_state;
    if (!hidden) throw new Error("model gave no last_hidden_state");
    // [1, n, 384]: the first row is the CLS token's vector.
    const cls = (hidden.data as Float32Array).slice(0, MODEL.dims);
    return normalise(cls);
  }
}

/** Scales a vector to length 1, so cosine similarity is a dot product. */
export function normalise(v: Float32Array): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}
