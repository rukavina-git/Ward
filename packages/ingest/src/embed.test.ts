import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Embedder, normalise } from "./embed.js";
import { hasModel, MODEL, modelDir } from "./model.js";
import { cacheRoot, indexPath } from "./paths.js";
import {
  bytesToVectors,
  embedText,
  loadVectors,
  vectorsHeaderPath,
  vectorsToBytes,
} from "./vectors-file.js";

describe("normalise", () => {
  it("scales to length 1 and leaves a zero vector alone", () => {
    const v = normalise(new Float32Array([3, 4]));
    expect(Array.from(v)).toEqual([expect.closeTo(0.6), expect.closeTo(0.8)]);
    expect(Array.from(normalise(new Float32Array(2)))).toEqual([0, 0]);
  });
});

describe("vectors file", () => {
  it("round-trips float rows through little-endian bytes", () => {
    const rows = [new Float32Array([1.5, -2]), new Float32Array([0, 0.25])];
    const bytes = vectorsToBytes(rows);
    expect(bytes.length).toBe(16);
    expect(Array.from(bytesToVectors(bytes))).toEqual([1.5, -2, 0, 0.25]);
  });

  it("embeds title, section and text, as BM25 indexes them", () => {
    const chunk = { section: ["Steps", "Frida"], text: "hook it" };
    expect(embedText(chunk as never, { title: "Pinning" } as never)).toBe(
      "Pinning\nSteps > Frida\nhook it",
    );
    expect(embedText({ section: [], text: "x" } as never, undefined)).toBe("x");
  });

  // Built locally by `npm run embed`; not in CI.
  it.skipIf(!existsSync(vectorsHeaderPath))("match the committed index", () => {
    const { header, vectors } = loadVectors(readFileSync(indexPath));
    const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
      chunks: unknown[];
    };
    expect(header.chunks).toBe(index.chunks.length);
    expect(vectors.length).toBe(index.chunks.length * MODEL.dims);
  });
});

// Needs the 34 MB model (`npm run embed` downloads it); CI skips this.
describe.skipIf(!hasModel(cacheRoot))("Embedder", () => {
  const load = (): Promise<Embedder> => Embedder.load(modelDir(cacheRoot));

  it("gives 384 numbers of length 1, the same each time", async () => {
    const e = await load();
    const a = await e.embed("certificate pinning");
    const b = await e.embed("certificate pinning");
    expect(a).toHaveLength(384);
    expect(Math.hypot(...a)).toBeCloseTo(1, 5);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("puts related text closer than unrelated text", async () => {
    const e = await load();
    const dot = (x: Float32Array, y: Float32Array): number =>
      x.reduce((s, v, i) => s + v * (y[i] ?? 0), 0);
    const pin = await e.embed("certificate pinning");
    const tls = await e.embed("TLS pinning bypass");
    const sql = await e.embed("SQL injection");
    expect(dot(pin, tls)).toBeGreaterThan(dot(pin, sql));
  });

  it("cuts long text at 512 word pieces, ending with [SEP]", async () => {
    const e = await load();
    const short = e.tokenIds("hello");
    const long = e.tokenIds("word ".repeat(2000));
    expect(long).toHaveLength(MODEL.maxTokens);
    expect(long.at(-1)).toBe(short.at(-1));
    expect(long[0]).toBe(short[0]);
    expect(e.truncated).toBe(1);
  });
});
