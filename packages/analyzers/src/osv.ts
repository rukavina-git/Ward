/**
 * OSV's Maven advisories (ADR 0011): downloaded at check time from a
 * fixed public URL, unzipped with node:zlib, cut down to what matching
 * needs and cached with the download date. Only data comes in; nothing
 * about the checked app goes out.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import type { OsvRange } from "./maven-version.js";

export const OSV_URL =
  "https://osv-vulnerabilities.storage.googleapis.com/Maven/all.zip";

export const OSV_LIMITS = {
  maxZipBytes: 64 * 1024 * 1024,
  maxEntries: 100_000,
  maxEntryBytes: 4 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
  timeoutMs: 120_000,
  maxAgeMs: 24 * 60 * 60 * 1000,
  /** OSV has about 7,000 Maven advisories; far fewer means broken data. */
  minAdvisories: 1000,
} as const;

/** Licence of each advisory source in OSV's Maven data (see docs/sources.md). */
export const OSV_SOURCES: Record<string, { name: string; licence: string }> = {
  GHSA: { name: "GitHub Advisory Database", licence: "CC BY 4.0" },
  MAL: { name: "OpenSSF Malicious Packages", licence: "Apache 2.0" },
};

export interface Advisory {
  id: string;
  aliases: string[];
  summary: string;
  /** GitHub's severity word (LOW … CRITICAL), when given. */
  severity?: string;
  modified: string;
  ranges: OsvRange[];
  /** Explicit versions, kept only when there are no ranges. */
  versions?: string[];
}

export interface OsvIndex {
  format: 1;
  url: string;
  /** When Ward downloaded the data (ISO). */
  downloadedAt: string;
  /** The server's Last-Modified header, when sent. */
  lastModified?: string;
  advisoryCount: number;
  /** `group:artifact` → advisories that affect it. */
  packages: Record<string, Advisory[]>;
}

export type OsvStatus =
  "fresh-cache" | "downloaded" | "not-modified" | "stale-cache" | "unavailable";

export interface OsvData {
  status: OsvStatus;
  index?: OsvIndex;
  /** Why a download didn't happen or failed (no app data in it). */
  problem?: string;
}

export type Fetcher = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<Response>;

export interface OsvOptions {
  cacheDir?: string;
  /** Never download; use the cache only. */
  offline?: boolean;
  fetch?: Fetcher;
  now?: () => Date;
  /** Fewer advisories than this counts as no data (tests lower it). */
  minAdvisories?: number;
}

/** `WARD_CACHE_DIR`, else `$XDG_CACHE_HOME/ward`, else `~/.cache/ward`. */
export function defaultCacheDir(): string {
  const env = process.env;
  if (env.WARD_CACHE_DIR) return env.WARD_CACHE_DIR;
  const xdg = env.XDG_CACHE_HOME;
  return path.join(xdg ? xdg : path.join(homedir(), ".cache"), "ward");
}

const cacheFile = (dir: string) => path.join(dir, "osv-maven.json");

async function readCache(dir: string): Promise<OsvIndex | undefined> {
  try {
    const parsed = JSON.parse(
      await readFile(cacheFile(dir), "utf8"),
    ) as Partial<OsvIndex>;
    if (
      parsed.format !== 1 ||
      typeof parsed.downloadedAt !== "string" ||
      typeof parsed.packages !== "object"
    ) {
      return undefined;
    }
    return parsed as OsvIndex;
  } catch {
    return undefined;
  }
}

async function writeCache(dir: string, index: OsvIndex): Promise<void> {
  await mkdir(dir, { recursive: true });
  const tmp = `${cacheFile(dir)}.${String(process.pid)}.tmp`;
  await writeFile(tmp, JSON.stringify(index));
  await rename(tmp, cacheFile(dir));
}

/** Writes the cache; a failure keeps the data and is reported. */
async function tryWriteCache(
  dir: string,
  index: OsvIndex,
): Promise<string | undefined> {
  try {
    await writeCache(dir, index);
    return undefined;
  } catch (e) {
    return `cache write failed (${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}); the data is used but will be downloaded again`;
  }
}

/**
 * The OSV Maven index: the cache if under 24 h old, else a fresh
 * download (conditional on Last-Modified), else the old cache, else none.
 */
export async function loadOsv(options: OsvOptions = {}): Promise<OsvData> {
  const data = await loadOsvData(options);
  const min = options.minAdvisories ?? OSV_LIMITS.minAdvisories;
  if (data.index && data.index.advisoryCount < min) {
    return {
      status: "unavailable",
      problem: `the OSV data has only ${String(data.index.advisoryCount)} advisories (expected at least ${String(min)}); treated as broken`,
    };
  }
  return data;
}

async function loadOsvData(options: OsvOptions): Promise<OsvData> {
  const dir = options.cacheDir ?? defaultCacheDir();
  const now = (options.now ?? (() => new Date()))();
  const cached = await readCache(dir);
  const age = cached
    ? now.getTime() - Date.parse(cached.downloadedAt)
    : Infinity;
  if (cached && age >= 0 && age < OSV_LIMITS.maxAgeMs) {
    return { status: "fresh-cache", index: cached };
  }
  const offline = options.offline ?? process.env.WARD_OSV_OFFLINE === "1";
  if (offline) {
    return cached
      ? { status: "stale-cache", index: cached, problem: "offline mode" }
      : { status: "unavailable", problem: "offline mode and no cached copy" };
  }
  try {
    const fetcher: Fetcher = options.fetch ?? fetch;
    const headers: Record<string, string> = { "user-agent": "ward" };
    if (cached?.lastModified)
      headers["if-modified-since"] = cached.lastModified;
    const res = await fetcher(OSV_URL, {
      headers,
      signal: AbortSignal.timeout(OSV_LIMITS.timeoutMs),
    });
    if (res.status === 304 && cached) {
      const index = { ...cached, downloadedAt: now.toISOString() };
      const problem = await tryWriteCache(dir, index);
      return { status: "not-modified", index, ...(problem && { problem }) };
    }
    if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
    const length = Number(res.headers.get("content-length") ?? "0");
    if (length > OSV_LIMITS.maxZipBytes) throw new Error("download too large");
    const zip = Buffer.from(await res.arrayBuffer());
    if (zip.length > OSV_LIMITS.maxZipBytes) {
      throw new Error("download too large");
    }
    const lastModified = res.headers.get("last-modified") ?? undefined;
    const index = buildIndex(unzip(zip), {
      downloadedAt: now.toISOString(),
      ...(lastModified ? { lastModified } : {}),
    });
    const problem = await tryWriteCache(dir, index);
    return { status: "downloaded", index, ...(problem && { problem }) };
  } catch (e) {
    const problem = `download failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`;
    return cached
      ? { status: "stale-cache", index: cached, problem }
      : { status: "unavailable", problem };
  }
}

/**
 * Reads a plain zip (stored or deflate entries, no ZIP64, no
 * encryption) into name → bytes. Anything else is an error.
 */
export function unzip(buf: Buffer): Map<string, Buffer> {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) {
    throw new Error("ZIP64 not supported");
  }
  if (count > OSV_LIMITS.maxEntries) throw new Error("too many zip entries");

  const out = new Map<string, Buffer>();
  let total = 0;
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error("bad zip central directory");
    }
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    if (flags & 1) throw new Error("encrypted zip entry");
    if (size > OSV_LIMITS.maxEntryBytes) throw new Error("zip entry too large");
    total += size;
    if (total > OSV_LIMITS.maxTotalBytes) throw new Error("zip too large");
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) {
      throw new Error("bad zip local header");
    }
    const start =
      local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + compSize);
    if (data.length !== compSize) throw new Error("truncated zip entry");
    let bytes: Buffer;
    if (method === 0) bytes = Buffer.from(data);
    else if (method === 8) {
      bytes = inflateRawSync(data, {
        maxOutputLength: OSV_LIMITS.maxEntryBytes,
      });
    } else throw new Error(`zip method ${String(method)} not supported`);
    if (bytes.length !== size) throw new Error("zip entry size mismatch");
    out.set(name, bytes);
  }
  return out;
}

interface RawAffected {
  package?: { ecosystem?: unknown; name?: unknown };
  ranges?: unknown;
  versions?: unknown;
}

/** Keeps the Maven part of each advisory that isn't withdrawn. */
export function buildIndex(
  files: Map<string, Buffer>,
  meta: { downloadedAt: string; lastModified?: string },
): OsvIndex {
  const packages: Record<string, Advisory[]> = {};
  let advisoryCount = 0;
  for (const [name, bytes] of files) {
    if (!name.endsWith(".json")) continue;
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (typeof doc.id !== "string" || doc.withdrawn) continue;
    const strings = (v: unknown) =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : [];
    const dbs = doc.database_specific as { severity?: unknown } | undefined;
    let counted = false;
    for (const a of (Array.isArray(doc.affected)
      ? doc.affected
      : []) as RawAffected[]) {
      if (a.package?.ecosystem !== "Maven") continue;
      const pkg = a.package.name;
      if (typeof pkg !== "string" || !pkg.includes(":")) continue;
      const ranges = (Array.isArray(a.ranges) ? a.ranges : []).filter(
        (r: unknown): r is OsvRange =>
          typeof r === "object" &&
          r !== null &&
          ((r as OsvRange).type === "ECOSYSTEM" ||
            (r as OsvRange).type === "SEMVER") &&
          Array.isArray((r as OsvRange).events),
      );
      const versions = strings(a.versions);
      if (ranges.length === 0 && versions.length === 0) continue;
      const adv: Advisory = {
        id: doc.id,
        aliases: strings(doc.aliases),
        summary:
          typeof doc.summary === "string" ? doc.summary.slice(0, 300) : "",
        ...(typeof dbs?.severity === "string" && { severity: dbs.severity }),
        modified: typeof doc.modified === "string" ? doc.modified : "",
        ranges: ranges.map((r) => ({ type: r.type, events: r.events })),
        ...(ranges.length === 0 && { versions }),
      };
      (packages[pkg.toLowerCase()] ??= []).push(adv);
      counted = true;
    }
    if (counted) advisoryCount++;
  }
  return { format: 1, url: OSV_URL, ...meta, advisoryCount, packages };
}

/** Name, licence and link of an advisory's source, from its ID prefix. */
export function advisorySource(id: string): {
  name: string;
  licence: string;
  url: string;
} {
  const prefix = id.split("-")[0] ?? "";
  const src = OSV_SOURCES[prefix] ?? { name: "OSV", licence: "see osv.dev" };
  return {
    ...src,
    url: `https://osv.dev/vulnerability/${encodeURIComponent(id)}`,
  };
}
