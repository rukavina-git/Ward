import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildTypeOf,
  parseCatalogVersions,
  readGradle,
  stripComments,
} from "./gradle.js";

const temps: string[] = [];
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const d = mkdtempSync(path.join(tmpdir(), "ward-gradle-"));
  temps.push(d);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(d, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  return d;
}

const one = async (
  build: string,
  extra: Record<string, string> = {},
  variant = "release",
  name = "build.gradle.kts",
) => {
  const g = await readGradle(
    project({ [`app/${name}`]: build, ...extra }),
    ["app"],
    variant,
  );
  const m = g.modules[0];
  if (!m) throw new Error("no module");
  return { g, m };
};

describe("gradle", () => {
  it("reads Kotlin DSL literals and the release block", async () => {
    const { m } = await one(`android {
    compileSdk = 37
    compileSdkMinor = 2
    defaultConfig {
        minSdk = 26
        targetSdk = 34
    }
    buildTypes {
        debug { isDebuggable = true }
        release {
            isMinifyEnabled = true
            isDebuggable = true
        }
    }
}`);
    expect(m.compileSdk).toMatchObject({ value: 37, line: 2 });
    expect(m.minSdk).toMatchObject({ value: 26, line: 5 });
    expect(m.targetSdk).toMatchObject({ value: 34, line: 6, raw: "34" });
    expect(m.buildType).toMatchObject({
      name: "release",
      line: 10,
      debuggable: { value: true, line: 12 },
    });
  });

  it("reads Groovy, getByName and AGP 9 block forms", async () => {
    const groovy = await one(
      "android {\n  defaultConfig {\n    targetSdkVersion 33\n  }\n  buildTypes {\n    release {\n      debuggable false\n    }\n  }\n}\n",
      {},
      "release",
      "build.gradle",
    );
    expect(groovy.m.targetSdk?.value).toBe(33);
    expect(groovy.m.buildType.debuggable).toMatchObject({
      value: false,
      line: 7,
    });

    const named = await one(
      'android {\n  compileSdk { version = release(36) }\n  buildTypes {\n    getByName("release") {\n      isDebuggable = true\n    }\n  }\n}\n',
    );
    expect(named.m.compileSdk?.value).toBe(36);
    expect(named.m.buildType.debuggable?.value).toBe(true);
  });

  it("resolves version catalog references and flags the rest", async () => {
    const { m, g } = await one(
      "android {\n  defaultConfig {\n    targetSdk = libs.versions.target.sdk.get().toInt()\n    minSdk = AppConfig.MIN\n  }\n}\n",
      {
        "gradle/libs.versions.toml":
          '[versions]\n# comment\ntarget-sdk = "35"\nagp = "9.0.0"\n\n[libraries]\nx = "a:b:1"\n',
      },
    );
    expect(g.catalog).toBe("gradle/libs.versions.toml");
    expect(m.targetSdk).toMatchObject({
      value: 35,
      basis: "version catalog gradle/libs.versions.toml:3",
    });
    expect(m.minSdk?.value).toBeUndefined();
    expect(m.minSdk?.basis).toMatch(/not a literal/);
  });

  it("ignores commented-out values and notices initWith and repeats", async () => {
    const { m } = await one(
      `android {
    defaultConfig {
        // targetSdk = 21
        /* minSdk = 14 */
        targetSdk = 36
    }
    productFlavors { create("legacy") { targetSdk = 30 } }
    buildTypes {
        create("staging") { initWith(getByName("debug")) }
    }
}`,
      {},
      "prodStaging",
    );
    expect(m.targetSdk).toMatchObject({ value: 36, line: 5 });
    expect(m.minSdk).toBeUndefined();
    expect(m.repeated).toEqual(["targetSdk"]);
    expect(m.buildType).toMatchObject({
      name: "staging",
      initWith: { line: 9 },
    });
  });

  it("records isDebuggable Ward can't read for the build type", async () => {
    const cases: [string, number | undefined][] = [
      ["buildTypes {\n  release { isDebuggable = flag }\n}", 2],
      [
        'buildTypes {\n  release { }\n  getByName("release").isDebuggable = true\n}',
        3,
      ],
      [
        "buildTypes {\n  release { }\n}\nandroid.buildTypes.release.isDebuggable = true",
        4,
      ],
      ["buildTypes {\n  all {\n    isDebuggable = true\n  }\n}", 3],
      ["buildTypes {\n  configureEach { isDebuggable = x }\n}", 2],
      // Not this build type's, or a literal: read normally.
      [
        "buildTypes {\n  debug { isDebuggable = true }\n  release { isDebuggable = false }\n}",
        undefined,
      ],
      ["buildTypes {\n  all { isDebuggable = false }\n}", undefined],
    ];
    for (const [types, line] of cases) {
      const { m } = await one(`android {\n${types}\n}`);
      expect(m.buildType.debuggableUnresolved?.line, types).toBe(
        line === undefined ? undefined : line + 1,
      );
    }
  });

  it("reports convention plugin folders", async () => {
    const { g } = await one("android {}\n", {
      "build-logic/settings.gradle.kts": "",
    });
    expect(g.conventionPlugins).toEqual(["build-logic"]);
  });

  it("helpers", () => {
    expect(buildTypeOf("release")).toBe("release");
    expect(buildTypeOf("prodRelease")).toBe("release");
    expect(buildTypeOf("freeDebug")).toBe("debug");
    expect(stripComments('val u = "https://x" // c\n/* a\nb */ z')).toBe(
      'val u = "https://x" \n    \n     z',
    );
    expect([
      ...parseCatalogVersions('[versions]\nminSdk = "26"\n').entries(),
    ]).toEqual([["minsdk", { value: "26", line: 2 }]]);
  });
});
