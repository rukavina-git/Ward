import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ProjectRootError } from "./find.js";
import {
  analyzeManifest,
  type CheckId,
  type ManifestReport,
} from "./manifest.js";

// Fixtures are copied without build/ (it is gitignored, so CI has none);
// hand-written projects live in temp folders. Never HO-01…HO-10.

const repo = path.resolve(import.meta.dirname, "../../..");
const temps: string[] = [];
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
});

function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "ward-manifest-"));
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

/** Writes files (path → content) into a new temp project. */
function project(files: Record<string, string>): string {
  const d = temp();
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(d, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  return d;
}

const APP_GRADLE = 'plugins { id("com.android.application") }\n';
const manifest = (body: string, app = "") =>
  `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
${body}
    <application ${app}>
    </application>
</manifest>
`;
const withComponents = (
  sdk: string,
  components: string,
  app = 'android:allowBackup="false"',
) =>
  `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
    ${sdk}
    <application ${app}>
${components}
    </application>
</manifest>
`;

const verdict = (r: ManifestReport, check: CheckId) => {
  const v = r.verdicts.find((x) => x.check === check);
  if (!v) throw new Error(`no verdict for ${check}`);
  return v;
};

/** 1-based line of the first line containing `anchor` (answer key style). */
function lineOf(root: string, file: string, anchor: string): number {
  const lines = readFileSync(path.join(root, file), "utf8").split("\n");
  const i = lines.findIndex((l) => l.includes(anchor));
  if (i === -1) throw new Error(`${anchor} not in ${file}`);
  return i + 1;
}

describe("example app (source manifests)", () => {
  const root = copyFixture("example-app");
  const appFile = "app/src/main/AndroidManifest.xml";
  const syncFile = "sync/src/main/AndroidManifest.xml";

  it("reads both modules' main manifests, unmerged, and says so", async () => {
    const r = await analyzeManifest(root);
    expect(r.mode).toBe("source");
    expect(r.filesRead.map((f) => f.file).sort()).toEqual([appFile, syncFile]);
    expect(r.limits.join(" ")).toMatch(/not merged/);
    expect(r.parseErrors).toEqual([]);
    expect(r.verdicts.map((v) => v.verdict)).not.toContain("PASS");
  });

  it("EA-04: backup on with no rules is a FAIL at allowBackup", async () => {
    const v = verdict(await analyzeManifest(root), "backup");
    expect(v.verdict).toBe("FAIL");
    expect(v.mastg).toContain("MASTG-TEST-0262");
    expect(v.evidence).toEqual([
      expect.objectContaining({
        file: appFile,
        line: lineOf(root, appFile, 'android:allowBackup="true"'),
      }),
    ]);
  });

  it("EA-12: the library's exported provider is a FAIL at its line", async () => {
    const v = verdict(await analyzeManifest(root), "exported-providers");
    expect(v.verdict).toBe("FAIL");
    expect(v.evidence).toHaveLength(1);
    expect(v.evidence[0]).toMatchObject({
      file: syncFile,
      line: lineOf(root, syncFile, ".ReceiptsProvider") - 1,
    });
  });

  it("EA-14 and EA-D4: the deep-link activity is listed, the launcher is not", async () => {
    const v = verdict(await analyzeManifest(root), "exported-activities");
    expect(v.verdict).toBe("MANUAL");
    expect(v.evidence).toHaveLength(1);
    expect(v.evidence[0]?.detail).toMatch(/HelpActivity.*schemes: pennyjar/);
  });

  it("EA-02 and EA-22: dangerous permissions with file:line", async () => {
    const v = verdict(await analyzeManifest(root), "dangerous-permissions");
    expect(v.verdict).toBe("MANUAL");
    for (const p of [
      "WRITE_EXTERNAL_STORAGE",
      "ACCESS_BACKGROUND_LOCATION",
      "ACCESS_FINE_LOCATION",
    ]) {
      const name = `android.permission.${p}`;
      expect(v.evidence).toContainEqual({
        file: appFile,
        line: lineOf(root, appFile, name),
        detail: name,
      });
    }
    expect(v.evidence.map((e) => e.detail)).not.toContain(
      "android.permission.INTERNET",
    );
  });

  it("EA-17: debuggable comes from the release build type without a merged manifest", async () => {
    const r = await analyzeManifest(root);
    expect(verdict(r, "debuggable")).toMatchObject({
      verdict: "FAIL",
      evidence: [
        {
          file: "app/build.gradle.kts",
          line: lineOf(root, "app/build.gradle.kts", "isDebuggable = true"),
        },
      ],
    });
    expect(r.facts.targetSdk).toMatchObject({
      file: "app/build.gradle.kts",
      value: "34",
    });
    expect(r.facts.application.requestLegacyExternalStorage?.value).toBe(
      "true",
    );
    expect(r.facts.application.networkSecurityConfig?.value).toBe(
      "@xml/network_security_config",
    );
  });
});

describe("clean twin (source manifests)", () => {
  it("raises no FAIL", async () => {
    const r = await analyzeManifest(copyFixture("example-app-clean"));
    expect(r.verdicts.filter((v) => v.verdict === "FAIL")).toEqual([]);
    expect(verdict(r, "backup").verdict).toBe("MANUAL");
    expect(verdict(r, "exported-providers").verdict).toBe("NO FINDING");
  });
});

describe("merged manifests", () => {
  const merged = (variant: string, dir = "merged_manifests") =>
    `app/build/intermediates/${dir}/${variant}/process${variant[0]?.toUpperCase() ?? ""}${variant.slice(1)}Manifest/AndroidManifest.xml`;

  it("prefers the final merged manifest of the variant and finds build-type values", async () => {
    const root = project({
      "app/build.gradle.kts": APP_GRADLE,
      "app/src/main/AndroidManifest.xml": manifest(
        "",
        'android:allowBackup="false"',
      ),
      [merged("release")]: manifest(
        '    <uses-sdk android:minSdkVersion="26" android:targetSdkVersion="34" />',
        'android:allowBackup="false"\n        android:debuggable="true"',
      ),
      [merged("release", "merged_manifest")]: manifest(
        "",
        'android:allowBackup="true"',
      ),
    });
    // Sources older than the build output: no staleness warning.
    utimesSync(path.join(root, "app/src/main/AndroidManifest.xml"), 1, 1);
    utimesSync(path.join(root, "app/build.gradle.kts"), 1, 1);
    const r = await analyzeManifest(root, "release");
    expect(r.mode).toBe("merged");
    expect(r.filesRead.map((f) => f.file)).toEqual([merged("release")]);
    expect(r.limits).toEqual([]);
    expect(verdict(r, "debuggable")).toMatchObject({
      verdict: "FAIL",
      evidence: [{ file: merged("release"), line: 6 }],
    });
    expect(verdict(r, "backup").verdict).toBe("NO FINDING");
    expect(r.facts.targetSdk?.value).toBe("34");
  });

  it("warns when a source manifest is newer than the merged one", async () => {
    const root = project({
      "app/build.gradle.kts": APP_GRADLE,
      [merged("release")]: manifest(""),
      "app/src/main/AndroidManifest.xml": manifest(""),
    });
    utimesSync(path.join(root, merged("release")), 1, 1);
    const r = await analyzeManifest(root);
    expect(r.limits.join(" ")).toMatch(/older than a source manifest/);
  });

  it("falls back to sources when only another variant was built", async () => {
    const root = project({
      "app/build.gradle.kts": APP_GRADLE,
      [merged("debug")]: manifest("", 'android:debuggable="true"'),
      "app/src/main/AndroidManifest.xml": manifest(""),
      "app/src/debug/AndroidManifest.xml": manifest(
        "",
        'android:usesCleartextTraffic="true"',
      ),
    });
    const r = await analyzeManifest(root, "release");
    expect(r.mode).toBe("source");
    expect(r.filesRead.map((f) => f.file)).toEqual([
      "app/src/main/AndroidManifest.xml",
    ]);
    expect(
      verdict(await analyzeManifest(root, "debug"), "debuggable").verdict,
    ).toBe("N/A");
  });
});

describe("manifest rules", () => {
  const one = (sdk: string, components: string, app?: string) =>
    project({
      "app/build.gradle": "apply plugin: 'com.android.application'\n",
      "app/src/main/AndroidManifest.xml": withComponents(sdk, components, app),
    });
  const filter =
    '<intent-filter><action android:name="x.y.OPEN" /></intent-filter>';

  it("implies exported from an intent filter below targetSdk 31 only", async () => {
    const comp = `<activity android:name=".A">${filter}</activity>`;
    const r30 = await analyzeManifest(
      one('<uses-sdk android:targetSdkVersion="30" />', comp),
    );
    expect(r30.facts.components[0]?.exported).toBe("yes");
    const r31 = await analyzeManifest(
      one('<uses-sdk android:targetSdkVersion="31" />', comp),
    );
    expect(r31.facts.components[0]?.exported).toBe("unknown");
    const none = await analyzeManifest(one("", comp));
    expect(none.facts.components[0]?.exported).toBe("unknown");
    expect(verdict(none, "exported-activities").verdict).toBe("MANUAL");
    const noFilter = await analyzeManifest(
      one("", '<service android:name=".S" />'),
    );
    expect(noFilter.facts.components[0]?.exported).toBe("no");
    expect(verdict(noFilter, "exported-services").verdict).toBe("NO FINDING");
  });

  it("providers default to exported at targetSdk 16", async () => {
    const r = await analyzeManifest(
      one(
        '<uses-sdk android:targetSdkVersion="16" />',
        '<provider android:name=".P" android:authorities="a" />',
      ),
    );
    expect(verdict(r, "exported-providers").verdict).toBe("FAIL");
    const protectedP = await analyzeManifest(
      one(
        "",
        '<provider android:name=".P" android:authorities="a" android:exported="true" android:permission="x.SIG" />',
      ),
    );
    expect(verdict(protectedP, "exported-providers").verdict).toBe("MANUAL");
  });

  it("lists a launcher activity that also takes a deep link", async () => {
    const r = await analyzeManifest(
      one(
        "",
        `<activity android:name=".Main" android:exported="true">
          <intent-filter><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent-filter>
          <intent-filter><action android:name="android.intent.action.VIEW" /><category android:name="android.intent.category.BROWSABLE" /><data android:scheme="app" /></intent-filter>
        </activity>`,
      ),
    );
    const v = verdict(r, "exported-activities");
    expect(v.verdict).toBe("MANUAL");
    expect(v.evidence[0]?.detail).toMatch(/\.Main.*schemes: app/);
  });

  it("skips launcher aliases and tools:node=remove, keeps other aliases and receivers", async () => {
    const launcher =
      '<intent-filter><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent-filter>';
    const r = await analyzeManifest(
      one(
        "",
        `<activity-alias android:name=".L" android:exported="true">${launcher}</activity-alias>
        <activity-alias android:name=".Share" android:exported="true">${filter}</activity-alias>
        <receiver android:name=".Gone" android:exported="true" tools:node="remove" />
        <receiver android:name=".R" android:exported="true" />
        <receiver android:name=".Safe" android:exported="true" android:permission="android.permission.DUMP" />`,
      ),
    );
    expect(
      verdict(r, "exported-activities").evidence.map((e) => e.detail),
    ).toEqual([expect.stringContaining(".Share")]);
    expect(r.facts.components.map((c) => c.name)).not.toContain(".Gone");
    expect(
      verdict(r, "exported-receivers").evidence.map((e) => e.detail),
    ).toEqual([expect.stringContaining("receiver .R;")]);
  });

  it("missing allowBackup points at <application>", async () => {
    const r = await analyzeManifest(one("", "", 'android:label="x"'));
    expect(verdict(r, "backup")).toMatchObject({
      verdict: "FAIL",
      evidence: [{ file: "app/src/main/AndroidManifest.xml", line: 5 }],
    });
  });

  it("skips test source sets", async () => {
    const root = project({
      "app/build.gradle.kts": APP_GRADLE,
      "app/src/main/AndroidManifest.xml": manifest(""),
      "app/src/androidTest/AndroidManifest.xml": manifest(
        "",
        'android:debuggable="true"',
      ),
    });
    const r = await analyzeManifest(root);
    expect(r.filesRead.map((f) => f.file)).toEqual([
      "app/src/main/AndroidManifest.xml",
    ]);
  });
});

describe("hostile and broken input", () => {
  it("malformed XML is a parse error, and no NO FINDING survives it", async () => {
    const root = project({
      "app/build.gradle.kts": APP_GRADLE,
      "app/src/main/AndroidManifest.xml": "<manifest><application></manifest>",
      "lib/src/main/AndroidManifest.xml": manifest(""),
    });
    const r = await analyzeManifest(root);
    expect(r.parseErrors).toHaveLength(1);
    expect(r.parseErrors[0]?.file).toBe("app/src/main/AndroidManifest.xml");
    expect(r.verdicts.map((v) => v.verdict)).not.toContain("NO FINDING");
  });

  it("an XXE payload is rejected and never expanded", async () => {
    const secret = path.join(temp(), "secret.txt");
    writeFileSync(secret, "TOP-SECRET-VALUE");
    const root = project({
      "app/build.gradle.kts": APP_GRADLE,
      "app/src/main/AndroidManifest.xml": `<?xml version="1.0"?>
<!DOCTYPE manifest [ <!ENTITY xxe SYSTEM "file://${secret}"> ]>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="&xxe;" />
</manifest>`,
      "b/src/main/AndroidManifest.xml": `<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="&xxe;" /></manifest>`,
    });
    const r = await analyzeManifest(root);
    expect(r.parseErrors).toHaveLength(2);
    expect(JSON.stringify(r)).not.toContain("TOP-SECRET-VALUE");
  });

  it("refuses files over 1 MB", async () => {
    const root = project({
      "app/build.gradle.kts": APP_GRADLE,
      "app/src/main/AndroidManifest.xml": manifest(
        `<!-- ${"x".repeat(1_100_000)} -->`,
      ),
    });
    const r = await analyzeManifest(root);
    expect(r.parseErrors[0]?.message).toMatch(/over 1000000 bytes/);
  });

  it("never follows symlinks out of the root", async () => {
    const outside = project({
      "src/main/AndroidManifest.xml": manifest("", 'android:debuggable="true"'),
    });
    const root = project({ "app/build.gradle.kts": APP_GRADLE });
    symlinkSync(outside, path.join(root, "linked"));
    mkdirSync(path.join(root, "app/src/main"), { recursive: true });
    symlinkSync(
      path.join(outside, "src/main/AndroidManifest.xml"),
      path.join(root, "app/src/main/AndroidManifest.xml"),
    );
    const r = await analyzeManifest(root);
    expect(r.filesRead).toEqual([]);
    expect(r.verdicts.every((v) => v.verdict === "MANUAL")).toBe(true);
  });

  it("rejects a relative or missing root", async () => {
    await expect(
      analyzeManifest("fixtures/example-app"),
    ).rejects.toBeInstanceOf(ProjectRootError);
    await expect(
      analyzeManifest(path.join(temp(), "nope")),
    ).rejects.toBeInstanceOf(ProjectRootError);
  });
});
