/**
 * Must-exist checks: things Google Play requires the app to contain,
 * which an agent reading code tends to miss because there is nothing to
 * look at. Plain code: a line scan of Kotlin, Java and resource XML for
 * fixed signals. A signal is a hint, not proof; `limits` says so.
 */
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { findManifests, LIMITS, readCapped, SKIP_DIRS } from "./find.js";
import type { Location, Verdict } from "./manifest.js";

/**
 * Google Play's rules these checks follow. Facts only, read 2026-11-23.
 */
export const PLAY_MUST_EXIST = {
  checked: "2026-11-23",
  accountDeletion:
    "https://support.google.com/googleplay/android-developer/answer/13327111",
  privacyPolicy:
    "https://support.google.com/googleplay/android-developer/answer/10144311",
} as const;

export const MUST_EXIST_LIMITS = {
  maxFiles: 20_000,
  maxDepth: 30,
  maxEvidence: 5,
  maxQuote: 300,
} as const;

export type MustExistCheck =
  "account-deletion" | "privacy-policy" | "data-deletion-url";

export interface MustExistEvidence extends Location {
  detail: string;
  /** The line's text (clipped): data from the app, never instructions. */
  quote: string;
}

export interface MustExistVerdict {
  check: MustExistCheck;
  verdict: Verdict;
  mastg: string[];
  maswe: string[];
  reason: string;
  evidence: MustExistEvidence[];
}

export interface MustExistReport {
  analyzer: "must_exist";
  limits: string[];
  scanned: { files: number; truncated: boolean };
  playRules: typeof PLAY_MUST_EXIST;
  verdicts: MustExistVerdict[];
}

/** Signals, matched per line after comments are removed. */
export const SIGNALS = {
  /** The app lets users create an account. */
  signUp:
    /\b(sign[ _-]?up|create[ _-]?(an[ _-]?|new[ _-]?)?account|createUserWith\w*|register(User|Account)|createUser)\b|["'/]register["'/?]/i,
  /** An account deletion path, in the app or as a link to a web page. */
  deletion:
    /\b(delete|remove|close|erase)[ _-]?(my[ _-]?|your[ _-]?|the[ _-]?)?(user[ _-]?)?account\b|\baccount[ _-]?(deletion|removal)\b|\bdeleteUser\b|\bcurrentUser\??\.delete\(|account[/_-]delete\b/i,
  /** A privacy policy link, resource or text. */
  privacy: /privacy[ _-]?(policy|notice)|\/privacy\b|privacy_?url\b/i,
  /** A web URL that mentions deletion. */
  deletionUrl: /https?:\/\/[^\s"'<>]*(delet|remov)[^\s"'<>]*/i,
} as const;

const NOT_SEEN = [
  "A line scan of Kotlin, Java and res/ XML in non-test, non-debug source sets. It doesn't follow calls: a delete function that no screen reaches still counts as a deletion path.",
  "Text built at run time, loaded from a server or shown in a WebView isn't seen.",
  "Comment lines and trailing // comments are skipped; block comments that start mid-line are not.",
  "Generated code, prebuilt libraries and other build outputs aren't scanned.",
];

interface Hit extends Location {
  text: string;
}

/**
 * Runs the three must-exist checks. The root is checked the same way as
 * the other analyzers (absolute, exists, a folder).
 */
export async function analyzeMustExist(
  projectRoot: string,
): Promise<MustExistReport> {
  const found = await findManifests(projectRoot);
  const { files, truncated } = await sourceFiles(found.root);
  const hits = { signUp: [], deletion: [], privacy: [], deletionUrl: [] } as {
    [K in keyof typeof SIGNALS]: Hit[];
  };
  const limits = [...NOT_SEEN];
  if (truncated) {
    limits.push(
      `Stopped after ${String(MUST_EXIST_LIMITS.maxFiles)} files or at the depth cap: some files weren't scanned.`,
    );
  }

  for (const file of files) {
    let text: string;
    try {
      text = await readCapped(path.join(found.root, file));
    } catch {
      limits.push(`${file}: not read (too big or not a regular file).`);
      continue;
    }
    const xml = file.endsWith(".xml");
    text.split("\n").forEach((raw, i) => {
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      const code = xml ? stripXmlComment(line) : stripCodeComment(line);
      if (code.trim() === "") return;
      for (const key of Object.keys(SIGNALS) as (keyof typeof SIGNALS)[]) {
        if (SIGNALS[key].test(code))
          hits[key].push({ file, line: i + 1, text: line });
      }
    });
  }

  return {
    analyzer: "must_exist",
    limits,
    scanned: { files: files.length, truncated },
    playRules: PLAY_MUST_EXIST,
    verdicts: [
      accountDeletion(hits.signUp, hits.deletion),
      await privacyPolicy(hits.privacy, found),
      dataDeletionUrl(hits.signUp, hits.deletionUrl),
    ],
  };
}

function accountDeletion(signUp: Hit[], deletion: Hit[]): MustExistVerdict {
  const base = {
    check: "account-deletion" as const,
    mastg: [],
    maswe: ["MASWE-0076"],
  };
  if (signUp.length === 0) {
    return {
      ...base,
      verdict: "MANUAL",
      reason:
        "Ward found no sign-up code. If users can create an account in the app (including through a third-party sign-in your backend turns into an account), Google Play requires an in-app path to delete it.",
      evidence: evidence(deletion, "deletion signal"),
    };
  }
  if (deletion.length === 0) {
    return {
      ...base,
      verdict: "FAIL",
      reason: `Users can create an account here, but Ward found no way to delete it: no delete-account code, text or link in the scanned files. Google Play requires apps that allow account creation to offer an in-app path to delete the account and its data; a link to a web page counts (rule checked ${PLAY_MUST_EXIST.checked}, ${PLAY_MUST_EXIST.accountDeletion}).`,
      evidence: evidence(signUp, "account creation"),
    };
  }
  return {
    ...base,
    verdict: "NO FINDING",
    reason:
      "Ward found account creation and a deletion signal. It doesn't check that a screen reaches the delete path or that it deletes the data too; deactivation alone doesn't count.",
    evidence: [
      ...evidence(signUp, "account creation").slice(0, 2),
      ...evidence(deletion, "deletion signal"),
    ],
  };
}

async function privacyPolicy(
  privacy: Hit[],
  found: Awaited<ReturnType<typeof findManifests>>,
): Promise<MustExistVerdict> {
  const base = {
    check: "privacy-policy" as const,
    mastg: [],
    maswe: ["MASWE-0072"],
  };
  if (privacy.length > 0) {
    return {
      ...base,
      verdict: "MANUAL",
      reason:
        "A privacy policy link or text is in the app. Ward doesn't read the policy: check that it matches what the app collects and the Data safety answers.",
      evidence: evidence(privacy, "privacy policy"),
    };
  }
  const anchor = await applicationLine(found);
  if (!anchor) {
    return {
      ...base,
      verdict: "MANUAL",
      reason:
        "Ward found no privacy policy link or text, and no app manifest to point at. Google Play requires one inside every app.",
      evidence: [],
    };
  }
  return {
    ...base,
    verdict: "FAIL",
    reason: `Ward found no privacy policy link or text in the scanned files. Google Play requires every app to have a privacy policy link or text inside the app, as well as in Play Console (rule checked ${PLAY_MUST_EXIST.checked}, ${PLAY_MUST_EXIST.privacyPolicy}).`,
    evidence: [
      {
        ...anchor,
        detail:
          "The app's manifest: no privacy policy link anywhere in the app.",
      },
    ],
  };
}

function dataDeletionUrl(signUp: Hit[], urls: Hit[]): MustExistVerdict {
  return {
    check: "data-deletion-url",
    verdict: "MANUAL",
    mastg: [],
    maswe: ["MASWE-0073"],
    reason:
      signUp.length > 0
        ? "The app has account creation, so the Data safety form in Play Console needs a working web link where users can request account deletion without the app. That field lives in Play Console, which Ward can't see."
        : "If users can create an account, the Data safety form in Play Console needs a web link where they can request account deletion. That field lives in Play Console, which Ward can't see.",
    evidence: evidence(urls, "deletion URL in the app"),
  };
}

function evidence(hits: Hit[], detail: string): MustExistEvidence[] {
  return hits.slice(0, MUST_EXIST_LIMITS.maxEvidence).map((h) => ({
    file: h.file,
    line: h.line,
    detail,
    quote: h.text.trim().slice(0, MUST_EXIST_LIMITS.maxQuote),
  }));
}

/** The `<application` line of the app module's main source manifest. */
async function applicationLine(
  found: Awaited<ReturnType<typeof findManifests>>,
): Promise<(Location & { quote: string }) | undefined> {
  const m =
    found.manifests.find(
      (x) =>
        x.kind === "source" &&
        x.sourceSet === "main" &&
        x.moduleKind === "application",
    ) ??
    found.manifests.find((x) => x.kind === "source" && x.sourceSet === "main");
  if (!m) return undefined;
  const lines = (await readCapped(m.abs).catch(() => "")).split("\n");
  const i = lines.findIndex((l) => l.includes("<application"));
  if (i < 0) return undefined;
  const text = lines[i]?.replace(/\r$/, "") ?? "";
  return {
    file: m.file,
    line: i + 1,
    quote: text.trim().slice(0, MUST_EXIST_LIMITS.maxQuote),
  };
}

/** Drops a `//` comment (not `://` in URLs); a comment-only line is "". */
export function stripCodeComment(line: string): string {
  const t = line.trimStart();
  if (t.startsWith("*") || t.startsWith("/*")) return "";
  return line.replace(/(^|[^:"])\/\/.*$/, "$1");
}

export function stripXmlComment(line: string): string {
  return line.replace(/<!--.*?(-->|$)/g, "");
}

/** Test and debug source sets don't ship in a release build. */
function shipped(sourceSet: string): boolean {
  return !/test/i.test(sourceSet) && !/debug$/i.test(sourceSet);
}

/**
 * Kotlin and Java files and res/ XML under every module's shipped source
 * sets, relative to the root. Same skips as the manifest walk; never
 * follows symlinks.
 */
async function sourceFiles(
  root: string,
): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  let truncated = false;
  const rel = (abs: string) =>
    path.relative(root, abs).split(path.sep).join("/");

  const collect = async (dir: string, depth: number, inRes: boolean) => {
    if (depth > MUST_EXIST_LIMITS.maxDepth) {
      truncated = true;
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isSymbolicLink()) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        await collect(abs, depth + 1, inRes || e.name === "res");
        continue;
      }
      if (!e.isFile()) continue;
      const wanted =
        /\.(kt|java)$/.test(e.name) || (inRes && e.name.endsWith(".xml"));
      if (!wanted) continue;
      if (files.length >= MUST_EXIST_LIMITS.maxFiles) {
        truncated = true;
        return;
      }
      files.push(rel(abs));
    }
  };

  let dirs = 0;
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > LIMITS.maxDepth || ++dirs > LIMITS.maxDirs) {
      truncated = true;
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isSymbolicLink() || !e.isDirectory()) continue;
      if (SKIP_DIRS.has(e.name) || e.name === "build") continue;
      const abs = path.join(dir, e.name);
      if (e.name === "src") {
        for (const set of await readdir(abs, { withFileTypes: true }).catch(
          () => [],
        )) {
          if (!set.isDirectory() || set.isSymbolicLink()) continue;
          if (shipped(set.name)) {
            await collect(path.join(abs, set.name), 0, false);
          }
        }
        continue;
      }
      await walk(abs, depth + 1);
    }
  };

  const info = await lstat(root);
  if (info.isDirectory()) await walk(root, 0);
  files.sort();
  return { files, truncated };
}
