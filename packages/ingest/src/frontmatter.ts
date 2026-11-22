import type { JsonValue } from "@ward/core";
import { parse } from "yaml";

export interface Split {
  data: Record<string, JsonValue>;
  /** Markdown after the front matter, trimmed. */
  body: string;
}

/** Line endings as LF, no byte-order mark: the same bytes on every machine. */
export function normalize(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

/**
 * Splits a markdown file into its YAML front matter (between "---" lines
 * at the top) and the body. A file without front matter gets empty data.
 * YAML is parsed as data only (core schema: no custom tags, no code).
 */
export function splitFrontMatter(raw: string, file: string): Split {
  const text = normalize(raw);
  if (!text.startsWith("---\n")) return { data: {}, body: text.trim() };
  const end = text.indexOf("\n---\n", 3);
  const close = end === -1 && text.endsWith("\n---") ? text.length - 4 : end;
  if (close === -1) throw new Error(`${file}: front matter never closes`);
  const yaml = text.slice(4, close + 1);
  const body = text.slice(close + 5);
  let data: unknown;
  try {
    data = parse(yaml, { schema: "core", uniqueKeys: true });
  } catch (err) {
    throw new Error(`${file}: front matter isn't valid YAML`, { cause: err });
  }
  if (data === null) return { data: {}, body: body.trim() };
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${file}: front matter isn't a mapping`);
  }
  return {
    data: toJson(data, file) as Record<string, JsonValue>,
    body: body.trim(),
  };
}

/** Copies a parsed YAML value as plain JSON with sorted keys, or throws. */
export function toJson(value: unknown, file: string): JsonValue {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    throw new Error(`${file}: front matter has a non-finite number`);
  }
  if (Array.isArray(value)) return value.map((v) => toJson(v, file));
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      if (key === "__proto__") throw new Error(`${file}: key __proto__`);
      out[key] = toJson((value as Record<string, unknown>)[key], file);
    }
    return out;
  }
  throw new Error(`${file}: front matter has a value JSON can't hold`);
}
