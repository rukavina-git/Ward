import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportSchema, type Report } from "@ward/report";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterAll, describe, expect, it } from "vitest";
import { getCheckTool } from "./get-check-tool.js";
import { createServer } from "./server.js";
import { resetServed, servedIds } from "./served.js";
import { reportSkeletonTool } from "./report-skeleton-tool.js";
import { writeReportTool } from "./write-report-tool.js";

const repo = (p: string): string =>
  fileURLToPath(new URL(`../../../${p}`, import.meta.url));

// Fixture copied without build/ (gitignored, absent in CI).
const app = mkdtempSync(path.join(tmpdir(), "ward-write-app-"));
cpSync(repo("fixtures/example-app"), app, {
  recursive: true,
  filter: (s) => !/[/\\]build([/\\]|$)/.test(s),
});
const cache = mkdtempSync(path.join(tmpdir(), "ward-write-cache-"));
const env = { ...process.env };
process.env.WARD_CACHE_DIR = cache;
process.env.WARD_OSV_OFFLINE = "1";
afterAll(() => {
  process.env = env;
  for (const d of [app, cache]) rmSync(d, { recursive: true, force: true });
});

interface Out {
  error?: string;
  written?: string;
  summary: string;
  fills: { total: number; applied: number; rejected: unknown[] };
  citations: { issues: unknown[] };
}
const out = (r: CallToolResult) => r.structuredContent as Out;
const skeleton = async (): Promise<Report> =>
  reportSchema.parse(
    (await reportSkeletonTool.handler({ projectRoot: app })).structuredContent,
  );
const writeFills = (fills: unknown[], rel = ".ward/fills.json"): void => {
  mkdirSync(path.dirname(path.join(app, rel)), { recursive: true });
  writeFileSync(path.join(app, rel), JSON.stringify({ fills }));
};

describe("write_report", () => {
  it("writes the report from fills, keeping prefills and dropping bad quotes", async () => {
    const skel = await skeleton();
    const rows = skel.controls.flatMap((c) => c.checks);
    const pending = rows.filter((c) => c.verdict === null).map((c) => c.id);
    const analyzerRow = rows.find((c) => c.by === "analyzer");
    const owaspRow = rows.find((c) => c.by === "owasp");
    expect(pending.length).toBeGreaterThan(2);
    const manifest = "app/src/main/AndroidManifest.xml";
    const lines = readFileSync(path.join(app, manifest), "utf8").split("\n");
    const at = lines.findIndex((l) => l.includes(".MainActivity")) + 1;

    writeFills([
      {
        check: pending[0],
        verdict: "FAIL",
        reason: "Exported activity.",
        evidence: [
          { file: manifest, line: at, detail: "ok", quote: ".MainActivity" },
          { file: manifest, line: at, detail: "bad", quote: "made up" },
        ],
        filesInspected: [manifest],
      },
      {
        check: pending[1],
        verdict: "NO FINDING",
        reason: "Read it.",
        filesInspected: [manifest],
      },
      { check: analyzerRow?.id, verdict: "N/A", reason: "Lowering." },
      {
        check: owaspRow?.id,
        verdict: "NO FINDING",
        reason: "Lowering.",
        filesInspected: [manifest],
      },
    ]);
    const r = await writeReportTool.handler({ projectRoot: app });
    expect(r.isError).toBeFalsy();
    const o = out(r);
    expect(o.written).toBe(".ward/report.json");
    expect(o.fills).toMatchObject({ total: 4, applied: 2 });
    expect(o.fills.rejected).toHaveLength(2);
    expect(o.citations.issues).toEqual([
      expect.objectContaining({ kind: "quote-mismatch", check: pending[0] }),
    ]);
    expect(o.summary).toMatch(/Ward check: 24 MASVS controls/);
    expect(o.summary).toMatch(/Citation check: 1 issue/);
    expect(o.summary.split("\n").length).toBeLessThanOrEqual(40);

    const written = reportSchema.parse(
      JSON.parse(readFileSync(path.join(app, ".ward/report.json"), "utf8")),
    );
    const get = (id?: string) =>
      written.controls.flatMap((c) => c.checks).find((c) => c.id === id);
    expect(get(pending[0])).toMatchObject({ verdict: "FAIL", by: "agent" });
    expect(get(pending[0])?.evidence.map((e) => e.detail)).toEqual(["ok"]);
    expect(get(analyzerRow?.id)?.verdict).toBe(analyzerRow?.verdict);
    expect(get(owaspRow?.id)?.verdict).toBe(owaspRow?.verdict);
    expect(readFileSync(path.join(app, ".ward/.gitignore"), "utf8")).toBe(
      "*\n",
    );
  });

  it("marks an answer test text only after get_check served that ID", async () => {
    rmSync(path.join(app, ".ward"), { recursive: true, force: true });
    resetServed();
    const pending = (await skeleton()).controls
      .flatMap((c) => c.checks)
      .filter((c) => c.verdict === null)
      .map((c) => c.id);
    const [read, title] = pending;
    getCheckTool.handler({ id: String(read).toLowerCase() });
    getCheckTool.handler({ id: "MASTG-TEST-9999" });
    expect([...servedIds()]).toEqual([read]);
    writeFills([
      { check: read, verdict: "N/A", reason: "Read it." },
      { check: title, verdict: "N/A", reason: "Title only." },
    ]);
    const o = out(await writeReportTool.handler({ projectRoot: app }));
    const written = reportSchema.parse(
      JSON.parse(readFileSync(path.join(app, ".ward/report.json"), "utf8")),
    );
    const rows = written.controls.flatMap((c) => c.checks);
    const depth = (id?: string) => rows.find((c) => c.id === id)?.depth;
    expect(depth(read)).toBe("test text");
    expect(depth(title)).toBe("title only");
    expect(rows.find((c) => c.by === "analyzer")?.depth).toBe("analyzer");
    expect(rows.find((c) => c.by === "owasp")?.depth).toBe("index");
    expect(rows.find((c) => c.verdict === null)?.depth).toBeNull();
    const n = (d: string) => rows.filter((c) => c.depth === d).length;
    expect(o.summary).toContain(
      `${String(n("test text"))} of ${String(n("test text") + n("title only"))} agent answers after reading`,
    );
    resetServed();
  });

  it("is a tool error for a missing, invalid or outside fills file", async () => {
    rmSync(path.join(app, ".ward"), { recursive: true, force: true });
    const call = (fillsPath?: string) =>
      writeReportTool.handler({ projectRoot: app, fillsPath });
    expect(out(await call()).error).toMatch(/No file at fillsPath/);

    writeFills([{ check: "X", verdict: "PASS", reason: "r" }]);
    expect(out(await call()).error).toMatch(/fills schema/);

    const outside = mkdtempSync(path.join(tmpdir(), "ward-write-out-"));
    writeFileSync(path.join(outside, "f.json"), '{"fills":[]}');
    symlinkSync(path.join(outside, "f.json"), path.join(app, "link.json"));
    expect(out(await call("link.json")).error).toMatch(/outside/);
    expect(out(await call("../f.json")).error).toBeTruthy();
    expect(out(await call(path.join(outside, "f.json"))).error).toMatch(
      /relative/,
    );
    rmSync(outside, { recursive: true, force: true });
    expect(existsSync(path.join(app, ".ward/report.json"))).toBe(false);
  });

  it("won't write through a symlinked .ward folder", async () => {
    rmSync(path.join(app, ".ward"), { recursive: true, force: true });
    const outside = mkdtempSync(path.join(tmpdir(), "ward-write-dir-"));
    symlinkSync(outside, path.join(app, ".ward"));
    writeFileSync(path.join(app, "fills.json"), '{"fills":[]}');
    const r = await writeReportTool.handler({
      projectRoot: app,
      fillsPath: "fills.json",
    });
    expect(out(r).error).toMatch(/Couldn't write/);
    expect(existsSync(path.join(outside, "report.json"))).toBe(false);
    rmSync(path.join(app, ".ward"));
    rmSync(outside, { recursive: true, force: true });
  });
});

describe("the check skill", () => {
  const skill = readFileSync(repo("prompts/ward-check/SKILL.md"), "utf8");

  it("is copied byte for byte into the plugin (npm run prompts:sync)", () => {
    expect(readFileSync(repo("plugin/skills/check/SKILL.md"), "utf8")).toBe(
      skill,
    );
  });

  it("names only tools the server has", () => {
    const server = createServer() as unknown as {
      _registeredTools: Record<string, unknown>;
    };
    const tools = Object.keys(server._registeredTools);
    // Every snake_case name in backticks is a tool name.
    const named = new Set(
      [...skill.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1]),
    );
    expect([...named].sort()).toEqual([
      "check_report",
      "get_check",
      "report_skeleton",
      "write_report",
    ]);
    for (const n of [...named, "search"]) expect(tools).toContain(n);
  });
});
