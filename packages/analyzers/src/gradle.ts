/**
 * Reads the facts Gradle build files decide: SDK levels and whether the
 * variant's build type is debuggable. Plain text matching, no Gradle run:
 * anything Ward can't resolve to a literal is reported as unresolved,
 * never guessed.
 */
import { lstat } from "node:fs/promises";
import path from "node:path";
import { readCapped } from "./find.js";

export interface SdkFact {
  file: string;
  line: number;
  /** The expression as written (untrusted app text). */
  raw: string;
  /** The API level, when Ward could resolve it to a number. */
  value?: number;
  /** How the value was found, or why it couldn't be. */
  basis: string;
}

export interface BuildTypeFact {
  name: string;
  file: string;
  /** Line of the build type block, or undefined when there is none. */
  line?: number;
  debuggable?: { file: string; line: number; value: boolean };
  /** `initWith(...)` copies another build type: Ward doesn't follow it. */
  initWith?: { file: string; line: number };
}

export interface ModuleBuild {
  module: string;
  buildFile: string;
  minSdk?: SdkFact;
  targetSdk?: SdkFact;
  compileSdk?: SdkFact;
  /** The same key set in more than one place (flavors, conditionals). */
  repeated: string[];
  buildType: BuildTypeFact;
}

export interface GradleFacts {
  modules: ModuleBuild[];
  /** Folders with convention plugins that may set any of these values. */
  conventionPlugins: string[];
  catalog?: string;
}

/** `prodRelease` → `release`; `staging` → `staging`. */
export function buildTypeOf(variant: string): string {
  const m = /([A-Z][a-z0-9_]*)$/.exec(variant);
  return (m?.[1] ?? variant).toLowerCase();
}

/** Reads each module's build file; `modules` are folders relative to root. */
export async function readGradle(
  root: string,
  modules: string[],
  variant: string,
): Promise<GradleFacts> {
  const conventionPlugins: string[] = [];
  for (const dir of ["buildSrc", "build-logic"]) {
    const info = await lstat(path.join(root, dir)).catch(() => undefined);
    if (info?.isDirectory()) conventionPlugins.push(dir);
  }
  const catalogFile = "gradle/libs.versions.toml";
  const catalogText = await readCapped(path.join(root, catalogFile)).catch(
    () => undefined,
  );
  const catalog = catalogText
    ? parseCatalogVersions(catalogText)
    : new Map<string, { value: string; line: number }>();

  const out: ModuleBuild[] = [];
  for (const module of modules) {
    for (const name of ["build.gradle.kts", "build.gradle"]) {
      const rel = module === "" ? name : `${module}/${name}`;
      const text = await readCapped(path.join(root, rel)).catch(
        () => undefined,
      );
      if (text === undefined) continue;
      out.push(
        readModule(
          module,
          rel,
          text,
          buildTypeOf(variant),
          catalog,
          catalogFile,
        ),
      );
      break;
    }
  }
  return {
    modules: out,
    conventionPlugins,
    ...(catalogText ? { catalog: catalogFile } : {}),
  };
}

/** `[versions]` keys, normalised so `target-sdk` matches `target.sdk`. */
export function parseCatalogVersions(
  text: string,
): Map<string, { value: string; line: number }> {
  const out = new Map<string, { value: string; line: number }>();
  let inVersions = false;
  text.split("\n").forEach((raw, i) => {
    const line = raw.replace(/#.*$/, "").trim();
    const section = /^\[([^\]]+)\]$/.exec(line);
    if (section) {
      inVersions = section[1] === "versions";
      return;
    }
    if (!inVersions) return;
    const kv = /^([A-Za-z0-9_.-]+)\s*=\s*"([^"]*)"$/.exec(line);
    if (kv?.[1] !== undefined && kv[2] !== undefined) {
      out.set(normKey(kv[1]), { value: kv[2], line: i + 1 });
    }
  });
  return out;
}

const normKey = (k: string) => k.replace(/[-_.]/g, ".").toLowerCase();

/**
 * Blanks comments, keeping every newline so line numbers stay right.
 * `//` after `:` (a URL in a string) is kept.
 */
export function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SDK_RE =
  /\b(minSdk|targetSdk|compileSdk)(?:Version)?\b(?!\s*\{)\s*(?:=\s*|\(\s*|\s+)([^\n;}]+)/g;

function readModule(
  module: string,
  file: string,
  original: string,
  buildType: string,
  catalog: Map<string, { value: string; line: number }>,
  catalogFile: string,
): ModuleBuild {
  const text = stripComments(original);
  const lineOf = lineFinder(text);
  const build: ModuleBuild = {
    module,
    buildFile: file,
    repeated: [],
    buildType: { name: buildType, file },
  };

  for (const m of text.matchAll(SDK_RE)) {
    const key = m[1] as "minSdk" | "targetSdk" | "compileSdk";
    const raw = balance((m[2] ?? "").trim()).slice(0, 200);
    const fact: SdkFact = {
      file,
      line: lineOf(m.index),
      raw,
      ...resolveSdk(raw, catalog, catalogFile),
    };
    if (build[key] === undefined) build[key] = fact;
    else if (!build.repeated.includes(key)) build.repeated.push(key);
  }
  // AGP 9 block form: `compileSdk { version = release(36) }`.
  for (const m of text.matchAll(
    /\b(minSdk|targetSdk|compileSdk)\s*\{[^}]*?\bversion\s*=\s*([^\n}]+)/g,
  )) {
    const key = m[1] as "minSdk" | "targetSdk" | "compileSdk";
    if (build[key] !== undefined) continue;
    const raw = (m[2] ?? "").trim().slice(0, 200);
    build[key] = {
      file,
      line: lineOf(m.index),
      raw,
      ...resolveSdk(raw, catalog, catalogFile),
    };
  }

  const types = block(text, /\bbuildTypes\s*\{/);
  if (types) {
    const name = buildType.replace(/[^A-Za-z0-9_]/g, "");
    const bt = block(
      text,
      new RegExp(`(?:\\b${name}\\b|\\(\\s*"${name}"\\s*\\))\\s*\\{`, "g"),
      types.start,
      types.end,
    );
    if (bt) {
      build.buildType.line = lineOf(bt.start);
      const body = text.slice(bt.start, bt.end);
      const dbg =
        /\b(?:isDebuggable|debuggable)\b\s*(?:=\s*|\(\s*|\s+)(true|false)\b/.exec(
          body,
        );
      if (dbg) {
        build.buildType.debuggable = {
          file,
          line: lineOf(bt.start + dbg.index),
          value: dbg[1] === "true",
        };
      }
      const init = /\binitWith\b/.exec(body);
      if (init) {
        build.buildType.initWith = {
          file,
          line: lineOf(bt.start + init.index),
        };
      }
    }
  }
  return build;
}

function resolveSdk(
  raw: string,
  catalog: Map<string, { value: string; line: number }>,
  catalogFile: string,
): { value?: number; basis: string } {
  const literal = /^(?:release\(\s*)?(\d{1,3})\s*\)?$/.exec(raw);
  if (literal?.[1]) return { value: Number(literal[1]), basis: "literal" };
  const ref =
    /^libs\.versions\.([A-Za-z0-9_.]+?)\.get\(\)(?:\.toInt\(\))?$/.exec(raw);
  if (ref?.[1]) {
    const hit = catalog.get(normKey(ref[1]));
    if (hit && /^\d{1,3}$/.test(hit.value)) {
      return {
        value: Number(hit.value),
        basis: `version catalog ${catalogFile}:${String(hit.line)}`,
      };
    }
    return { basis: `version catalog key not found in ${catalogFile}` };
  }
  return { basis: "not a literal; Ward doesn't evaluate Gradle code" };
}

/** The `{…}` block after the first match of `opener` in [from, to). */
export function block(
  text: string,
  opener: RegExp,
  from = 0,
  to = text.length,
): { start: number; end: number } | undefined {
  const re = new RegExp(opener.source, "g");
  re.lastIndex = from;
  const m = re.exec(text);
  if (!m || m.index >= to) return undefined;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < to; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) {
      return { start: m.index, end: i + 1 };
    }
  }
  return undefined;
}

export function lineFinder(text: string): (offset: number) => number {
  const starts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) {
    starts.push(i + 1);
  }
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((starts[mid] ?? 0) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** Drops trailing `)` left over from `targetSdk(34)` call syntax. */
function balance(raw: string): string {
  let out = raw;
  const count = (c: string) => out.split(c).length - 1;
  while (out.endsWith(")") && count(")") > count("(")) {
    out = out.slice(0, -1).trimEnd();
  }
  return out;
}
