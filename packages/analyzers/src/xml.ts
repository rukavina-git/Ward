/**
 * A small XML element tree with line numbers, built on saxes (ISC).
 *
 * saxes never fetches external entities and never expands entities
 * declared in a DOCTYPE: an unknown `&name;` is a parse error. That is
 * what blocks XXE (XML external entity) payloads in a checked app's files.
 */
import { SaxesParser, type SaxesAttributeNS } from "saxes";

export const ANDROID_NS = "http://schemas.android.com/apk/res/android";

export interface XmlAttribute {
  /** Name as written, e.g. `android:exported`. */
  qname: string;
  uri: string;
  local: string;
  value: string;
  line: number;
}

export interface XmlElement {
  name: string;
  line: number;
  attributes: XmlAttribute[];
  children: XmlElement[];
}

export class XmlError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = "XmlError";
  }
}

/** Parses a whole document; throws XmlError on malformed input. */
export function parseXml(text: string): XmlElement {
  const parser = new SaxesParser({ xmlns: true, position: true });
  const starts = lineStarts(text);
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;
  let startLine = 1;
  let attrLines = new Map<string, number>();
  let failure: XmlError | undefined;

  parser.on("error", (e) => {
    failure ??= new XmlError(e.message, parser.line);
  });
  parser.on("doctype", () => {
    failure ??= new XmlError(
      "DOCTYPE is not allowed in a manifest",
      parser.line,
    );
  });
  // saxes fires this after the character that ends the tag name, so a
  // newline there would put the element one line low: find its `<`.
  parser.on("opentagstart", (tag) => {
    const lt = text.lastIndexOf(`<${tag.name}`, parser.position);
    startLine = lt === -1 ? parser.line : lineAt(starts, lt);
    attrLines = new Map();
  });
  parser.on("attribute", (a) => {
    attrLines.set(a.name, parser.line);
  });
  parser.on("opentag", (tag) => {
    const attrs = Object.values(
      tag.attributes as Record<string, SaxesAttributeNS>,
    );
    const el: XmlElement = {
      name: tag.name,
      line: startLine,
      attributes: attrs.map((a) => ({
        qname: a.name,
        uri: a.uri,
        local: a.local,
        value: a.value,
        line: attrLines.get(a.name) ?? startLine,
      })),
      children: [],
    };
    const parent = stack.at(-1);
    if (parent) parent.children.push(el);
    else root ??= el;
    stack.push(el);
  });
  parser.on("closetag", () => {
    stack.pop();
  });

  try {
    parser.write(text).close();
  } catch (e) {
    failure ??= new XmlError(
      e instanceof Error ? e.message : String(e),
      parser.line,
    );
  }
  if (failure) throw failure;
  if (!root) throw new XmlError("No root element", 1);
  return root;
}

/** Offsets where each line starts, for `lineAt`. */
function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) {
    starts.push(i + 1);
  }
  return starts;
}

/** 1-based line of a UTF-16 offset (binary search). */
function lineAt(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** An `android:`-namespace attribute, by local name. */
export function androidAttr(
  el: XmlElement,
  local: string,
): XmlAttribute | undefined {
  return el.attributes.find((a) => a.uri === ANDROID_NS && a.local === local);
}

export function childrenNamed(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter((c) => c.name === name);
}
