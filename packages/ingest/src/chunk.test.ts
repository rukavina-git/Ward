import type { KnowledgeRecord, RecordKind, RecordStatus } from "@ward/core";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildIndex,
  CHUNK_MAX_CHARS,
  chunkRecord,
  splitSections,
} from "./chunk.js";
import { buildRecords, serialize } from "./ingest.js";
import { overrides } from "./overrides.js";
import { emptyLinks } from "./parse.js";
import { fixturesRoot } from "./paths.js";
import { pinnedSources } from "./sources.js";

const base = "https://github.com/OWASP/mastg/blob/v2.0.0/";

function record(
  body: string,
  extra: Partial<KnowledgeRecord> = {},
  kind: RecordKind = "test",
  status: RecordStatus = "active",
): KnowledgeRecord {
  const path = "tests-beta/android/MASVS-STORAGE/MASTG-TEST-0200.md";
  return {
    id: "MASTG-TEST-0200",
    kind,
    title: "A title",
    status,
    body,
    fields: {},
    links: emptyLinks(),
    files: [],
    source: {
      name: "OWASP MASTG",
      version: "v2.0.0",
      commit: "c",
      path,
      url: base + path,
      licence: "CC-BY-SA-4.0",
    },
    ...extra,
  };
}

const para = (n: number, ch = "a"): string => ch.repeat(n);

describe("splitSections", () => {
  it("splits at ## headings, keeps text before the first one", () => {
    const s = splitSections(
      "intro\n\n## Overview\n\ntext\n\n## Steps\n\n1. do",
    );
    expect(s.map((x) => x.heading)).toEqual([null, "Overview", "Steps"]);
    expect(s[0]?.lines.join("\n")).toBe("intro\n");
  });

  it("keeps ### headings inside their ## section", () => {
    const s = splitSections("## Sample\n\n### Test 1\n\nx");
    expect(s.map((x) => x.heading)).toEqual([null, "Sample"]);
    expect(s[1]?.lines).toContain("### Test 1");
  });

  it("ignores headings inside fenced code", () => {
    const s = splitSections("## A\n\n```sh\n## not a heading\n```\n\n## B");
    expect(s.map((x) => x.heading)).toEqual([null, "A", "B"]);
  });

  it("makes GitHub's anchors, numbering repeats across all levels", () => {
    const s = splitSections(
      "## Static Analysis\n### Overview\n## Overview\n## Use of `MODE_PRIVATE` (API 24+)",
    );
    expect(s.map((x) => x.anchor)).toEqual([
      null,
      "static-analysis",
      "overview-1",
      "use-of-mode_private-api-24",
    ]);
    expect(s[3]?.heading).toBe("Use of MODE_PRIVATE (API 24+)");
  });
});

describe("chunkRecord", () => {
  it("makes one chunk per section, with stable ids and anchored URLs", () => {
    const chunks = chunkRecord(
      record("## Overview\n\nabc\n\n## Steps\n\ndef\n"),
    );
    expect(chunks.map((c) => c.id)).toEqual([
      "MASTG-TEST-0200#0",
      "MASTG-TEST-0200#1",
    ]);
    expect(chunks[1]).toEqual({
      id: "MASTG-TEST-0200#1",
      record: "MASTG-TEST-0200",
      kind: "test",
      status: "active",
      section: ["Steps"],
      text: "def",
      url: `${base}tests-beta/android/MASVS-STORAGE/MASTG-TEST-0200.md#steps`,
      version: "v2.0.0",
      licence: "CC-BY-SA-4.0",
    });
  });

  it("splits a long section at blank lines, under the limit", () => {
    const body = `## Overview\n\n${[para(700), para(700, "b"), para(700, "c")].join("\n\n")}`;
    const chunks = chunkRecord(record(body));
    expect(chunks.map((c) => c.text.length)).toEqual([1402, 700]);
    expect(chunks.every((c) => c.section[0] === "Overview")).toBe(true);
  });

  it("keeps a code block whole, blank lines included", () => {
    const code = `\`\`\`kotlin\n${para(600)}\n\n${para(600, "b")}\n\`\`\``;
    const chunks = chunkRecord(
      record(`## Steps\n\n${para(700, "x")}\n\n${code}`),
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[1]?.text).toBe(code);
  });

  it("splits a code block that alone is too long at line breaks", () => {
    const lines = Array.from({ length: 40 }, () => para(99));
    const chunks = chunkRecord(
      record(`## S\n\n\`\`\`\n${lines.join("\n")}\n\`\`\``),
    );
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.text.length <= CHUNK_MAX_CHARS)).toBe(true);
  });

  it("leaves one oversized line whole", () => {
    const chunks = chunkRecord(record(`## S\n\n${para(2000)}`));
    expect(chunks.map((c) => c.text.length)).toEqual([2000]);
  });

  it("gives each demo file its own chunks, linked to the file", () => {
    const dir = "demos/android/MASVS-AUTH/MASTG-DEMO-0090/";
    const r = record(
      "## Sample\n\nx",
      {
        id: "MASTG-DEMO-0090",
        files: [{ path: `${dir}MastgTest.kt`, text: "fun a() {}\n" }],
        source: {
          ...record("").source,
          path: `${dir}MASTG-DEMO-0090.md`,
          url: `${base}${dir}MASTG-DEMO-0090.md`,
        },
      },
      "demo",
    );
    const chunks = chunkRecord(r);
    expect(chunks[1]).toMatchObject({
      section: ["MastgTest.kt"],
      text: "fun a() {}",
      url: `${base}${dir}MastgTest.kt`,
    });
  });

  it("sums up a deprecated test by its replacements, not its old text", () => {
    const r = record(
      "## Overview\n\nold v1 text",
      {
        links: {
          ...emptyLinks(),
          coveredBy: ["MASTG-TEST-0201", "MASTG-TEST-0202"],
        },
      },
      "test",
      "deprecated",
    );
    expect(chunkRecord(r).map((c) => c.text)).toEqual([
      "A title\n\nDeprecated MASTG v1 test. Covered by: MASTG-TEST-0201, MASTG-TEST-0202.",
    ]);
  });

  it("gives a placeholder one chunk with its note", () => {
    const r = record(
      "",
      { fields: { note: "Coming soon." } },
      "demo",
      "placeholder",
    );
    const chunks = chunkRecord(r);
    expect(chunks.map((c) => [c.text, c.status])).toEqual([
      ["A title\n\nComing soon.", "placeholder"],
    ]);
  });
});

describe("buildIndex", () => {
  const dirs = {
    masvs: join(fixturesRoot, "masvs"),
    maswe: join(fixturesRoot, "maswe"),
    mastg: join(fixturesRoot, "mastg"),
  };

  it("gives the same bytes for the same input, in any record order", () => {
    const { file } = buildRecords(dirs, pinnedSources, overrides);
    const a = serialize(buildIndex(file));
    const reversed = { ...file, records: [...file.records].reverse() };
    expect(serialize(buildIndex(reversed))).toBe(a);
    expect(
      serialize(buildIndex(buildRecords(dirs, pinnedSources, overrides).file)),
    ).toBe(a);
  });

  it("drops bodies and files from records and lists every chunk once", () => {
    const { file } = buildRecords(dirs, pinnedSources, overrides);
    const index = buildIndex(file);
    expect(index.embedding).toBeNull();
    expect(Object.keys(index.records[0] ?? {})).not.toContain("body");
    const listed = index.records.flatMap((r) => r.chunks);
    expect(listed).toEqual(index.chunks.map((c) => c.id));
    expect(index.records.every((r) => r.chunks.length > 0)).toBe(true);
  });
});
