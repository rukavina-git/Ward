import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type {
  JsonValue,
  KnowledgeRecord,
  RecordKind,
  RecordLinks,
  RecordStatus,
  SourceFile,
} from "@ward/core";
import { z } from "zod";
import { normalize, splitFrontMatter } from "./frontmatter.js";
import type { PinnedSource } from "./sources.js";
import { listFiles } from "./walk.js";

/** A record plus what the graph step needs to link it. */
export interface Parsed {
  record: KnowledgeRecord;
  /** Weaknesses: the MASWE beta IDs this weakness replaces. */
  betaIds: string[];
  /** v2 tests: the weakness ID named in front matter (a beta ID). */
  namedWeakness: string | null;
}

const controlId = z.string().regex(/^MASVS-[A-Z]+-\d+$/);
const masweId = z.string().regex(/^MASWE-\d{4}$/);
const testId = z.string().regex(/^MASTG-TEST-\d{4}$/);
const demoId = z.string().regex(/^MASTG-DEMO-\d{4}$/);
const title = z.string().trim().min(1);
// Any other status fails loudly, so a new kind of record gets noticed.
const status = z.enum(["placeholder"]).optional();

const weaknessFront = z.looseObject({
  id: masweId,
  title,
  status,
  platform: z.array(z.string()),
  mappings: z.looseObject({
    "masvs-v2": z.array(controlId).min(1),
    "maswe-beta": z.array(masweId).optional(),
  }),
});
const testFront = z.looseObject({
  id: testId,
  title,
  status,
  // Two network tests (MASTG-TEST-0236, 0244) sit in the android folder.
  platform: z.enum(["android", "network"]),
  weakness: masweId,
});
// v1 tests have no id in front matter: it comes from the file name.
const legacyFront = z.looseObject({
  title,
  status: z.literal("deprecated"),
  platform: z.literal("android"),
  masvs_v2_id: z.array(controlId),
  // Not always IDs: MASTG-TEST-0046 lists "MASTG-TEST-0046-1" and "-2",
  // which exist nowhere. Only real test IDs become links (parseLegacyTests).
  covered_by: z.array(z.string()),
});
const demoFront = z.looseObject({
  id: demoId,
  title,
  status,
  platform: z.literal("android"),
  test: testId,
});

function check<T>(schema: z.ZodType<T>, data: unknown, file: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${file}: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function emptyLinks(): RecordLinks {
  return { controls: [], weaknesses: [], tests: [], demos: [], coveredBy: [] };
}

interface Draft {
  id: string;
  kind: RecordKind;
  title: string;
  status: RecordStatus;
  body: string;
  fields: Record<string, JsonValue>;
  links?: Partial<RecordLinks>;
  files?: SourceFile[];
  path: string;
}

/** Builds a record with a fixed key order, so the output bytes are stable. */
function makeRecord(d: Draft, src: PinnedSource): KnowledgeRecord {
  return {
    id: d.id,
    kind: d.kind,
    title: d.title.trim(),
    status: d.status,
    body: d.body,
    fields: d.fields,
    links: { ...emptyLinks(), ...d.links },
    files: d.files ?? [],
    source: {
      name: src.name,
      version: src.tag,
      commit: src.commit,
      path: d.path,
      url: `${src.repo}/blob/${src.tag}/${d.path}`,
      licence: src.licence,
    },
  };
}

/** Front matter minus the keys that became record fields. Keys stay sorted. */
function rest(data: Record<string, JsonValue>): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "id" && key !== "title" && key !== "status") out[key] = value;
  }
  return out;
}

function sameId(id: string, path: string): void {
  if (basename(path, ".md") !== id) {
    throw new Error(`${path}: id ${id} doesn't match the file name`);
  }
}

function read(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

/** Matching paths under `sub`, relative to the repo root. */
function find(root: string, sub: string, pattern: RegExp): string[] {
  return listFiles(join(root, sub))
    .filter((p) => pattern.test(p))
    .map((p) => `${sub}/${p}`);
}

/** MASVS controls: no front matter; "# ID", then "## Control" holds the statement. */
export function parseControls(root: string, src: PinnedSource): Parsed[] {
  return find(root, "controls", /^MASVS-[A-Z]+-\d+\.md$/).map((path) => {
    const text = normalize(read(root, path));
    const head = /^# (\S+)\n/.exec(text);
    const id = check(controlId, head?.[1], path);
    sameId(id, path);
    const body = text.slice(head?.[0].length ?? 0).trim();
    const statement = /^## Control\n+([\s\S]*?)(?=\n## |$)/m.exec(body)?.[1];
    const record = makeRecord(
      {
        id,
        kind: "control",
        title: check(title, statement?.replace(/\s+/g, " "), path),
        status: "active",
        body,
        fields: {},
        path,
      },
      src,
    );
    return { record, betaIds: [], namedWeakness: null };
  });
}

/** MASWE weaknesses that apply to Android. Links to controls come from mappings.masvs-v2. */
export function parseWeaknesses(root: string, src: PinnedSource): Parsed[] {
  const out: Parsed[] = [];
  for (const path of find(
    root,
    "weaknesses",
    /^MASVS-[A-Z]+\/MASWE-\d{4}\.md$/,
  )) {
    const { data, body } = splitFrontMatter(read(root, path), path);
    const fm = check(weaknessFront, data, path);
    if (!fm.platform.includes("android")) continue;
    sameId(fm.id, path);
    const record = makeRecord(
      {
        id: fm.id,
        kind: "weakness",
        title: fm.title,
        status: fm.status ?? "active",
        body,
        fields: rest(data),
        links: { controls: fm.mappings["masvs-v2"] },
        path,
      },
      src,
    );
    out.push({
      record,
      betaIds: fm.mappings["maswe-beta"] ?? [],
      namedWeakness: null,
    });
  }
  return out;
}

/** MASTG v2 tests for Android. Their weakness is a beta ID, translated in graph.ts. */
export function parseTests(root: string, src: PinnedSource): Parsed[] {
  const sub = "tests-beta/android";
  return find(root, sub, /^MASVS-[A-Z]+\/MASTG-TEST-\d{4}\.md$/).map((path) => {
    const { data, body } = splitFrontMatter(read(root, path), path);
    const fm = check(testFront, data, path);
    sameId(fm.id, path);
    const record = makeRecord(
      {
        id: fm.id,
        kind: "test",
        title: fm.title,
        status: fm.status ?? "active",
        body,
        fields: rest(data),
        path,
      },
      src,
    );
    return { record, betaIds: [], namedWeakness: fm.weakness };
  });
}

/** MASTG v1 tests for Android, all deprecated: kept to redirect old IDs. */
export function parseLegacyTests(root: string, src: PinnedSource): Parsed[] {
  const sub = "tests/android";
  return find(root, sub, /^MASVS-[A-Z]+\/MASTG-TEST-\d{4}\.md$/).map((path) => {
    const { data, body } = splitFrontMatter(read(root, path), path);
    const fm = check(legacyFront, data, path);
    const record = makeRecord(
      {
        id: basename(path, ".md"),
        kind: "test",
        title: fm.title,
        status: "deprecated",
        body,
        fields: rest(data),
        links: {
          controls: fm.masvs_v2_id,
          coveredBy: fm.covered_by.filter((id) => testId.safeParse(id).success),
        },
        path,
      },
      src,
    );
    return { record, betaIds: [], namedWeakness: null };
  });
}

/** Demo files kept as text: code, manifests, scripts and their output. */
const textExtensions = new Set([
  "c",
  "cpp",
  "gradle",
  "h",
  "java",
  "js",
  "json",
  "kt",
  "kts",
  "log",
  "md",
  "pro",
  "properties",
  "py",
  "r2",
  "sh",
  "smali",
  "txt",
  "xml",
  "yaml",
  "yml",
]);
/** Larger files (an SBOM, say) are generated output, not something to cite. */
const maxFileBytes = 64 * 1024;
const utf8 = new TextDecoder("utf-8", { fatal: true });

function demoFiles(root: string, dir: string, own: string): SourceFile[] {
  const files: SourceFile[] = [];
  for (const rel of listFiles(join(root, dir))) {
    const path = `${dir}/${rel}`;
    const ext = /\.([a-z0-9]+)$/.exec(rel)?.[1] ?? "";
    if (path === own || !textExtensions.has(ext)) continue;
    if (statSync(join(root, path)).size > maxFileBytes) continue;
    let text: string;
    try {
      text = utf8.decode(readFileSync(join(root, path)));
    } catch {
      continue; // not UTF-8: binary despite its extension
    }
    files.push({ path, text: normalize(text) });
  }
  return files;
}

/** MASTG demos for Android, each with the test it demonstrates and its files. */
export function parseDemos(root: string, src: PinnedSource): Parsed[] {
  const sub = "demos/android";
  const pattern = /^MASVS-[A-Z]+\/(MASTG-DEMO-\d{4})\/\1\.md$/;
  return find(root, sub, pattern).map((path) => {
    const { data, body } = splitFrontMatter(read(root, path), path);
    const fm = check(demoFront, data, path);
    sameId(fm.id, path);
    const dir = path.slice(0, path.lastIndexOf("/"));
    const record = makeRecord(
      {
        id: fm.id,
        kind: "demo",
        title: fm.title,
        status: fm.status ?? "active",
        body,
        fields: rest(data),
        links: { tests: [fm.test] },
        files: demoFiles(root, dir, path),
        path,
      },
      src,
    );
    return { record, betaIds: [], namedWeakness: null };
  });
}
