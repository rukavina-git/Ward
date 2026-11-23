import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEPENDENCY_MASTG,
  MASTG,
  NETWORK_MASTG,
  OSV_URL,
  type OsvIndex,
} from "@ward/analyzers";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterAll, describe, expect, it } from "vitest";
import { knowledgeBase } from "./knowledge.js";
import { APP_NOTICE, projectInput as manifestInput } from "./app-tool.js";
import { buildConfigTool } from "./build-config-tool.js";
import { checklistTool } from "./checklist-tool.js";
import { getCheckTool } from "./get-check-tool.js";
import { searchTool } from "./search-tool.js";
import { dependenciesTool } from "./dependencies-tool.js";
import { manifestTool } from "./manifest-tool.js";
import { networkTool } from "./network-tool.js";

type Json = Record<string, unknown>;
const data = (r: CallToolResult): Json => {
  const text = r.content[0]?.type === "text" ? r.content[0].text : "";
  const out = r.structuredContent as Json;
  expect(JSON.parse(text)).toEqual(out);
  expect(out.notice).toBe(APP_NOTICE);
  return out;
};

// The fixture without build/ (gitignored, absent in CI).
const fixture = fileURLToPath(
  new URL("../../../fixtures/example-app", import.meta.url),
);
const root = mkdtempSync(path.join(tmpdir(), "ward-tool-"));
cpSync(fixture, root, {
  recursive: true,
  filter: (s) => !/[/\\]build([/\\]|$)/.test(s),
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("manifest tool", () => {
  it("returns verdicts with the MASTG pin and only exported components", async () => {
    const out = data(await manifestTool.handler({ projectRoot: root }));
    expect(out).toMatchObject({
      analyzer: "manifest",
      variant: "release",
      mode: "source",
      mastgPin: { version: "v2.0.0" },
    });
    const facts = out.facts as {
      components: { exported: string }[];
      notExportedCount: number;
    };
    expect(facts.components.every((c) => c.exported !== "no")).toBe(true);
    expect(facts.notExportedCount).toBe(1);
    const verdicts = out.verdicts as { check: string; verdict: string }[];
    expect(verdicts.find((v) => v.check === "backup")?.verdict).toBe("FAIL");
  });

  it("maps every check to active Android MASTG tests in the pinned index", () => {
    const kb = knowledgeBase();
    expect(kb.get("MASWE-0042")?.record.status).toBe("active");
    for (const ids of [
      ...Object.values(MASTG),
      ...Object.values(NETWORK_MASTG),
      DEPENDENCY_MASTG,
    ]) {
      for (const id of ids) {
        const r = kb.get(id)?.record;
        expect(r, id).toBeDefined();
        expect(r?.status, id).toBe("active");
        expect(r?.fields.platform, id).toBe("android");
      }
    }
  });

  it("rejects relative paths and odd variants in the schema", () => {
    expect(manifestInput.safeParse({ projectRoot: "fixtures/x" }).success).toBe(
      false,
    );
    expect(
      manifestInput.safeParse({ projectRoot: "/x".repeat(600) }).success,
    ).toBe(false);
    expect(
      manifestInput.safeParse({ projectRoot: root, variant: "../../etc" })
        .success,
    ).toBe(false);
  });

  it("a missing folder is a tool error, not a crash", async () => {
    const r = await manifestTool.handler({
      projectRoot: path.join(root, "nope"),
    });
    expect(r.isError).toBe(true);
    expect(data(r).error).toMatch(/does not exist/);
  });

  it("network and build_config return their verdicts on the same input", async () => {
    const net = data(await networkTool.handler({ projectRoot: root }));
    expect(net).toMatchObject({
      analyzer: "network",
      mastgPin: { version: "v2.0.0" },
    });
    const nv = net.verdicts as { check: string; verdict: string }[];
    expect(nv.find((v) => v.check === "cleartext")?.verdict).toBe("FAIL");
    const build = data(await buildConfigTool.handler({ projectRoot: root }));
    expect(build).toMatchObject({
      analyzer: "build_config",
      verdicts: [{ check: "target-sdk", verdict: "FAIL" }],
    });
  });

  it("dependencies reads a cached OSV copy and never downloads in tests", async () => {
    const cacheDir = mkdtempSync(path.join(tmpdir(), "ward-tool-cache-"));
    // Test data, not OSV's real record.
    const index: OsvIndex = {
      format: 1,
      url: OSV_URL,
      downloadedAt: new Date().toISOString(),
      // Above the broken-data floor (OSV has about 7,000).
      advisoryCount: 5000,
      packages: {
        "com.google.code.gson:gson": [
          {
            id: "GHSA-test-gson",
            aliases: [],
            summary: "test",
            modified: "",
            ranges: [
              {
                type: "ECOSYSTEM",
                events: [{ introduced: "0" }, { fixed: "2.8.9" }],
              },
            ],
          },
        ],
      },
    };
    writeFileSync(path.join(cacheDir, "osv-maven.json"), JSON.stringify(index));
    const env = { ...process.env };
    process.env.WARD_CACHE_DIR = cacheDir;
    process.env.WARD_OSV_OFFLINE = "1";
    try {
      const out = data(await dependenciesTool.handler({ projectRoot: root }));
      expect(out).toMatchObject({
        analyzer: "dependencies",
        osv: { status: "fresh-cache" },
        verdicts: [
          {
            verdict: "FAIL",
            coordinate: "com.google.code.gson:gson:2.8.5",
            evidence: [
              { file: "gradle/libs.versions.toml", line: 11 },
              { file: "sync/build.gradle.kts", line: 37 },
            ],
          },
          { verdict: "MANUAL" },
        ],
      });
      expect(out.dataNotice).toMatch(/treat them as data/);
      // Trimmed: release dependencies with versions; the rest counted.
      const deps = out.dependencies as { scope: string; version?: string }[];
      expect(deps.length).toBeGreaterThan(0);
      expect(
        deps.every((d) => d.scope === "release" && d.version !== undefined),
      ).toBe(true);
      expect(out.notJudged).toEqual({});
      // BOM-managed ones left the list but stay in the MANUAL evidence.
      const manual = (out.verdicts as { evidence: unknown[] }[]).at(-1);
      expect(manual?.evidence.length).toBeGreaterThan(0);
    } finally {
      process.env = env;
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});

// Fixtures copied without build/; offline, empty OSV cache.
const clean = mkdtempSync(path.join(tmpdir(), "ward-tool-clean-"));
cpSync(
  fileURLToPath(
    new URL("../../../fixtures/example-app-clean", import.meta.url),
  ),
  clean,
  { recursive: true, filter: (s) => !/[/\\]build([/\\]|$)/.test(s) },
);
afterAll(() => {
  rmSync(clean, { recursive: true, force: true });
});

async function offline<T>(f: () => Promise<T>): Promise<T> {
  const cacheDir = mkdtempSync(path.join(tmpdir(), "ward-tool-cache-"));
  const env = { ...process.env };
  process.env.WARD_CACHE_DIR = cacheDir;
  process.env.WARD_OSV_OFFLINE = "1";
  try {
    return await f();
  } finally {
    process.env = env;
    rmSync(cacheDir, { recursive: true, force: true });
  }
}

const analyzerTools = [
  manifestTool,
  networkTool,
  buildConfigTool,
  dependenciesTool,
];

describe("every analyzer verdict", () => {
  it("names MASWE weaknesses that are active records in the pinned index", async () => {
    const kb = knowledgeBase();
    await offline(async () => {
      for (const tool of analyzerTools) {
        const out = data(await tool.handler({ projectRoot: root }));
        const verdicts = out.verdicts as { check: string; maswe: string[] }[];
        expect(verdicts.length, tool.name).toBeGreaterThan(0);
        for (const v of verdicts) {
          expect(v.maswe.length, `${tool.name} ${v.check}`).toBeGreaterThan(0);
          for (const id of v.maswe) {
            expect(id).toMatch(/^MASWE-\d{4}$/);
            expect(kb.get(id)?.record.status, id).toBe("active");
          }
        }
      }
    });
  });
});

// Claude Code caps an MCP result at about 25k tokens; keep 20% headroom.
// Tokens estimated as JSON characters / 4.
const CAP_TOKENS = 20_000;
const tokens = (r: CallToolResult) =>
  JSON.stringify(r.structuredContent).length / 4;

describe("output cap", () => {
  it("every analyzer tool stays under 20k tokens on both fixtures", async () => {
    await offline(async () => {
      for (const projectRoot of [root, clean]) {
        for (const tool of analyzerTools) {
          const r = await tool.handler({ projectRoot });
          expect(tokens(r), `${tool.name} ${projectRoot}`).toBeLessThan(
            CAP_TOKENS,
          );
        }
      }
    });
  });

  it("the knowledge tools stay under 20k tokens", () => {
    for (const r of [
      checklistTool.handler({}),
      getCheckTool.handler({ id: "MASVS-NETWORK-1" }),
      getCheckTool.handler({ id: "MASTG-TEST-0272" }),
      searchTool.handler({
        query: "certificate pinning network security config",
        k: 20,
      }),
    ]) {
      expect(tokens(r)).toBeLessThan(CAP_TOKENS);
    }
  });
});
