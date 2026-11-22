import { createHash } from "node:crypto";
import {
  RECORDS_FORMAT,
  type LinkOverride,
  type RecordsFile,
} from "@ward/core";
import { linkRecords } from "./graph.js";
import {
  parseControls,
  parseDemos,
  parseLegacyTests,
  parseTests,
  parseWeaknesses,
} from "./parse.js";
import type { PinnedSource, SourceKey } from "./sources.js";
import { checkLinks } from "./verify.js";

/**
 * Parses the three sources (already on disk), links them and checks the
 * graph. `dirs` maps each source to its folder: the pinned clone, or test
 * fixtures laid out the same way.
 */
export function buildRecords(
  dirs: Record<SourceKey, string>,
  sources: readonly PinnedSource[],
  overrides: readonly LinkOverride[],
): { file: RecordsFile; problems: string[] } {
  const src = (key: SourceKey): PinnedSource => {
    const found = sources.find((s) => s.key === key);
    if (!found) throw new Error(`no pinned source ${key}`);
    return found;
  };
  const mastg = src("mastg");
  const parsed = [
    ...parseControls(dirs.masvs, src("masvs")),
    ...parseWeaknesses(dirs.maswe, src("maswe")),
    ...parseTests(dirs.mastg, mastg),
    ...parseLegacyTests(dirs.mastg, mastg),
    ...parseDemos(dirs.mastg, mastg),
  ];
  const { records, applied, problems } = linkRecords(parsed, overrides);
  const file: RecordsFile = {
    format: RECORDS_FORMAT,
    sources: sources.map((s) => ({
      name: s.name,
      repo: s.repo,
      version: s.tag,
      commit: s.commit,
      licence: s.licence,
    })),
    overrides: applied,
    records,
  };
  return { file, problems: [...problems, ...checkLinks(records)] };
}

/** The output bytes: no dates, no local paths, LF, fixed key order. */
export function serialize(file: RecordsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
