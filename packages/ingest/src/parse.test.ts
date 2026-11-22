import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseControls,
  parseDemos,
  parseLegacyTests,
  parseTests,
  parseWeaknesses,
} from "./parse.js";
import { fixturesRoot } from "./paths.js";
import { pinnedSources, type PinnedSource, type SourceKey } from "./sources.js";

const src = (key: SourceKey): PinnedSource => {
  const found = pinnedSources.find((s) => s.key === key);
  if (!found) throw new Error(key);
  return found;
};
const masvs = join(fixturesRoot, "masvs");
const maswe = join(fixturesRoot, "maswe");
const mastg = join(fixturesRoot, "mastg");

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

/** A temp repo with the given files (path → text). */
function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ward-parse-"));
  temps.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe("parseControls (real MASVS files)", () => {
  it("takes the ID from the heading and the statement as title", () => {
    const [auth, crypto] = parseControls(masvs, src("masvs")).map(
      (p) => p.record,
    );
    expect(auth?.id).toBe("MASVS-AUTH-2");
    expect(crypto?.id).toBe("MASVS-CRYPTO-2");
    expect(auth?.kind).toBe("control");
    expect(auth?.title).toMatch(/^The app performs local authentication/);
    expect(auth?.body).toMatch(/^## Control\n/);
    expect(auth?.source).toEqual({
      name: "OWASP MASVS",
      version: "v2.1.0",
      commit: "8e133d09f4140518ed04cc254b18be9ff4990ffc",
      path: "controls/MASVS-AUTH-2.md",
      url: "https://github.com/OWASP/masvs/blob/v2.1.0/controls/MASVS-AUTH-2.md",
      licence: "CC-BY-SA-4.0",
    });
  });

  it("refuses a heading that doesn't match the file name", () => {
    const root = repo({
      "controls/MASVS-AUTH-1.md": "# MASVS-AUTH-9\n\n## Control\n\nX.\n",
    });
    expect(() => parseControls(root, src("masvs"))).toThrow(
      /doesn't match the file name/,
    );
  });
});

describe("parseWeaknesses (real MASWE file)", () => {
  it("links controls and keeps beta IDs for translation", () => {
    const [p] = parseWeaknesses(maswe, src("maswe"));
    expect(p?.record.id).toBe("MASWE-0020");
    expect(p?.record.links.controls).toEqual([
      "MASVS-AUTH-2",
      "MASVS-CRYPTO-2",
    ]);
    expect(p?.betaIds).toContain("MASWE-0044");
    expect(p?.record.fields).not.toHaveProperty("id");
    expect(p?.record.fields).not.toHaveProperty("title");
    expect(p?.record.fields).toHaveProperty("mappings");
    expect(p?.record.source.url).toBe(
      "https://github.com/OWASP/maswe/blob/v1.0.0/weaknesses/MASVS-AUTH/MASWE-0020.md",
    );
  });

  it("skips iOS-only weaknesses and fails on an unknown status", () => {
    const front = (id: string, extra: string): string =>
      `---\nid: ${id}\ntitle: T\n${extra}mappings:\n  masvs-v2: [MASVS-AUTH-1]\n---\nbody\n`;
    const ios = repo({
      "weaknesses/MASVS-AUTH/MASWE-0001.md": front(
        "MASWE-0001",
        "platform: [ios]\n",
      ),
    });
    expect(parseWeaknesses(ios, src("maswe"))).toEqual([]);
    const odd = repo({
      "weaknesses/MASVS-AUTH/MASWE-0001.md": front(
        "MASWE-0001",
        "platform: [android]\nstatus: draft\n",
      ),
    });
    expect(() => parseWeaknesses(odd, src("maswe"))).toThrow(
      /MASWE-0001\.md.*status/s,
    );
  });
});

describe("parseTests (real MASTG v2 tests)", () => {
  it("keeps the named beta weakness for the graph step", () => {
    const parsed = parseTests(mastg, src("mastg"));
    expect(parsed.map((p) => p.record.id)).toEqual([
      "MASTG-TEST-0327",
      "MASTG-TEST-0330",
    ]);
    const [p] = parsed;
    expect(p?.namedWeakness).toBe("MASWE-0044");
    expect(p?.record.links.weaknesses).toEqual([]);
    expect(p?.record.status).toBe("active");
    expect(p?.record.fields).toHaveProperty("weakness", "MASWE-0044");
    expect(p?.record.body).toMatch(/^## Overview/);
  });

  it("keeps placeholders with their status", () => {
    const root = repo({
      "tests-beta/android/MASVS-AUTH/MASTG-TEST-0001.md":
        "---\nid: MASTG-TEST-0001\ntitle: T\nplatform: android\nweakness: MASWE-0001\nstatus: placeholder\n---\n",
    });
    expect(parseTests(root, src("mastg"))[0]?.record.status).toBe(
      "placeholder",
    );
  });
});

describe("parseLegacyTests (real MASTG v1 test)", () => {
  it("is deprecated, takes its ID from the file name and links its replacements", () => {
    const [p] = parseLegacyTests(mastg, src("mastg"));
    expect(p?.record.id).toBe("MASTG-TEST-0017");
    expect(p?.record.status).toBe("deprecated");
    expect(p?.record.links.coveredBy).toEqual([
      "MASTG-TEST-0327",
      "MASTG-TEST-0330",
    ]);
    expect(p?.record.links.controls).toEqual(["MASVS-AUTH-2"]);
  });

  it("links only real test IDs from covered_by", () => {
    const root = repo({
      "tests/android/MASVS-CODE/MASTG-TEST-0046.md":
        "---\ntitle: T\nplatform: android\nstatus: deprecated\nmasvs_v2_id: [MASVS-CODE-1]\ncovered_by: [MASTG-TEST-0046-1, MASTG-TEST-0300]\n---\n",
    });
    const [p] = parseLegacyTests(root, src("mastg"));
    expect(p?.record.links.coveredBy).toEqual(["MASTG-TEST-0300"]);
    expect(p?.record.fields).toHaveProperty("covered_by", [
      "MASTG-TEST-0046-1",
      "MASTG-TEST-0300",
    ]);
  });
});

describe("parseDemos (real MASTG demo)", () => {
  it("links its test and keeps its code files as text", () => {
    const [p] = parseDemos(mastg, src("mastg"));
    const demo = p?.record;
    expect(demo?.id).toBe("MASTG-DEMO-0090");
    expect(demo?.links.tests).toEqual(["MASTG-TEST-0327"]);
    const dir = "demos/android/MASVS-AUTH/MASTG-DEMO-0090";
    expect(demo?.files.map((f) => f.path)).toEqual([
      `${dir}/AndroidManifest.xml`,
      `${dir}/MastgTest.kt`,
      `${dir}/MastgTest_reversed.java`,
      `${dir}/output.txt`,
      `${dir}/run.sh`,
    ]);
    expect(demo?.files.find((f) => f.path.endsWith("run.sh"))?.text).toMatch(
      /semgrep/,
    );
  });

  it("skips binary, unknown and oversized files", () => {
    const dir = "demos/android/MASVS-CODE/MASTG-DEMO-0001";
    const root = repo({
      [`${dir}/MASTG-DEMO-0001.md`]:
        "---\nid: MASTG-DEMO-0001\ntitle: T\nplatform: android\ntest: MASTG-TEST-0001\n---\n",
      [`${dir}/Main.kt`]: "fun main() {}\n",
      [`${dir}/shot.png`]: "PNG",
      [`${dir}/sbom.json`]: "x".repeat(64 * 1024 + 1),
      [`${dir}/latin1.txt`]: "",
    });
    writeFileSync(
      join(root, dir, "latin1.txt"),
      Buffer.from([0xff, 0xfe, 0x00]),
    );
    const [p] = parseDemos(root, src("mastg"));
    expect(p?.record.files.map((f) => f.path)).toEqual([`${dir}/Main.kt`]);
  });
});
