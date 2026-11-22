import type { RecordKind, RecordStatus } from "@ward/core";

export type SourceKey = "masvs" | "maswe" | "mastg";

export interface PinnedSource {
  key: SourceKey;
  name: string;
  /** Clone URL. */
  repo: string;
  /** Release tag; also the version on every record. */
  tag: string;
  /** Full SHA the tag must point at, or ingest stops. */
  commit: string;
  /** SPDX id. All three are CC BY-SA 4.0 (docs/sources.md). */
  licence: string;
}

/** Checked against GitHub on 2026-11-22; the latest release of each. */
export const pinnedSources: readonly PinnedSource[] = [
  {
    key: "masvs",
    name: "OWASP MASVS",
    repo: "https://github.com/OWASP/masvs",
    tag: "v2.1.0",
    commit: "8e133d09f4140518ed04cc254b18be9ff4990ffc",
    licence: "CC-BY-SA-4.0",
  },
  {
    key: "maswe",
    name: "OWASP MASWE",
    repo: "https://github.com/OWASP/maswe",
    tag: "v1.0.0",
    commit: "308b82b4bbe29166934fb5a621b40471cfea61db",
    licence: "CC-BY-SA-4.0",
  },
  {
    key: "mastg",
    name: "OWASP MASTG",
    repo: "https://github.com/OWASP/mastg",
    tag: "v2.0.0",
    commit: "990472dbcffe126f5556045d60270c4ffdfdde72",
    licence: "CC-BY-SA-4.0",
  },
];

export type Counts = Partial<
  Record<RecordKind, Partial<Record<RecordStatus, number>>>
>;

/**
 * What the pinned versions contain (Android only), counted by hand on
 * 2026-11-22. A different count means the parser missed or invented
 * something, or the pins changed.
 */
export const expectedCounts: Counts = {
  control: { active: 24 },
  weakness: { active: 77 },
  test: { active: 98, placeholder: 14, deprecated: 51 },
  demo: { active: 89, placeholder: 5 },
};
