import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import {
  analyzeDependencies,
  parseCatalog,
  readDependencies,
  scopeOf,
  settingsModules,
} from "./dependencies.js";
import { buildIndex, loadOsv, OSV_URL, unzip, type Fetcher } from "./osv.js";

// Offline: a hand-built zip stands in for OSV's Maven/all.zip, and fetch
// is injected. Fixtures copied without build/. Never HO-01…HO-10.

const repo = path.resolve(import.meta.dirname, "../../..");
const temps: string[] = [];
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
});
function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "ward-deps-"));
  temps.push(d);
  return d;
}
function copyFixture(name: string): string {
  const d = temp();
  cpSync(path.join(repo, "fixtures", name), d, {
    recursive: true,
    filter: (s) => !/[/\\]build([/\\]|$)/.test(s),
  });
  return d;
}

/** A minimal zip writer: entries deflated (or stored), no ZIP64. */
function zip(entries: Record<string, string>, method: 0 | 8 = 8): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text);
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, end]);
}

const advisory = (id: string, pkg: string, events: object[], extra = {}) =>
  JSON.stringify({
    id,
    aliases: ["CVE-2099-0001"],
    summary: `Test advisory for ${pkg}`,
    modified: "2026-11-01T00:00:00Z",
    affected: [
      {
        package: { ecosystem: "Maven", name: pkg },
        ranges: [{ type: "ECOSYSTEM", events }],
      },
    ],
    database_specific: { severity: "HIGH" },
    ...extra,
  });

// Test data, not OSV's real records.
const FAKE_ZIP = zip({
  "GHSA-test-gson.json": advisory(
    "GHSA-test-gson",
    "com.google.code.gson:gson",
    [{ introduced: "0" }, { fixed: "2.8.9" }],
  ),
  "GHSA-test-withdrawn.json": advisory(
    "GHSA-test-withdrawn",
    "com.squareup.okhttp3:okhttp",
    [{ introduced: "0" }],
    { withdrawn: "2026-01-01T00:00:00Z" },
  ),
  "GHSA-test-npm.json": JSON.stringify({
    id: "GHSA-test-npm",
    affected: [
      {
        package: { ecosystem: "npm", name: "left-pad" },
        ranges: [{ type: "SEMVER", events: [{ introduced: "0" }] }],
      },
    ],
  }),
});

function fakeFetch(
  body: Buffer = FAKE_ZIP,
  status = 200,
): Fetcher & { calls: { url: string; headers: Record<string, string> }[] } {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const f = (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    return Promise.resolve(
      new Response(status === 304 ? null : new Uint8Array(body), {
        status,
        headers: { "last-modified": "Fri, 20 Nov 2026 16:33:30 GMT" },
      }),
    );
  };
  return Object.assign(f, { calls });
}
const failingFetch: Fetcher = () => Promise.reject(new Error("offline"));
const at = (iso: string) => () => new Date(iso);

describe("unzip and index", () => {
  it("reads deflated and stored entries", () => {
    expect(
      unzip(zip({ "a.json": "{}" }))
        .get("a.json")
        ?.toString(),
    ).toBe("{}");
    expect(
      unzip(zip({ "b.txt": "hi" }, 0))
        .get("b.txt")
        ?.toString(),
    ).toBe("hi");
  });

  it("rejects what isn't a plain zip", () => {
    expect(() => unzip(Buffer.from("not a zip at all, not at all"))).toThrow(
      "not a zip",
    );
    const z = zip({ "a.json": "{}" });
    z.writeUInt16LE(12, 8); // local header method: harmless
    const cd = z.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    z.writeUInt16LE(12, cd + 10);
    expect(() => unzip(z)).toThrow("method 12");
  });

  it("keeps Maven entries of advisories not withdrawn", () => {
    const index = buildIndex(unzip(FAKE_ZIP), { downloadedAt: "x" });
    expect(Object.keys(index.packages)).toEqual(["com.google.code.gson:gson"]);
    expect(index.advisoryCount).toBe(1);
    expect(index.packages["com.google.code.gson:gson"]?.[0]).toMatchObject({
      id: "GHSA-test-gson",
      severity: "HIGH",
      aliases: ["CVE-2099-0001"],
    });
  });
});

describe("loadOsv", () => {
  it("downloads once, then uses the cache for 24 hours", async () => {
    const cacheDir = temp();
    const f = fakeFetch();
    const first = await loadOsv({
      cacheDir,
      fetch: f,
      now: at("2026-11-23T08:00:00Z"),
    });
    expect(first.status).toBe("downloaded");
    expect(f.calls[0]?.url).toBe(OSV_URL);
    expect(first.index?.lastModified).toBe("Fri, 20 Nov 2026 16:33:30 GMT");
    const second = await loadOsv({
      cacheDir,
      fetch: f,
      now: at("2026-11-24T07:00:00Z"),
    });
    expect(second.status).toBe("fresh-cache");
    expect(f.calls).toHaveLength(1);
  });

  it("asks with If-Modified-Since and keeps the data on 304", async () => {
    const cacheDir = temp();
    await loadOsv({
      cacheDir,
      fetch: fakeFetch(),
      now: at("2026-11-20T00:00:00Z"),
    });
    const f = fakeFetch(Buffer.alloc(0), 304);
    const out = await loadOsv({
      cacheDir,
      fetch: f,
      now: at("2026-11-23T00:00:00Z"),
    });
    expect(f.calls[0]?.headers["if-modified-since"]).toBe(
      "Fri, 20 Nov 2026 16:33:30 GMT",
    );
    expect(out.status).toBe("not-modified");
    expect(out.index?.downloadedAt).toBe("2026-11-23T00:00:00.000Z");
  });

  it("falls back to a stale cache, or to nothing", async () => {
    const cacheDir = temp();
    await loadOsv({
      cacheDir,
      fetch: fakeFetch(),
      now: at("2026-11-01T00:00:00Z"),
    });
    const stale = await loadOsv({
      cacheDir,
      fetch: failingFetch,
      now: at("2026-11-23T00:00:00Z"),
    });
    expect(stale).toMatchObject({
      status: "stale-cache",
      problem: "download failed: offline",
    });
    const none = await loadOsv({ cacheDir: temp(), fetch: failingFetch });
    expect(none).toMatchObject({ status: "unavailable" });
    expect(none.index).toBeUndefined();
    const offline = await loadOsv({ cacheDir: temp(), offline: true });
    expect(offline.status).toBe("unavailable");
  });

  it("refuses a bad download without writing a cache", async () => {
    const cacheDir = temp();
    const out = await loadOsv({
      cacheDir,
      fetch: fakeFetch(Buffer.from("<html>error</html>")),
    });
    expect(out.status).toBe("unavailable");
    expect(existsSync(path.join(cacheDir, "osv-maven.json"))).toBe(false);
    const http = await loadOsv({ cacheDir, fetch: fakeFetch(FAKE_ZIP, 500) });
    expect(http.problem).toBe("download failed: HTTP 500");
  });
});

describe("version catalog and build files", () => {
  const catalog = parseCatalog(`
[versions]
okhttp = "4.9.0"   # comment
rich = { strictly = "[1.0, 2.0)" }
dyn = "1.+"

[libraries]
okhttp = { module = "com.squareup.okhttp3:okhttp", version.ref = "okhttp" }
plain = "com.example:plain:1.2.3"
named = { group = "com.example", name = "named", version = "2.0" }
richlib = { module = "com.example:rich", version.ref = "rich" }
dynlib = { module = "com.example:dyn", version.ref = "dyn" }
bommed = { module = "androidx.compose.ui:ui" }
missing-ref = { module = "com.example:m", version.ref = "nope" }

[bundles]
net = [
  "okhttp",
  "plain",
]
`);

  it("parses libraries, versions and multi-line bundles", () => {
    expect(catalog.versions.get("okhttp")).toEqual({ value: "4.9.0", line: 3 });
    expect(catalog.versions.get("rich")?.unresolved).toMatch(/rich/);
    expect(catalog.versions.get("dyn")?.value).toBeUndefined();
    expect(catalog.bundles.get("net")).toEqual(["okhttp", "plain"]);
    expect(catalog.libraries.get("named")).toMatchObject({
      group: "com.example",
      name: "named",
      version: { value: "2.0" },
    });
  });

  it("reads declarations with the version's file:line", () => {
    const deps = readDependencies(
      "app",
      "app/build.gradle.kts",
      `buildscript {
    dependencies { classpath("com.android.tools.build:gradle:1.0.0") }
}
dependencies {
    implementation(libs.okhttp)
    implementation(libs.bundles.net)
    implementation("com.example:direct:3.1@aar")
    implementation("com.example:var:$someVersion")
    implementation(platform("com.example:bom:1.0"))
    implementation(project(":core"))
    // implementation("com.example:commented:1.0")
    api(libs.named)
    implementation(libs.richlib)
    implementation(libs.dynlib)
    implementation(libs.bommed)
    implementation(libs.missing.ref)
    testImplementation("junit:junit:4.12")
    debugImplementation("com.example:leak:1.0")
    ksp("com.example:proc:1.0")
    compileOnly("com.example:annot:1.0")
    freeImplementation("com.example:flavor:1.0")
}
`,
      catalog,
      "release",
    );
    const by = (n: string) => deps.find((d) => d.name === n);
    expect(deps.some((d) => d.name === "gradle")).toBe(false);
    expect(deps.some((d) => d.name === "commented")).toBe(false);
    expect(by("okhttp")).toMatchObject({
      line: 5,
      version: "4.9.0",
      versionAt: { file: "gradle/libs.versions.toml", line: 3 },
      scope: "release",
    });
    expect(deps.filter((d) => d.via === "bundle net")).toHaveLength(2);
    expect(by("direct")?.version).toBe("3.1");
    expect(by("var")?.unresolved).toMatch(/variable/);
    expect(by("bom")?.version).toBe("1.0");
    expect(by("named")?.version).toBe("2.0");
    expect(by("rich")?.unresolved).toMatch(/rich/);
    expect(by("dyn")?.unresolved).toMatch(/rich version or range/);
    expect(by("ui")?.unresolved).toMatch(/BOM/);
    expect(by("m")?.unresolved).toMatch(/not in \[versions\]/);
    expect(by("junit")?.scope).toBe("test");
    expect(by("leak")?.scope).toBe("debug");
    expect(by("proc")?.scope).toBe("build-time");
    expect(by("annot")?.scope).toBe("build-time");
    expect(by("flavor")?.scope).toBe("release");
  });

  it("reads Groovy notation", () => {
    const deps = readDependencies(
      "",
      "build.gradle",
      `dependencies {
    implementation 'com.example:groovy:1.0'
    implementation group: 'com.example', name: 'mapped', version: '2.0'
}`,
      undefined,
      "release",
    );
    expect(deps.map((d) => `${d.name ?? ""}:${d.version ?? ""}`)).toEqual([
      "groovy:1.0",
      "mapped:2.0",
    ]);
  });

  it("scopes debug dependencies as shipped for a debug variant", () => {
    expect(scopeOf("debugImplementation", "debug")).toBe("release");
    expect(scopeOf("androidTestImplementation", "release")).toBe("test");
  });

  it("reads settings includes", () => {
    expect(
      settingsModules(`include(":app", ":core:data")\ninclude ':wear'`),
    ).toEqual(["app", "core/data", "wear"]);
  });
});

describe("analyzeDependencies", () => {
  const cached = async () => {
    const cacheDir = temp();
    await loadOsv({
      cacheDir,
      fetch: fakeFetch(),
      now: at("2026-11-23T08:00:00Z"),
    });
    return cacheDir;
  };

  it("EA-19: Gson 2.8.5 FAIL at the catalog line", async () => {
    const r = await analyzeDependencies(copyFixture("example-app"), "release", {
      cacheDir: await cached(),
      now: at("2026-11-23T09:00:00Z"),
    });
    const fail = r.verdicts.filter((v) => v.verdict === "FAIL");
    expect(fail).toHaveLength(1);
    expect(fail[0]).toMatchObject({
      coordinate: "com.google.code.gson:gson:2.8.5",
      mastg: ["MASTG-TEST-0272"],
      maswe: ["MASWE-0044"],
      dataDate: "2026-11-23T08:00:00.000Z",
      advisories: [
        {
          id: "GHSA-test-gson",
          fixed: ["2.8.9"],
          source: "GitHub Advisory Database",
          licence: "CC BY 4.0",
          url: "https://osv.dev/vulnerability/GHSA-test-gson",
        },
      ],
    });
    expect(fail[0]?.evidence[0]).toMatchObject({
      file: "gradle/libs.versions.toml",
      line: 11,
    });
    expect(fail[0]?.evidence[1]).toMatchObject({
      file: "sync/build.gradle.kts",
      line: 37,
    });
    expect(r.osv).toMatchObject({ status: "fresh-cache", ageHours: 1 });
    expect(r.modules).toEqual(["", "app", "sync"]);
    // Compose UI libraries come from the BOM: MANUAL for the rest.
    expect(r.verdicts.at(-1)?.verdict).toBe("MANUAL");
  });

  it("clean twin: no FAIL", async () => {
    const r = await analyzeDependencies(
      copyFixture("example-app-clean"),
      "release",
      { cacheDir: await cached(), now: at("2026-11-23T09:00:00Z") },
    );
    expect(r.verdicts.some((v) => v.verdict === "FAIL")).toBe(false);
  });

  it("NO FINDING only when every release dependency has a version", async () => {
    const root = temp();
    writeFileSync(path.join(root, "settings.gradle.kts"), `include(":app")`);
    mkdirSync(path.join(root, "app"));
    writeFileSync(
      path.join(root, "app/build.gradle.kts"),
      `dependencies {
    implementation("com.google.code.gson:gson:2.8.9")
    testImplementation("com.example:nover")
}`,
    );
    const r = await analyzeDependencies(root, "release", {
      cacheDir: await cached(),
      now: at("2026-11-23T09:00:00Z"),
    });
    expect(r.verdicts).toHaveLength(1);
    expect(r.verdicts[0]?.verdict).toBe("NO FINDING");
    expect(r.verdicts[0]?.reason).toContain("2026-11-23T08:00:00.000Z");
  });

  it("no data: MANUAL, never NO FINDING; old data is a limit", async () => {
    const root = copyFixture("example-app-clean");
    const none = await analyzeDependencies(root, "release", {
      cacheDir: temp(),
      fetch: failingFetch,
    });
    expect(none.verdicts).toHaveLength(1);
    expect(none.verdicts[0]).toMatchObject({
      verdict: "MANUAL",
      dataDate: null,
    });
    const old = await analyzeDependencies(root, "release", {
      cacheDir: await cached(),
      fetch: failingFetch,
      now: at("2026-11-30T08:00:00Z"),
    });
    expect(old.osv.status).toBe("stale-cache");
    expect(old.limits.join(" ")).toContain("168 hours old");
  });
});
