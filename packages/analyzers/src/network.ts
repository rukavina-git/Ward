/**
 * Network analyzer: the app's network security config (NSC), read with
 * the manifest's usesCleartextTraffic and the SDK levels, gives exact
 * verdicts on cleartext, user-installed CAs and pinning. Plain code.
 */
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { readCapped } from "./find.js";
import {
  analyzeManifest,
  type AttrFact,
  type Location,
  type ManifestReport,
  type Verdict,
} from "./manifest.js";
import { childrenNamed, parseXml, XmlError, type XmlElement } from "./xml.js";

export type NetworkCheckId =
  "cleartext" | "user-ca" | "pinning" | "expired-pins";

export const NETWORK_MASTG: Record<NetworkCheckId, string[]> = {
  cleartext: ["MASTG-TEST-0235"],
  "user-ca": ["MASTG-TEST-0286", "MASTG-TEST-0285"],
  pinning: ["MASTG-TEST-0242"],
  "expired-pins": ["MASTG-TEST-0243"],
};

export interface NetworkVerdict {
  check: NetworkCheckId;
  verdict: Verdict;
  mastg: string[];
  reason: string;
  evidence: (Location & { detail: string })[];
}

export interface DomainFact extends Location {
  name: string;
  includeSubdomains: boolean;
}

export interface PinSetFact extends Location {
  expiration?: string;
  pins: number;
}

/** One base-config, domain-config or debug-overrides element. */
export interface NscConfig extends Location {
  kind: "base-config" | "domain-config" | "debug-overrides";
  /** As written; undefined means inherited or the platform default. */
  cleartextTrafficPermitted?: string;
  /** Effective value after inheritance and defaults. */
  cleartext: boolean | "unknown";
  /** `src` of each `<certificates>`; undefined when not written. */
  trustAnchors?: { src: string; line: number }[];
  domains: DomainFact[];
  pinSet?: PinSetFact;
}

export interface NetworkReport {
  analyzer: "network";
  variant: string;
  limits: string[];
  /** The manifest attributes this analyzer used. */
  manifest: {
    usesCleartextTraffic?: AttrFact;
    networkSecurityConfig?: AttrFact;
    minSdk?: AttrFact;
    targetSdk?: AttrFact;
  };
  /** The NSC file Ward read, and other candidates it saw. */
  nscFile?: string;
  nscCandidates: string[];
  parseErrors: (Location & { message: string })[];
  configs: NscConfig[];
  verdicts: NetworkVerdict[];
}

const TEST_SETS = /^(test|androidTest|testFixtures)/i;

export async function analyzeNetwork(
  projectRoot: string,
  variant = "release",
  options: { today?: string; manifest?: ManifestReport } = {},
): Promise<NetworkReport> {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const m = options.manifest ?? (await analyzeManifest(projectRoot, variant));
  const root = path.resolve(projectRoot);
  const app = m.facts.application;
  const report: NetworkReport = {
    analyzer: "network",
    variant,
    limits: [...m.limits],
    manifest: {
      ...(app.usesCleartextTraffic && {
        usesCleartextTraffic: app.usesCleartextTraffic,
      }),
      ...(app.networkSecurityConfig && {
        networkSecurityConfig: app.networkSecurityConfig,
      }),
      ...(m.facts.minSdk && { minSdk: m.facts.minSdk }),
      ...(m.facts.targetSdk && { targetSdk: m.facts.targetSdk }),
    },
    nscCandidates: [],
    parseErrors: [...m.parseErrors],
    configs: [],
    verdicts: [],
  };
  const target = sdk(m.facts.targetSdk);

  const ref = app.networkSecurityConfig;
  if (ref) {
    const name = /^@xml\/([A-Za-z0-9_]+)$/.exec(ref.value)?.[1];
    if (!name) {
      report.limits.push(
        "networkSecurityConfig is not an @xml/ reference Ward can resolve.",
      );
    } else {
      const modules = [
        ...new Set([
          ...m.filesRead.map((f) => f.module),
          ...m.gradle.modules.map((g) => g.module),
        ]),
      ];
      const appModules = new Set(m.gradle.modules.map((g) => g.module));
      report.nscCandidates = await findXml(
        root,
        modules,
        appModules,
        variant,
        name,
      );
      const chosen = report.nscCandidates[0];
      if (chosen) {
        report.nscFile = chosen;
        try {
          const doc = parseXml(await readCapped(path.join(root, chosen)));
          report.configs = readNsc(doc, chosen, target);
        } catch (e) {
          report.parseErrors.push({
            file: chosen,
            line: e instanceof XmlError ? e.line : 0,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  }
  report.verdicts = judge(
    report,
    target,
    sdk(m.facts.minSdk),
    today,
    m.filesRead.length,
  );
  return report;
}

function sdk(f: AttrFact | undefined): number | undefined {
  return f && /^\d{1,3}$/.test(f.value) ? Number(f.value) : undefined;
}

/**
 * `<module>/src/<set>/res/xml*\/<name>.xml` for the sets that feed the
 * variant, best first: the app's variant sets, the app's main, libraries.
 */
async function findXml(
  root: string,
  modules: string[],
  appModules: Set<string>,
  variant: string,
  name: string,
): Promise<string[]> {
  const other = variant.toLowerCase().includes("debug") ? "release" : "debug";
  const hits: { file: string; rank: number }[] = [];
  for (const module of modules) {
    const src = path.join(root, module, "src");
    for (const set of await dirs(src)) {
      if (TEST_SETS.test(set) || set.toLowerCase().includes(other)) continue;
      const res = path.join(src, set, "res");
      for (const xmlDir of (await dirs(res)).filter((d) =>
        /^xml(-|$)/.test(d),
      )) {
        const abs = path.join(res, xmlDir, `${name}.xml`);
        const info = await lstat(abs).catch(() => undefined);
        if (!info?.isFile()) continue;
        const isApp = appModules.size === 0 || appModules.has(module);
        const rank =
          (isApp ? 0 : 4) +
          (set === "main" ? 1 : 0) +
          (xmlDir === "xml" ? 0 : 2);
        hits.push({
          file: path.relative(root, abs).split(path.sep).join("/"),
          rank,
        });
      }
    }
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.file.localeCompare(b.file))
    .map((h) => h.file);
}

async function dirs(dir: string): Promise<string[]> {
  const info = await lstat(dir).catch(() => undefined);
  if (!info?.isDirectory()) return [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isDirectory() && !e.isSymbolicLink())
    .map((e) => e.name)
    .sort();
}

function readNsc(
  doc: XmlElement,
  file: string,
  target: number | undefined,
): NscConfig[] {
  if (doc.name !== "network-security-config") {
    throw new XmlError(
      "root element is not <network-security-config>",
      doc.line,
    );
  }
  const platformCleartext: boolean | "unknown" =
    target === undefined ? "unknown" : target < 28;
  const configs: NscConfig[] = [];
  const attr = (el: XmlElement, n: string) =>
    el.attributes.find((a) => a.uri === "" && a.local === n)?.value;

  const base = childrenNamed(doc, "base-config")[0];
  const baseClear = base ? attr(base, "cleartextTrafficPermitted") : undefined;
  const baseEffective =
    baseClear === undefined ? platformCleartext : baseClear === "true";
  if (base) configs.push(config(base, "base-config", baseEffective));

  const walk = (el: XmlElement, inherited: boolean | "unknown") => {
    const own = attr(el, "cleartextTrafficPermitted");
    const effective = own === undefined ? inherited : own === "true";
    configs.push(config(el, "domain-config", effective));
    for (const child of childrenNamed(el, "domain-config"))
      walk(child, effective);
  };
  for (const dc of childrenNamed(doc, "domain-config")) walk(dc, baseEffective);
  for (const d of childrenNamed(doc, "debug-overrides")) {
    configs.push(config(d, "debug-overrides", baseEffective));
  }
  return configs;

  function config(
    el: XmlElement,
    kind: NscConfig["kind"],
    cleartext: boolean | "unknown",
  ): NscConfig {
    const c: NscConfig = {
      kind,
      file,
      line: el.line,
      cleartext,
      domains: childrenNamed(el, "domain").map((d) => ({
        file,
        line: d.line,
        name: text(d).slice(0, 253),
        includeSubdomains: attr(d, "includeSubdomains") === "true",
      })),
    };
    const clear = attr(el, "cleartextTrafficPermitted");
    if (clear !== undefined) c.cleartextTrafficPermitted = clear;
    const anchors = childrenNamed(el, "trust-anchors")[0];
    if (anchors) {
      c.trustAnchors = childrenNamed(anchors, "certificates").map((cert) => ({
        src: (attr(cert, "src") ?? "").slice(0, 200),
        line: cert.line,
      }));
    }
    const pins = childrenNamed(el, "pin-set")[0];
    if (pins) {
      const exp = attr(pins, "expiration");
      c.pinSet = {
        file,
        line: pins.line,
        pins: childrenNamed(pins, "pin").length,
        ...(exp === undefined ? {} : { expiration: exp.slice(0, 40) }),
      };
    }
    return c;
  }
}

function text(el: XmlElement): string {
  return el.text.trim();
}

function judge(
  r: NetworkReport,
  target: number | undefined,
  minSdk: number | undefined,
  today: string,
  manifestsRead: number,
): NetworkVerdict[] {
  const out: NetworkVerdict[] = [];
  const v = (
    check: NetworkCheckId,
    verdict: Verdict,
    reason: string,
    evidence: NetworkVerdict["evidence"] = [],
  ) =>
    out.push({ check, verdict, mastg: NETWORK_MASTG[check], reason, evidence });
  const at = (l: Location, detail: string) => ({
    file: l.file,
    line: l.line,
    detail,
  });

  if (manifestsRead === 0) {
    for (const check of Object.keys(NETWORK_MASTG) as NetworkCheckId[]) {
      v(
        check,
        "MANUAL",
        "Ward found no readable AndroidManifest.xml for this variant.",
      );
    }
    return out;
  }
  const ref = r.manifest.networkSecurityConfig;
  const clearAttr = r.manifest.usesCleartextTraffic;
  const nscBroken =
    ref !== undefined &&
    (r.nscFile === undefined ||
      (r.configs.length === 0 &&
        r.parseErrors.some((e) => e.file === r.nscFile)));
  if (nscBroken) {
    const why = r.nscFile
      ? `The network security config ${r.nscFile} could not be parsed.`
      : `The manifest names a network security config (${ref.value}) that Ward couldn't find in the variant's source sets.`;
    for (const check of Object.keys(NETWORK_MASTG) as NetworkCheckId[]) {
      v(check, "MANUAL", why, [at(ref, `networkSecurityConfig ${ref.value}`)]);
    }
    return out;
  }
  const real = r.configs.filter((c) => c.kind !== "debug-overrides");
  const base = real.find((c) => c.kind === "base-config");

  // Cleartext.
  if (ref) {
    const baseClear =
      base?.cleartext ?? (target === undefined ? "unknown" : target < 28);
    const open = real.filter(
      (c) => c.kind === "domain-config" && c.cleartext === true,
    );
    const oldDevices =
      clearAttr?.value === "true" && (minSdk === undefined || minSdk < 24);
    if (baseClear === true) {
      v(
        "cleartext",
        "FAIL",
        base?.cleartextTrafficPermitted === "true"
          ? "The network security config's base-config permits cleartext traffic for every domain."
          : `No base-config cleartext setting, and targetSdk ${String(target)} allows cleartext by default (below 28).`,
        [
          at(
            base ?? ref,
            base
              ? 'base-config cleartextTrafficPermitted="true"'
              : "no base-config",
          ),
        ],
      );
    } else if (oldDevices) {
      v(
        "cleartext",
        "FAIL",
        "android:usesCleartextTraffic is true, and devices below Android 7 (API 24) ignore the network security config.",
        [at(clearAttr, 'android:usesCleartextTraffic="true"')],
      );
    } else if (baseClear === "unknown") {
      v(
        "cleartext",
        "MANUAL",
        "The base cleartext default depends on targetSdk, which Ward couldn't resolve.",
        [at(ref, `networkSecurityConfig ${ref.value}`)],
      );
    } else if (open.length > 0) {
      v(
        "cleartext",
        "MANUAL",
        "Cleartext is blocked by default but permitted for some domains. Check that nothing sensitive goes to them.",
        open.flatMap((c) =>
          (c.domains.length > 0 ? c.domains : [c]).map((d) =>
            at(
              d,
              "name" in d
                ? `cleartext permitted: ${d.name}`
                : "domain-config with cleartext",
            ),
          ),
        ),
      );
    } else {
      v(
        "cleartext",
        "NO FINDING",
        `The network security config (${r.nscFile ?? ""}) permits no cleartext traffic.`,
        base
          ? [
              at(
                base,
                `base-config cleartextTrafficPermitted=${base.cleartextTrafficPermitted ?? "(default)"}`,
              ),
            ]
          : [],
      );
    }
  } else if (clearAttr?.value === "true") {
    v(
      "cleartext",
      "FAIL",
      "android:usesCleartextTraffic is true and no network security config limits it.",
      [at(clearAttr, 'android:usesCleartextTraffic="true"')],
    );
  } else if (clearAttr && clearAttr.value !== "false") {
    v(
      "cleartext",
      "MANUAL",
      "android:usesCleartextTraffic is a value Ward doesn't resolve.",
      [at(clearAttr, "android:usesCleartextTraffic")],
    );
  } else if (clearAttr?.value === "false") {
    v(
      "cleartext",
      "NO FINDING",
      "android:usesCleartextTraffic is false and no network security config is set.",
      [at(clearAttr, 'android:usesCleartextTraffic="false"')],
    );
  } else if (target === undefined) {
    v(
      "cleartext",
      "MANUAL",
      "No usesCleartextTraffic and no network security config; the default depends on targetSdk, which Ward couldn't resolve.",
    );
  } else if (target < 28) {
    v(
      "cleartext",
      "FAIL",
      `targetSdk is ${String(target)}: cleartext traffic is allowed by default below 28.`,
      r.manifest.targetSdk
        ? [at(r.manifest.targetSdk, `targetSdk ${String(target)}`)]
        : [],
    );
  } else {
    v(
      "cleartext",
      "NO FINDING",
      `targetSdk is ${String(target)}: cleartext is blocked by default, and nothing enables it.`,
      r.manifest.targetSdk
        ? [at(r.manifest.targetSdk, `targetSdk ${String(target)}`)]
        : [],
    );
  }

  // User-installed CAs.
  const userAnchors = real.flatMap((c) =>
    (c.trustAnchors ?? [])
      .filter((a) => a.src === "user")
      .map((a) => ({
        file: c.file,
        line: a.line,
        detail: `${c.kind} trusts user-installed CAs`,
      })),
  );
  const debugOnly = r.configs
    .filter((c) => c.kind === "debug-overrides")
    .some((c) => (c.trustAnchors ?? []).some((a) => a.src === "user"));
  const baseAnchorsSet = base?.trustAnchors !== undefined;
  if (userAnchors.length > 0) {
    v(
      "user-ca",
      "FAIL",
      "The network security config trusts user-installed CAs outside debug-overrides, so anyone who can install a certificate on the device can read the app's TLS traffic.",
      userAnchors,
    );
  } else if (target === undefined && !baseAnchorsSet) {
    v(
      "user-ca",
      "MANUAL",
      "Whether user-installed CAs are trusted by default depends on targetSdk (trusted below 24), which Ward couldn't resolve.",
    );
  } else if (target !== undefined && target < 24 && !baseAnchorsSet) {
    v(
      "user-ca",
      "FAIL",
      `targetSdk is ${String(target)}: below 24, apps trust user-installed CAs by default.`,
      r.manifest.targetSdk
        ? [at(r.manifest.targetSdk, `targetSdk ${String(target)}`)]
        : [],
    );
  } else {
    v(
      "user-ca",
      "NO FINDING",
      debugOnly
        ? "User-installed CAs are trusted only in debug-overrides, which apply only to debuggable builds."
        : "No configuration trusts user-installed CAs.",
      base?.trustAnchors
        ? [
            at(
              base,
              `base-config trust anchors: ${base.trustAnchors.map((a) => a.src).join(", ")}`,
            ),
          ]
        : [],
    );
  }

  // Pinning.
  const pinned = real.filter((c) => c.pinSet);
  if (pinned.length > 0) {
    v(
      "pinning",
      "NO FINDING",
      "The network security config pins certificates for some domains. Check the pinned domains cover the app's own backends.",
      pinned.map((c) =>
        at(
          c.pinSet ?? c,
          `pin-set for ${c.domains.map((d) => d.name).join(", ")}`,
        ),
      ),
    );
  } else {
    v(
      "pinning",
      "MANUAL",
      "No pin-set in a network security config. Pinning may be done in code (OkHttp CertificatePinner, a custom TrustManager), which Ward doesn't read. MASVS L2 expects pinning; L1 doesn't.",
      ref ? [at(ref, `networkSecurityConfig ${ref.value}`)] : [],
    );
  }

  // Expired pins.
  if (pinned.length === 0) {
    v("expired-pins", "N/A", "No pin-sets.");
  } else {
    const expired = pinned.filter(
      (c) => c.pinSet?.expiration !== undefined && c.pinSet.expiration < today,
    );
    const odd = pinned.filter(
      (c) =>
        c.pinSet?.expiration !== undefined &&
        !/^\d{4}-\d{2}-\d{2}$/.test(c.pinSet.expiration),
    );
    if (expired.length > 0 && odd.length === 0) {
      v(
        "expired-pins",
        "FAIL",
        `A pin-set expired before ${today}: after its expiration date Android stops enforcing those pins.`,
        expired.map((c) =>
          at(c.pinSet ?? c, `expiration ${c.pinSet?.expiration ?? ""}`),
        ),
      );
    } else if (odd.length > 0) {
      v(
        "expired-pins",
        "MANUAL",
        "A pin-set expiration is not a yyyy-MM-dd date.",
        odd.map((c) => at(c.pinSet ?? c, "expiration")),
      );
    } else {
      v(
        "expired-pins",
        "NO FINDING",
        `No pin-set has expired as of ${today}.`,
        pinned.map((c) =>
          at(c.pinSet ?? c, `expiration ${c.pinSet?.expiration ?? "none"}`),
        ),
      );
    }
  }

  if (r.parseErrors.length > 0) {
    for (const x of out) {
      if (x.verdict === "NO FINDING") {
        x.verdict = "MANUAL";
        x.reason = `At least one file could not be parsed, so the facts are incomplete. ${x.reason}`;
      }
    }
  }
  return out;
}
