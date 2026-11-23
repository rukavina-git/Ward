import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { analyzeBuildConfig, PLAY_TARGET } from "./build-config.js";
import {
  analyzeNetwork,
  type NetworkCheckId,
  type NetworkReport,
} from "./network.js";

// Fixtures copied without build/ (gitignored); hand-written projects in
// temp folders. Never HO-01…HO-10.

const repo = path.resolve(import.meta.dirname, "../../..");
const temps: string[] = [];
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
});

function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "ward-network-"));
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

function project(files: Record<string, string>): string {
  const d = temp();
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(d, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  return d;
}

const lineOf = (root: string, file: string, anchor: string) =>
  readFileSync(path.join(root, file), "utf8")
    .split("\n")
    .findIndex((l) => l.includes(anchor)) + 1;

const verdict = (r: NetworkReport, check: NetworkCheckId) => {
  const v = r.verdicts.find((x) => x.check === check);
  if (!v) throw new Error(`no verdict for ${check}`);
  return v;
};

const gradle = (target: string) =>
  `plugins { id("com.android.application") }\nandroid {\n  defaultConfig {\n    minSdk = 26\n    targetSdk = ${target}\n  }\n}\n`;
const manifest = (app: string) =>
  `<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n  <application android:allowBackup="false" ${app}>\n  </application>\n</manifest>\n`;
const NSC_REF = 'android:networkSecurityConfig="@xml/nsc"';
const nscProject = (
  nsc: string,
  target = "36",
  extra: Record<string, string> = {},
) =>
  project({
    "app/build.gradle.kts": gradle(target),
    "app/src/main/AndroidManifest.xml": manifest(NSC_REF),
    "app/src/main/res/xml/nsc.xml": `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n${nsc}\n</network-security-config>\n`,
    ...extra,
  });

describe("example app", () => {
  const root = copyFixture("example-app");
  const nscFile = "app/src/main/res/xml/network_security_config.xml";

  it("EA-10: base-config cleartext is a FAIL at its line; EA-D3's debug config is not read", async () => {
    const r = await analyzeNetwork(root);
    expect(r.nscFile).toBe(nscFile);
    expect(r.nscCandidates).toEqual([nscFile]);
    expect(verdict(r, "cleartext")).toMatchObject({
      verdict: "FAIL",
      evidence: [
        {
          file: nscFile,
          line: lineOf(root, nscFile, 'cleartextTrafficPermitted="true"'),
        },
      ],
    });
    expect(JSON.stringify(r)).not.toContain("10.0.2.2");
  });

  it("EA-18: targetSdk 34 fails Play's rule, at the build file line", async () => {
    const r = await analyzeBuildConfig(root);
    expect(r.verdicts[0]).toMatchObject({
      verdict: "FAIL",
      maswe: ["MASWE-0042"],
      evidence: [
        {
          file: "app/build.gradle.kts",
          line: lineOf(root, "app/build.gradle.kts", "targetSdk = 34"),
        },
      ],
    });
    expect(r.playRule.minTarget).toBe(36);
  });

  it("the debug variant reads the debug NSC override", async () => {
    const r = await analyzeNetwork(root, "debug");
    expect(r.nscFile).toBe("app/src/debug/res/xml/network_security_config.xml");
    expect(verdict(r, "cleartext").verdict).toBe("MANUAL");
  });
});

describe("clean twin", () => {
  it("raises none of EA-10, EA-17, EA-18", async () => {
    const root = copyFixture("example-app-clean");
    const net = await analyzeNetwork(root);
    const build = await analyzeBuildConfig(root);
    expect(
      [...net.verdicts, ...build.verdicts].filter((v) => v.verdict === "FAIL"),
    ).toEqual([]);
    expect(verdict(net, "cleartext").verdict).toBe("NO FINDING");
    expect(build.verdicts[0]?.verdict).toBe("NO FINDING");
  });
});

describe("network security config rules", () => {
  it("domain cleartext exceptions are MANUAL and list the domains", async () => {
    const r = await analyzeNetwork(
      nscProject(
        '<base-config cleartextTrafficPermitted="false" />\n<domain-config cleartextTrafficPermitted="true"><domain>legacy.example.com</domain></domain-config>',
      ),
    );
    expect(verdict(r, "cleartext")).toMatchObject({
      verdict: "MANUAL",
      evidence: [{ detail: "cleartext permitted: legacy.example.com" }],
    });
  });

  it("nested domain-configs inherit cleartext", async () => {
    const r = await analyzeNetwork(
      nscProject(
        '<domain-config cleartextTrafficPermitted="true"><domain>a.example</domain><domain-config><domain>b.a.example</domain></domain-config></domain-config>',
      ),
    );
    expect(r.configs.map((c) => [c.domains[0]?.name, c.cleartext])).toEqual([
      ["a.example", true],
      ["b.a.example", true],
    ]);
  });

  it("no base-config: the targetSdk default decides", async () => {
    const old = await analyzeNetwork(
      nscProject(
        "<domain-config><domain>x.example</domain></domain-config>",
        "27",
      ),
    );
    expect(verdict(old, "cleartext").verdict).toBe("FAIL");
    const modern = await analyzeNetwork(
      nscProject(
        "<domain-config><domain>x.example</domain></domain-config>",
        "28",
      ),
    );
    expect(verdict(modern, "cleartext").verdict).toBe("NO FINDING");
  });

  it("user CAs: FAIL in base-config, fine in debug-overrides only", async () => {
    const bad = await analyzeNetwork(
      nscProject(
        '<base-config><trust-anchors><certificates src="system" /><certificates src="user" /></trust-anchors></base-config>',
      ),
    );
    expect(verdict(bad, "user-ca")).toMatchObject({
      verdict: "FAIL",
      evidence: [{ line: 3 }],
    });
    const debugOnly = await analyzeNetwork(
      nscProject(
        '<debug-overrides><trust-anchors><certificates src="user" /></trust-anchors></debug-overrides>',
      ),
    );
    expect(verdict(debugOnly, "user-ca").verdict).toBe("NO FINDING");
    expect(verdict(debugOnly, "user-ca").reason).toMatch(/debug-overrides/);
  });

  it("targetSdk below 24 trusts user CAs without an NSC", async () => {
    const r = await analyzeNetwork(
      project({
        "app/build.gradle":
          "apply plugin: 'com.android.application'\nandroid { defaultConfig { targetSdkVersion 23 } }\n",
        "app/src/main/AndroidManifest.xml": manifest(""),
      }),
    );
    expect(verdict(r, "user-ca").verdict).toBe("FAIL");
    expect(verdict(r, "cleartext").verdict).toBe("FAIL");
  });

  it("pins: expired is FAIL, current is NO FINDING, none is MANUAL and N/A", async () => {
    const pins = (exp: string) =>
      `<domain-config><domain>api.example.com</domain><pin-set expiration="${exp}"><pin digest="SHA-256">AAAA</pin></pin-set></domain-config>`;
    const today = "2026-11-23";
    const expired = await analyzeNetwork(
      nscProject(pins("2025-01-01")),
      "release",
      { today },
    );
    expect(verdict(expired, "expired-pins").verdict).toBe("FAIL");
    expect(verdict(expired, "pinning").verdict).toBe("NO FINDING");
    const current = await analyzeNetwork(
      nscProject(pins("2027-01-01")),
      "release",
      { today },
    );
    expect(verdict(current, "expired-pins").verdict).toBe("NO FINDING");
    const none = await analyzeNetwork(
      nscProject('<base-config cleartextTrafficPermitted="false" />'),
    );
    expect(verdict(none, "pinning").verdict).toBe("MANUAL");
    expect(verdict(none, "expired-pins").verdict).toBe("N/A");
  });

  it("a referenced but missing or broken NSC makes every check MANUAL", async () => {
    const missing = await analyzeNetwork(
      project({
        "app/build.gradle.kts": gradle("36"),
        "app/src/main/AndroidManifest.xml": manifest(NSC_REF),
      }),
    );
    expect(missing.verdicts.every((v) => v.verdict === "MANUAL")).toBe(true);
    const broken = await analyzeNetwork(nscProject("<base-config>"));
    expect(broken.parseErrors).toHaveLength(1);
    expect(broken.verdicts.every((v) => v.verdict === "MANUAL")).toBe(true);
  });

  it("usesCleartextTraffic without an NSC", async () => {
    const r = await analyzeNetwork(
      project({
        "app/build.gradle.kts": gradle("36"),
        "app/src/main/AndroidManifest.xml": manifest(
          'android:usesCleartextTraffic="true"',
        ),
      }),
    );
    expect(verdict(r, "cleartext").verdict).toBe("FAIL");
  });

  it("the app's main NSC wins over a library's", async () => {
    const r = await analyzeNetwork(
      nscProject('<base-config cleartextTrafficPermitted="false" />', "36", {
        "lib/build.gradle.kts": 'plugins { id("com.android.library") }\n',
        "lib/src/main/AndroidManifest.xml": "<manifest />\n",
        "lib/src/main/res/xml/nsc.xml":
          '<network-security-config><base-config cleartextTrafficPermitted="true" /></network-security-config>',
      }),
    );
    expect(r.nscFile).toBe("app/src/main/res/xml/nsc.xml");
    expect(verdict(r, "cleartext").verdict).toBe("NO FINDING");
  });
});

describe("build config rules", () => {
  it("unresolved targetSdk is MANUAL", async () => {
    const r = await analyzeBuildConfig(
      project({
        "app/build.gradle.kts": gradle("AppConfig.TARGET"),
        "app/src/main/AndroidManifest.xml": manifest(""),
      }),
    );
    expect(r.verdicts[0]?.verdict).toBe("MANUAL");
    expect(r.limits.join(" ")).toMatch(/targetSdk .* not a number/);
  });

  it(`targetSdk ${String(PLAY_TARGET.minTarget)} meets the rule`, async () => {
    const r = await analyzeBuildConfig(
      project({
        "app/build.gradle.kts": gradle("36"),
        "app/src/main/AndroidManifest.xml": manifest(""),
      }),
    );
    expect(r.verdicts[0]?.verdict).toBe("NO FINDING");
  });
});
