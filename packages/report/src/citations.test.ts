import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { KnowledgeBase, loadIndex } from "@ward/core";
import { afterAll, describe, expect, it } from "vitest";
import {
  checkReport,
  dropBadEvidence,
  quoteMatches,
  splitLines,
  type IssueKind,
} from "./citations.js";
import { finalize } from "./rollup.js";
import type { Check, Report } from "./schema.js";
import { buildSkeleton } from "./skeleton.js";

const kb = new KnowledgeBase(loadIndex());
const pin = kb.index.sources.find((s) => s.name === "OWASP MASTG");
const mastg = pin ? { version: pin.version, commit: pin.commit } : null;

const root = mkdtempSync(path.join(tmpdir(), "ward-cite-"));
const outside = mkdtempSync(path.join(tmpdir(), "ward-cite-out-"));
afterAll(() => {
  for (const d of [root, outside]) rmSync(d, { recursive: true, force: true });
});
mkdirSync(path.join(root, "app/src"), { recursive: true });
writeFileSync(
  path.join(root, "app/src/Api.kt"),
  'val url = "http://example.com"\n  client.get(url)\n',
);
writeFileSync(path.join(root, "app/src/Win.kt"), "line one\r\nline two\r\n");
writeFileSync(path.join(outside, "secret.txt"), "secret\n");
symlinkSync(path.join(outside, "secret.txt"), path.join(root, "link.txt"));
mkdirSync(path.join(root, "dir"));

/** A finalized network-1 report with no analyzers; its open checks filled. */
function base(): Report {
  const r = buildSkeleton({
    controls: kb.checklist({ group: "MASVS-NETWORK-1" }),
    analyzers: [],
    scope: { groups: ["MASVS-NETWORK"], profile: null, variant: "release" },
    stamps: { wardVersion: "test", mastg, osvDate: null },
    allGroups: ["MASVS-NETWORK"],
  });
  for (const c of r.controls)
    for (const t of c.checks)
      if (t.verdict === null)
        Object.assign(t, { verdict: "NO FINDING", by: "agent", reason: "ok" });
  return finalize(r);
}

/** The first test row, set to FAIL with the given evidence. */
function withEvidence(evidence: Check["evidence"]): Report {
  const r = base();
  const t = r.controls[0]?.checks.find((c) => c.kind === "test");
  if (!t) throw new Error("no test under MASVS-NETWORK-1");
  Object.assign(t, { verdict: "FAIL", by: "agent", evidence });
  return finalize(r);
}

const kinds = async (r: unknown): Promise<IssueKind[]> =>
  (await checkReport(r, root, kb)).issues.map((i) => i.kind);

describe("checkReport", () => {
  it("passes a consistent report with real evidence and quotes", async () => {
    const r = withEvidence([
      {
        file: "app/src/Api.kt",
        line: 1,
        detail: "MASWE-0050",
        quote: '"http://example.com"',
      },
      {
        file: "app/src/Api.kt",
        line: 1,
        detail: "two lines",
        quote: 'example.com"\n  client',
      },
      { file: "app/src/Win.kt", line: 2, detail: "CRLF", quote: "line two" },
    ]);
    const res = await checkReport(r, root, kb);
    expect(res.issues).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.checked).toMatchObject({ evidence: 3, quotes: 3 });
    expect(res.checked.ids).toBeGreaterThan(3);
  });

  it("rejects a bad shape with one schema issue", async () => {
    expect(await kinds({ schema: "ward-report/1" })).toEqual(["schema"]);
    expect(await kinds("nope")).toEqual(["schema"]);
  });

  it("flags quotes that aren't at the line, blank quotes and lines past the end", async () => {
    const r = withEvidence([
      {
        file: "app/src/Api.kt",
        line: 2,
        detail: "",
        quote: '"http://example.com"',
      },
      { file: "app/src/Api.kt", line: 1, detail: "", quote: "  " },
      { file: "app/src/Api.kt", line: 3, detail: "" },
      {
        file: "app/src/Api.kt",
        line: 1,
        detail: "",
        quote: '"http://example.org"',
      },
    ]);
    expect(await kinds(r)).toEqual([
      "quote-mismatch",
      "blank-quote",
      "line-past-end",
      "quote-mismatch",
      "fail-without-evidence",
    ]);
  });

  it("refuses paths outside the root, symlinks out, folders and missing files", async () => {
    const r = withEvidence([
      { file: "../ward-x/secret.txt", line: 1, detail: "" },
      { file: path.join(outside, "secret.txt"), line: 1, detail: "" },
      { file: "link.txt", line: 1, detail: "" },
      { file: "dir", line: 1, detail: "" },
      { file: "app/src/Nope.kt", line: 1, detail: "" },
    ]);
    expect(await kinds(r)).toEqual([
      "path-outside",
      "path-outside",
      "path-outside",
      "not-a-file",
      "no-such-file",
      "fail-without-evidence",
    ]);
  });

  it("flags unknown, misplaced and retitled IDs, and unknown IDs in text", async () => {
    const r = base();
    const c = r.controls[0];
    const [t, w] = [c?.checks[0], c?.checks[1]];
    if (!c || !t || !w) throw new Error("fixture");
    t.reason = "See MASWE-9999 and MASTG-TEST-0233.";
    t.title = "Something else";
    w.maswe = ["MASWE-0001"];
    c.checks.push({ ...t, id: "MASTG-TEST-9999", title: "x", maswe: [] });
    c.checks.push({ ...t, id: "MASTG-TEST-0001", title: "x", maswe: [] });
    const got = await kinds(finalize(r));
    expect(got).toContain("unknown-id");
    expect(got).toContain("misplaced-id");
    expect(got).toContain("title-mismatch");
    const res = await checkReport(finalize(r), root, kb);
    expect(res.issues.map((i) => i.message).join(" ")).toContain("MASWE-9999");
  });

  it("flags a control verdict, counts or gaps that don't follow the checks", async () => {
    const r = base();
    const c = r.controls[0];
    if (!c) throw new Error("fixture");
    c.verdict = "NO FINDING";
    r.counts.checks.FAIL = 3;
    r.gaps.manual = [];
    expect(await kinds(r)).toEqual([
      "rollup-mismatch",
      "rollup-mismatch",
      "rollup-mismatch",
    ]);
  });

  it("flags a hardening flag the ID and profile don't give (ADR 0014)", async () => {
    const r = base();
    const t = r.controls[0]?.checks[0];
    if (!t) throw new Error("fixture");
    t.hardening = true;
    const res = await checkReport(finalize(r), root, kb);
    expect(res.issues.map((i) => i.message).join(" ")).toMatch(
      /not a hardening check/,
    );
  });

  it("flags a stale MASTG pin and bad filesInspected", async () => {
    const r = base();
    r.stamps.mastg = { version: "v0", commit: "0" };
    const t = r.controls[0]?.checks[0];
    if (!t) throw new Error("fixture");
    t.filesInspected = ["app/src/Api.kt", "/etc/passwd"];
    r.analyzers = [
      { name: "manifest", filesInspected: ["gone.xml"], limits: [] },
    ];
    expect(await kinds(r)).toEqual([
      "stale-pin",
      "no-such-file",
      "path-outside",
    ]);
  });
});

describe("dropBadEvidence", () => {
  it("keeps only evidence that passed, and re-finalizes", async () => {
    const r = withEvidence([
      { file: "app/src/Api.kt", line: 9, detail: "" },
      { file: "app/src/Api.kt", line: 1, detail: "", quote: "val url" },
    ]);
    const res = await checkReport(r, root, kb);
    const clean = dropBadEvidence(r, res.issues);
    const t = clean.controls[0]?.checks.find((c) => c.verdict === "FAIL");
    expect(t?.evidence).toEqual([
      { file: "app/src/Api.kt", line: 1, detail: "", quote: "val url" },
    ]);
    expect((await checkReport(clean, root, kb)).ok).toBe(true);
  });
});

describe("dropBadEvidence on IDs", () => {
  it("drops evidence citing an unknown ID, and all evidence of a misplaced check", async () => {
    const r = withEvidence([
      { file: "app/src/Api.kt", line: 1, detail: "see MASWE-9999" },
      { file: "app/src/Api.kt", line: 1, detail: "fine" },
    ]);
    const c = r.controls[0];
    const t = c?.checks.find((x) => x.verdict === "FAIL");
    if (!c || !t) throw new Error("fixture");
    const res = await checkReport(r, root, kb);
    expect(res.issues[0]).toMatchObject({ kind: "unknown-id", evidence: 0 });
    expect(
      dropBadEvidence(r, res.issues).controls[0]?.checks.find(
        (x) => x.id === t.id,
      )?.evidence,
    ).toHaveLength(1);

    c.checks.push({ ...t, id: "MASTG-TEST-0001", title: "x" });
    const r2 = finalize(r);
    const res2 = await checkReport(r2, root, kb);
    const moved = dropBadEvidence(r2, res2.issues).controls[0]?.checks.find(
      (x) => x.id === "MASTG-TEST-0001",
    );
    expect(moved?.evidence).toEqual([]);
  });
});

describe("quotes", () => {
  it("splits lines without CR or a trailing empty line", () => {
    expect(splitLines("a\r\nb\r\n")).toEqual(["a", "b"]);
    expect(splitLines("")).toEqual([""]);
  });

  it("matches byte for byte, across lines, from the given line only", () => {
    const lines = ["  foo(bar)", "  baz()"];
    expect(quoteMatches(lines, 1, "foo(bar)")).toBeNull();
    expect(quoteMatches(lines, 1, "foo(bar)\n  baz")).toBeNull();
    expect(quoteMatches(lines, 1, "foo(bar)\r\n  baz")).toBeNull();
    expect(quoteMatches(lines, 2, "foo(bar)")).toBe("quote-mismatch");
    expect(quoteMatches(lines, 1, "foo( bar)")).toBe("quote-mismatch");
    expect(quoteMatches(lines, 1, "\n")).toBe("blank-quote");
  });
});
