/**
 * Finds an Android project's manifests without leaving the project root:
 * source manifests (`<module>/src/<set>/AndroidManifest.xml`) and, when a
 * build has run, Gradle's merged manifests under `build/intermediates/`.
 * Symlinks are never followed, and the walk has depth and size caps.
 */
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

export const LIMITS = {
  maxDepth: 12,
  maxDirs: 20_000,
  maxManifests: 200,
  maxFileBytes: 1_000_000,
} as const;

/** Folders that never hold an app's own manifests. */
const SKIP_DIRS = new Set([
  ".git",
  ".gradle",
  ".idea",
  ".cxx",
  ".kotlin",
  "node_modules",
]);

/** Merged-manifest folders, final stage first (AGP 8 and 9 names). */
const MERGED_DIRS = ["merged_manifests", "merged_manifest"] as const;

export type ModuleKind = "application" | "library" | "unknown";

export interface ManifestFile {
  /** Path relative to the project root, with `/` separators. */
  file: string;
  abs: string;
  /** Module folder relative to the root ("" for the root itself). */
  module: string;
  moduleKind: ModuleKind;
  kind: "source" | "merged";
  /** Source set (`main`, `debug`, a flavor) for source manifests. */
  sourceSet?: string;
  /** Build variant for merged manifests. */
  variant?: string;
  /** 0 for `merged_manifests` (final), 1 for `merged_manifest`. */
  stage?: number;
  mtimeMs: number;
}

export interface FoundManifests {
  root: string;
  manifests: ManifestFile[];
  /** Newest build file (build.gradle[.kts]) per module, for staleness. */
  buildFileMtime: Map<string, number>;
  truncated: boolean;
}

export class ProjectRootError extends Error {
  override name = "ProjectRootError";
}

export async function findManifests(
  projectRoot: string,
): Promise<FoundManifests> {
  if (!path.isAbsolute(projectRoot)) {
    throw new ProjectRootError("projectRoot must be an absolute path");
  }
  let root: string;
  try {
    root = await realpath(projectRoot);
  } catch {
    throw new ProjectRootError("projectRoot does not exist");
  }
  if (!(await stat(root)).isDirectory()) {
    throw new ProjectRootError("projectRoot is not a directory");
  }

  const manifests: ManifestFile[] = [];
  const kinds = new Map<string, ModuleKind>();
  const buildFileMtime = new Map<string, number>();
  let dirs = 0;
  let truncated = false;

  const rel = (abs: string) =>
    path.relative(root, abs).split(path.sep).join("/");

  const moduleKind = async (moduleAbs: string): Promise<ModuleKind> => {
    const key = rel(moduleAbs);
    const known = kinds.get(key);
    if (known) return known;
    let kind: ModuleKind = "unknown";
    for (const name of ["build.gradle.kts", "build.gradle"]) {
      const file = path.join(moduleAbs, name);
      const info = await lstat(file).catch(() => undefined);
      if (!info?.isFile() || info.size > LIMITS.maxFileBytes) continue;
      buildFileMtime.set(
        key,
        Math.max(buildFileMtime.get(key) ?? 0, info.mtimeMs),
      );
      const text = await readFile(file, "utf8");
      if (/com\.android\.application|android\.application\b/.test(text)) {
        kind = "application";
      } else if (/com\.android\.library|android\.library\b/.test(text)) {
        kind = "library";
      }
    }
    kinds.set(key, kind);
    return kind;
  };

  const add = (m: ManifestFile) => {
    if (manifests.length >= LIMITS.maxManifests) truncated = true;
    else manifests.push(m);
  };

  const readMerged = async (moduleAbs: string) => {
    for (const [stage, dirName] of MERGED_DIRS.entries()) {
      const base = path.join(moduleAbs, "build", "intermediates", dirName);
      for (const variant of await subdirs(base)) {
        for (const task of await subdirs(path.join(base, variant))) {
          const abs = path.join(base, variant, task, "AndroidManifest.xml");
          const info = await lstat(abs).catch(() => undefined);
          if (!info?.isFile()) continue;
          add({
            file: rel(abs),
            abs,
            module: rel(moduleAbs),
            moduleKind: await moduleKind(moduleAbs),
            kind: "merged",
            variant,
            stage,
            mtimeMs: info.mtimeMs,
          });
        }
      }
    }
  };

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > LIMITS.maxDepth || ++dirs > LIMITS.maxDirs) {
      truncated = true;
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isSymbolicLink() || !e.isDirectory()) continue;
      const abs = path.join(dir, e.name);
      if (SKIP_DIRS.has(e.name)) continue;
      if (e.name === "build") {
        await readMerged(dir);
        continue;
      }
      if (e.name === "src") {
        for (const set of await subdirs(abs)) {
          const file = path.join(abs, set, "AndroidManifest.xml");
          const info = await lstat(file).catch(() => undefined);
          if (!info?.isFile()) continue;
          add({
            file: rel(file),
            abs: file,
            module: rel(dir),
            moduleKind: await moduleKind(dir),
            kind: "source",
            sourceSet: set,
            mtimeMs: info.mtimeMs,
          });
        }
        // Code and resources live below src/; modules never do.
        continue;
      }
      await walk(abs, depth + 1);
    }
  };

  await walk(root, 0);
  manifests.sort((a, b) => a.file.localeCompare(b.file));
  return { root, manifests, buildFileMtime, truncated };
}

/** Real subfolders (no symlinks), sorted; empty if the folder is missing. */
async function subdirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isDirectory() && !e.isSymbolicLink())
    .map((e) => e.name)
    .sort();
}

/** Reads a found file as UTF-8, refusing anything over the size cap. */
export async function readCapped(abs: string): Promise<string> {
  const info = await lstat(abs);
  if (!info.isFile()) throw new Error("not a regular file");
  if (info.size > LIMITS.maxFileBytes) {
    throw new Error(`file is over ${String(LIMITS.maxFileBytes)} bytes`);
  }
  return readFile(abs, "utf8");
}
