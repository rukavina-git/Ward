import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export type AppKind = "planted" | "clean";

const locationSchema = z.object({
  file: z.string(),
  anchor: z.string().min(1),
});

const itemSchema = z.object({
  id: z.string(),
  decoy: z.boolean(),
  app: z.literal("clean").optional(),
  title: z.string(),
  category: z.enum(["security", "privacy", "play"]),
  severity: z.enum(["high", "medium"]).optional(),
  masvs: z.array(z.string()),
  maswe: z.array(z.string()),
  mastg: z.array(z.string()).optional(),
  difficulty: z.string().optional(),
  locations: z.array(locationSchema).min(1),
});

const keySchema = z.object({
  name: z.string(),
  keyVersion: z.number().int(),
  apps: z.object({ planted: z.string(), clean: z.string() }),
  items: z.array(itemSchema),
});

export type KeyItem = z.infer<typeof itemSchema>;
export type AnswerKey = z.infer<typeof keySchema>;

export function parseKey(json: unknown): AnswerKey {
  return keySchema.parse(json);
}

export function loadKey(path: string): AnswerKey {
  return parseKey(JSON.parse(readFileSync(path, "utf8")));
}

/** Issues are in the planted app. Decoys are in both, unless `app` says clean only. */
export function itemsInApp(key: AnswerKey, app: AppKind): KeyItem[] {
  return key.items.filter((item) =>
    app === "planted" ? !item.decoy || item.app !== "clean" : item.decoy,
  );
}

export interface ResolvedLocation {
  file: string;
  startLine: number;
  endLine: number;
}

export interface ResolvedItem {
  item: KeyItem;
  locations: ResolvedLocation[];
}

export class AnchorError extends Error {}

/** Lines (from 1) of the one place `anchor` occurs in `text`. Zero or several is an error. */
export function findAnchor(
  text: string,
  anchor: string,
): { startLine: number; endLine: number } {
  const first = text.indexOf(anchor);
  if (first === -1)
    throw new AnchorError(`anchor not found: ${JSON.stringify(anchor)}`);
  if (text.indexOf(anchor, first + 1) !== -1) {
    throw new AnchorError(
      `anchor occurs more than once: ${JSON.stringify(anchor)}`,
    );
  }
  const startLine = countNewlines(text.slice(0, first)) + 1;
  return { startLine, endLine: startLine + countNewlines(anchor) };
}

function countNewlines(s: string): number {
  let n = 0;
  for (const ch of s) if (ch === "\n") n++;
  return n;
}

/** Turns every anchor of the app's items into lines, reading files under `appRoot`. */
export function resolveItems(
  key: AnswerKey,
  app: AppKind,
  appRoot: string,
): ResolvedItem[] {
  const cache = new Map<string, string>();
  const read = (file: string): string => {
    let text = cache.get(file);
    if (text === undefined) {
      text = readFileSync(join(appRoot, file), "utf8");
      cache.set(file, text);
    }
    return text;
  };
  return itemsInApp(key, app).map((item) => ({
    item,
    locations: item.locations.map((loc) => {
      try {
        return { file: loc.file, ...findAnchor(read(loc.file), loc.anchor) };
      } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        throw new AnchorError(`${item.id} in ${app} app, ${loc.file}: ${why}`);
      }
    }),
  }));
}
