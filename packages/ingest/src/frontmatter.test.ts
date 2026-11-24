import { describe, expect, it } from "vitest";
import { splitFrontMatter } from "./frontmatter.js";

describe("splitFrontMatter", () => {
  it("splits YAML front matter from the body, keys sorted", () => {
    const text =
      "---\ntitle: T\nid: X-1\nprofiles: [L2]\n---\n\n## Body\n\ntext\n";
    const { data, body } = splitFrontMatter(text, "f.md");
    expect(data).toEqual({ id: "X-1", profiles: ["L2"], title: "T" });
    expect(Object.keys(data)).toEqual(["id", "profiles", "title"]);
    expect(body).toBe("## Body\n\ntext");
  });

  it("handles a file without front matter", () => {
    expect(splitFrontMatter("# MASVS-AUTH-1\n\ntext\n", "f.md")).toEqual({
      data: {},
      body: "# MASVS-AUTH-1\n\ntext",
    });
  });

  it("normalizes CRLF and a byte-order mark", () => {
    const text = "﻿---\r\nid: X-1\r\n---\r\nline one\r\nline two\r\n";
    const { data, body } = splitFrontMatter(text, "f.md");
    expect(data).toEqual({ id: "X-1" });
    expect(body).toBe("line one\nline two");
  });

  it("keeps a body that contains a horizontal rule", () => {
    const { body } = splitFrontMatter(
      "---\nid: X\n---\na\n\n---\n\nb\n",
      "f.md",
    );
    expect(body).toBe("a\n\n---\n\nb");
  });

  it("keeps dates and numbers as plain JSON", () => {
    const { data } = splitFrontMatter(
      "---\navailable_since: 24\nreleased: 2026-06-30\n---\n",
      "f.md",
    );
    expect(data).toEqual({ available_since: 24, released: "2026-06-30" });
  });

  it("names the file when front matter is broken", () => {
    expect(() => splitFrontMatter("---\nid: [\n---\n", "bad.md")).toThrow(
      /bad\.md: front matter isn't valid YAML/,
    );
    expect(() => splitFrontMatter("---\n- a\n---\n", "list.md")).toThrow(
      /list\.md: front matter isn't a mapping/,
    );
    expect(() => splitFrontMatter("---\nid: X\n", "open.md")).toThrow(
      /open\.md: front matter never closes/,
    );
    expect(() =>
      splitFrontMatter("---\nid: X\nid: Y\n---\n", "dup.md"),
    ).toThrow(/dup\.md/);
  });

  it("refuses a __proto__ key", () => {
    expect(() =>
      splitFrontMatter("---\n__proto__:\n  polluted: true\n---\n", "p.md"),
    ).toThrow(/__proto__/);
  });
});
