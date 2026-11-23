/**
 * Manifest analyzer: exact facts from an Android project's manifests, and
 * one verdict per manifest check. Plain code, no LLM. Verdicts follow
 * PRODUCT.md (FAIL, NO FINDING, NEEDS DYNAMIC, MANUAL, N/A), never PASS.
 *
 * Prefers Gradle's merged manifest for the variant (it includes library
 * manifests and build-type values such as isDebuggable). Without a build,
 * it reads the source manifests and says the result is unmerged.
 */
import { findManifests, readCapped, type ManifestFile } from "./find.js";
import { readGradle, type GradleFacts } from "./gradle.js";
import {
  DANGEROUS_PERMISSIONS,
  DANGEROUS_PERMISSIONS_DATE,
} from "./permissions.js";
import {
  androidAttr,
  childrenNamed,
  parseXml,
  XmlError,
  type XmlElement,
} from "./xml.js";

const TOOLS_NS = "http://schemas.android.com/tools";

export type Verdict =
  "FAIL" | "NO FINDING" | "NEEDS DYNAMIC" | "MANUAL" | "N/A";

export interface Location {
  file: string;
  line: number;
}

/** A raw attribute value from the app's file: untrusted data. */
export interface AttrFact extends Location {
  value: string;
}

export type ComponentType =
  "activity" | "activity-alias" | "service" | "receiver" | "provider";

export interface IntentFilterFact {
  line: number;
  actions: string[];
  categories: string[];
  schemes: string[];
  hosts: string[];
}

export interface ComponentFact extends Location {
  type: ComponentType;
  name: string;
  /** Raw `android:exported`, if written. */
  exportedAttr?: string;
  exported: "yes" | "no" | "unknown";
  /** Why `exported` has its value. */
  exportedBasis: string;
  permission?: string;
  readPermission?: string;
  writePermission?: string;
  launcher: boolean;
  intentFilters: IntentFilterFact[];
}

export interface PermissionFact extends Location {
  name: string;
  dangerous: boolean;
}

export const APP_ATTRS = [
  "debuggable",
  "allowBackup",
  "fullBackupContent",
  "dataExtractionRules",
  "usesCleartextTraffic",
  "networkSecurityConfig",
  "requestLegacyExternalStorage",
] as const;
export type AppAttr = (typeof APP_ATTRS)[number];

export interface ManifestFacts {
  minSdk?: AttrFact;
  targetSdk?: AttrFact;
  application: Partial<Record<AppAttr, AttrFact>>;
  /** Where `<application>` starts, for checks that hinge on a missing attribute. */
  applicationAt?: Location;
  permissions: PermissionFact[];
  components: ComponentFact[];
}

export type CheckId =
  | "debuggable"
  | "backup"
  | "exported-activities"
  | "exported-services"
  | "exported-receivers"
  | "exported-providers"
  | "dangerous-permissions";

export interface CheckVerdict {
  check: CheckId;
  verdict: Verdict;
  /** MASTG tests this check maps to (IDs from the pinned index). */
  mastg: string[];
  reason: string;
  evidence: (Location & { detail: string })[];
}

export interface ManifestReport {
  analyzer: "manifest";
  variant: string;
  mode: "merged" | "source";
  /** Plain-words limits of this result. */
  limits: string[];
  filesRead: {
    file: string;
    kind: "source" | "merged";
    module: string;
    sourceSet?: string;
  }[];
  parseErrors: (Location & { message: string })[];
  facts: ManifestFacts;
  /** Build-file facts for the app modules (SDK levels, build type). */
  gradle: GradleFacts;
  verdicts: CheckVerdict[];
  dangerousPermissionsListDate: string;
}

export const MASTG: Record<CheckId, string[]> = {
  debuggable: ["MASTG-TEST-0226"],
  backup: ["MASTG-TEST-0262", "MASTG-TEST-0216"],
  "exported-activities": ["MASTG-TEST-0364"],
  "exported-services": ["MASTG-TEST-0365"],
  "exported-receivers": ["MASTG-TEST-0366"],
  "exported-providers": ["MASTG-TEST-0355", "MASTG-TEST-0357"],
  "dangerous-permissions": ["MASTG-TEST-0254"],
};

const TEST_SETS = /^(test|androidTest|testFixtures)/i;

/** Analyzes the project at `projectRoot` (absolute) for one build variant. */
export async function analyzeManifest(
  projectRoot: string,
  variant = "release",
): Promise<ManifestReport> {
  const found = await findManifests(projectRoot);
  const limits: string[] = [];
  if (found.truncated) {
    limits.push(
      "The folder walk hit a size cap; some manifests may be missing.",
    );
  }

  const appModules = new Set(
    found.manifests
      .filter((m) => m.moduleKind === "application")
      .map((m) => m.module),
  );
  if (appModules.size === 0) {
    limits.push(
      "No application module found (no com.android.application plugin in a build file); all modules are treated alike.",
    );
  }
  const isApp = (m: ManifestFile) =>
    appModules.size === 0 || appModules.has(m.module);

  const merged = pickMerged(found.manifests.filter(isApp), variant);
  let files: ManifestFile[];
  let mode: "merged" | "source";
  if (merged.length > 0) {
    mode = "merged";
    files = merged;
    const newestSource = Math.max(
      0,
      ...found.manifests
        .filter((m) => m.kind === "source")
        .map((m) => m.mtimeMs),
      ...found.buildFileMtime.values(),
    );
    if (merged.some((m) => m.mtimeMs < newestSource)) {
      limits.push(
        "The merged manifest is older than a source manifest or build file: rebuild for a current result.",
      );
    }
  } else {
    mode = "source";
    files = pickSources(found.manifests, variant, appModules);
    limits.push(
      `No merged manifest for variant "${variant}" (no build output). Source manifests only: library dependencies' manifests are not merged, placeholders are not applied, and tools: merge rules are not run. isDebuggable and SDK levels come from the build files.`,
    );
  }

  const facts: ManifestFacts = {
    application: {},
    permissions: [],
    components: [],
  };
  const parseErrors: ManifestReport["parseErrors"] = [];
  const filesRead: ManifestReport["filesRead"] = [];
  for (const m of files) {
    let root: XmlElement;
    try {
      root = parseXml(await readCapped(m.abs));
    } catch (e) {
      parseErrors.push({
        file: m.file,
        line: e instanceof XmlError ? e.line : 0,
        message: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    filesRead.push({
      file: m.file,
      kind: m.kind,
      module: m.module,
      ...(m.sourceSet === undefined ? {} : { sourceSet: m.sourceSet }),
    });
    collect(root, m.file, facts);
  }
  const gradleModules =
    appModules.size > 0
      ? [...appModules]
      : [...new Set(found.manifests.map((m) => m.module))];
  const gradle = await readGradle(found.root, gradleModules.sort(), variant);
  useGradleSdk(facts, gradle, limits);
  if (gradle.conventionPlugins.length > 0) {
    limits.push(
      `Convention plugins in ${gradle.conventionPlugins.join(", ")} may set SDK levels or build types; Ward doesn't read them.`,
    );
  }
  resolveExported(facts);

  return {
    analyzer: "manifest",
    variant,
    mode,
    limits,
    filesRead,
    parseErrors,
    facts,
    gradle,
    verdicts: judge(facts, {
      mode,
      variant,
      gradle,
      read: filesRead.length,
      errors: parseErrors.length,
    }),
    dangerousPermissionsListDate: DANGEROUS_PERMISSIONS_DATE,
  };
}

/** One merged manifest per app module for the variant, final stage first. */
function pickMerged(
  manifests: ManifestFile[],
  variant: string,
): ManifestFile[] {
  const best = new Map<string, ManifestFile>();
  for (const m of manifests) {
    if (
      m.kind !== "merged" ||
      m.variant?.toLowerCase() !== variant.toLowerCase()
    )
      continue;
    const cur = best.get(m.module);
    if (!cur || (m.stage ?? 9) < (cur.stage ?? 9)) best.set(m.module, m);
  }
  return [...best.values()];
}

/**
 * Source manifests that feed the variant: `main` and every non-test set
 * except other build types' (`debug` when checking `release`, and back).
 * Libraries first, the app's `main` next, its other sets last, so later
 * files override earlier ones as Gradle's merge roughly does.
 */
function pickSources(
  manifests: ManifestFile[],
  variant: string,
  appModules: Set<string>,
): ManifestFile[] {
  const v = variant.toLowerCase();
  const other = v.includes("debug") ? "release" : "debug";
  const rank = (m: ManifestFile) =>
    appModules.has(m.module) ? (m.sourceSet === "main" ? 1 : 2) : 0;
  return manifests
    .filter((m) => m.kind === "source" && m.sourceSet !== undefined)
    .filter((m) => !TEST_SETS.test(m.sourceSet ?? ""))
    .filter((m) => !(m.sourceSet ?? "").toLowerCase().includes(other))
    .sort((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file));
}

function collect(root: XmlElement, file: string, facts: ManifestFacts): void {
  if (root.name !== "manifest") return;
  const at = (a: { value: string; line: number }): AttrFact => ({
    file,
    line: a.line,
    value: a.value,
  });

  for (const sdk of childrenNamed(root, "uses-sdk")) {
    const min = androidAttr(sdk, "minSdkVersion");
    const target = androidAttr(sdk, "targetSdkVersion");
    if (min) facts.minSdk = at(min);
    if (target) facts.targetSdk = at(target);
  }

  for (const tag of ["uses-permission", "uses-permission-sdk-23"]) {
    for (const p of childrenNamed(root, tag)) {
      const name = androidAttr(p, "name");
      if (!name || removed(p)) continue;
      const fact = {
        file,
        line: p.line,
        name: name.value,
        dangerous: DANGEROUS_PERMISSIONS.has(name.value),
      };
      const i = facts.permissions.findIndex((q) => q.name === fact.name);
      if (i === -1) facts.permissions.push(fact);
    }
  }

  for (const app of childrenNamed(root, "application")) {
    facts.applicationAt = { file, line: app.line };
    for (const key of APP_ATTRS) {
      const a = androidAttr(app, key);
      if (a) facts.application[key] = at(a);
    }
    for (const el of app.children) {
      if (!isComponent(el.name) || removed(el)) continue;
      const name = androidAttr(el, "name")?.value ?? "(no name)";
      const comp: ComponentFact = {
        type: el.name,
        name,
        file,
        line: el.line,
        exported: "unknown",
        exportedBasis: "",
        launcher: false,
        intentFilters: childrenNamed(el, "intent-filter").map(filterFact),
      };
      const exported = androidAttr(el, "exported");
      if (exported) comp.exportedAttr = exported.value;
      for (const k of [
        "permission",
        "readPermission",
        "writePermission",
      ] as const) {
        const v = androidAttr(el, k)?.value;
        if (v) comp[k] = v;
      }
      // Launcher only: every filter is MAIN/LAUNCHER with no data. A
      // launcher that also takes a deep link or other action is listed.
      comp.launcher =
        comp.intentFilters.length > 0 &&
        comp.intentFilters.every(
          (f) =>
            f.actions.length === 1 &&
            f.actions[0] === "android.intent.action.MAIN" &&
            f.categories.includes("android.intent.category.LAUNCHER") &&
            f.schemes.length === 0 &&
            f.hosts.length === 0,
        );
      const i = facts.components.findIndex(
        (c) => c.type === comp.type && c.name === comp.name,
      );
      if (i === -1) facts.components.push(comp);
      else facts.components[i] = { ...facts.components[i], ...comp };
    }
  }
}

function isComponent(name: string): name is ComponentType {
  return [
    "activity",
    "activity-alias",
    "service",
    "receiver",
    "provider",
  ].includes(name);
}

/** `tools:node="remove"` drops the element from the merged manifest. */
function removed(el: XmlElement): boolean {
  return el.attributes.some(
    (a) => a.uri === TOOLS_NS && a.local === "node" && a.value === "remove",
  );
}

function filterFact(f: XmlElement): IntentFilterFact {
  const names = (tag: string, attr: string) =>
    childrenNamed(f, tag)
      .map((c) => androidAttr(c, attr)?.value)
      .filter((v): v is string => v !== undefined);
  return {
    line: f.line,
    actions: names("action", "name"),
    categories: names("category", "name"),
    schemes: names("data", "scheme"),
    hosts: names("data", "host"),
  };
}

/** Explicit `exported` wins; otherwise Android's defaults by targetSdk. */
function resolveExported(facts: ManifestFacts): void {
  const target = sdkNumber(facts.targetSdk?.value);
  for (const c of facts.components) {
    if (c.exportedAttr === "true" || c.exportedAttr === "false") {
      c.exported = c.exportedAttr === "true" ? "yes" : "no";
      c.exportedBasis = "android:exported is set";
    } else if (c.exportedAttr !== undefined) {
      c.exported = "unknown";
      c.exportedBasis =
        "android:exported is a resource reference Ward doesn't resolve";
    } else if (c.type === "provider") {
      if (target !== undefined && target <= 16) {
        c.exported = "yes";
        c.exportedBasis =
          "providers default to exported when targetSdk is 16 or lower";
      } else {
        c.exported = "no";
        c.exportedBasis =
          target === undefined
            ? "providers default to not exported from targetSdk 17 (assumed; targetSdk not in the manifests read)"
            : "providers default to not exported from targetSdk 17";
      }
    } else if (c.intentFilters.length === 0) {
      c.exported = "no";
      c.exportedBasis = "no intent filter and no android:exported";
    } else if (target !== undefined && target < 31) {
      c.exported = "yes";
      c.exportedBasis =
        "has an intent filter, so it is exported by default below targetSdk 31";
    } else {
      c.exported = "unknown";
      c.exportedBasis =
        target === undefined
          ? "has an intent filter but no android:exported, and targetSdk is not in the manifests read"
          : "has an intent filter but no android:exported (required from targetSdk 31; the build should fail)";
    }
  }
}

function sdkNumber(v: string | undefined): number | undefined {
  if (v === undefined || !/^\d{1,3}$/.test(v)) return undefined;
  return Number(v);
}

/**
 * Fills minSdk and targetSdk from the app module's build file when no
 * manifest read sets them (the usual case without a build).
 */
function useGradleSdk(
  facts: ManifestFacts,
  gradle: GradleFacts,
  limits: string[],
): void {
  for (const key of ["minSdk", "targetSdk"] as const) {
    if (facts[key] !== undefined) continue;
    const found = gradle.modules
      .map((m) => m[key])
      .filter((f) => f !== undefined);
    const values = new Set(found.map((f) => f.value));
    const first = found[0];
    if (first?.value === undefined) {
      if (first) {
        limits.push(
          `${key} in ${first.file}:${String(first.line)} is not a number Ward can resolve (${first.basis}).`,
        );
      }
      continue;
    }
    if (values.size > 1) {
      limits.push(
        `App modules set different ${key} values; Ward uses ${first.file}'s.`,
      );
    }
    facts[key] = {
      file: first.file,
      line: first.line,
      value: String(first.value),
    };
  }
}

interface JudgeContext {
  gradle: GradleFacts;
  mode: "merged" | "source";
  variant: string;
  read: number;
  errors: number;
}

function judge(facts: ManifestFacts, ctx: JudgeContext): CheckVerdict[] {
  if (ctx.read === 0) {
    return (Object.keys(MASTG) as CheckId[]).map((check) => ({
      check,
      verdict: "MANUAL",
      mastg: MASTG[check],
      reason:
        "Ward found no readable AndroidManifest.xml for this variant under the project root.",
      evidence: [],
    }));
  }
  const verdicts: CheckVerdict[] = [];
  const v = (
    check: CheckId,
    verdict: Verdict,
    reason: string,
    evidence: CheckVerdict["evidence"] = [],
  ) => verdicts.push({ check, verdict, mastg: MASTG[check], reason, evidence });
  const app = facts.application;
  const appAt = facts.applicationAt;
  const ev = (f: AttrFact | undefined, detail: string) =>
    f ? [{ file: f.file, line: f.line, detail }] : [];

  // Debuggable.
  const dbg = app.debuggable;
  if (ctx.variant.toLowerCase().includes("debug")) {
    v(
      "debuggable",
      "N/A",
      "Debug variants are debuggable by design; check a release variant.",
    );
  } else if (dbg?.value === "true") {
    v(
      "debuggable",
      "FAIL",
      `android:debuggable is true in the ${ctx.mode} manifest.`,
      ev(dbg, 'android:debuggable="true"'),
    );
  } else if (dbg && dbg.value !== "false") {
    v(
      "debuggable",
      "MANUAL",
      "android:debuggable is a value Ward doesn't resolve.",
      ev(dbg, "android:debuggable"),
    );
  } else if (ctx.mode === "source") {
    judgeSourceDebuggable(ctx, dbg, v);
  } else {
    v(
      "debuggable",
      "NO FINDING",
      "The merged manifest does not make the app debuggable.",
      ev(dbg, 'android:debuggable="false"'),
    );
  }

  // Backup.
  const backup = app.allowBackup;
  const rules = [app.dataExtractionRules, app.fullBackupContent].filter(
    (f) => f !== undefined,
  );
  if (backup?.value === "false") {
    v(
      "backup",
      "NO FINDING",
      "android:allowBackup is false. From Android 12 this still allows device-to-device transfer unless dataExtractionRules excludes data.",
      ev(backup, 'android:allowBackup="false"'),
    );
  } else if (backup && backup.value !== "true") {
    v(
      "backup",
      "MANUAL",
      "android:allowBackup is a value Ward doesn't resolve.",
      ev(backup, "android:allowBackup"),
    );
  } else if (rules.length === 0) {
    const where = backup ?? (appAt ? { ...appAt, value: "" } : undefined);
    v(
      "backup",
      "FAIL",
      `Backup is on (${backup ? 'android:allowBackup="true"' : "allowBackup defaults to true"}) and there are no backup rules (dataExtractionRules, fullBackupContent), so every app file goes into cloud backups and device transfers.`,
      ev(
        where,
        backup
          ? 'android:allowBackup="true"'
          : "<application> without allowBackup",
      ),
    );
  } else {
    v(
      "backup",
      "MANUAL",
      "Backup is on with backup rules. Check that the rules exclude credentials, tokens and other sensitive files.",
      rules.map((f) => ({
        file: f.file,
        line: f.line,
        detail: `rules file ${f.value}`,
      })),
    );
  }

  // Exported activities, services, receivers: Ward can't judge sensitivity.
  const groups: [CheckId, ComponentType[], string][] = [
    ["exported-activities", ["activity", "activity-alias"], "activities"],
    ["exported-services", ["service"], "services"],
    ["exported-receivers", ["receiver"], "receivers"],
  ];
  for (const [check, types, label] of groups) {
    const open = facts.components.filter(
      (c) =>
        types.includes(c.type) &&
        c.exported !== "no" &&
        !c.permission &&
        !c.launcher,
    );
    if (open.length === 0) {
      v(
        check,
        "NO FINDING",
        `No exported ${label} without a permission (launcher activities aside).`,
      );
    } else {
      v(
        check,
        "MANUAL",
        `Exported ${label} without a permission. Ward lists them; check whether each one exposes sensitive functionality or trusts its intent's data.`,
        open.map((c) => ({
          file: c.file,
          line: c.line,
          detail: componentDetail(c),
        })),
      );
    }
  }

  // Exported providers.
  const providers = facts.components.filter(
    (c) => c.type === "provider" && c.exported !== "no",
  );
  const unprotected = providers.filter(
    (c) => !c.permission && !c.readPermission && !c.writePermission,
  );
  const partial = providers.filter(
    (c) =>
      !c.permission &&
      (c.readPermission === undefined) !== (c.writePermission === undefined),
  );
  if (unprotected.some((c) => c.exported === "yes")) {
    v(
      "exported-providers",
      "FAIL",
      "A content provider is exported with no permission: any installed app can query it. If it is public by design, accept it with a reason.",
      unprotected
        .filter((c) => c.exported === "yes")
        .map((c) => ({
          file: c.file,
          line: c.line,
          detail: componentDetail(c),
        })),
    );
  } else if (providers.length > 0) {
    v(
      "exported-providers",
      "MANUAL",
      partial.length > 0 || unprotected.length > 0
        ? "Exported (or possibly exported) providers with a missing or partial permission. Check each one."
        : "Exported providers are protected by permissions. Check those permissions' protection level (signature).",
      providers.map((c) => ({
        file: c.file,
        line: c.line,
        detail: componentDetail(c),
      })),
    );
  } else {
    v("exported-providers", "NO FINDING", "No exported content providers.");
  }

  // Dangerous permissions: whether each is needed is the agent's call.
  const dangerous = facts.permissions.filter((p) => p.dangerous);
  if (dangerous.length === 0) {
    v(
      "dangerous-permissions",
      "NO FINDING",
      `No dangerous (runtime) permissions requested (Ward's list from ${DANGEROUS_PERMISSIONS_DATE}).`,
    );
  } else {
    v(
      "dangerous-permissions",
      "MANUAL",
      "Dangerous (runtime) permissions requested. Check that each is needed for a feature, and that a weaker one (coarse instead of fine location, foreground instead of background) would not do.",
      dangerous.map((p) => ({ file: p.file, line: p.line, detail: p.name })),
    );
  }

  // Missing or broken input never yields NO FINDING.
  if (ctx.errors > 0) {
    const why =
      "At least one manifest could not be parsed, so the facts are incomplete.";
    for (const x of verdicts) {
      if (x.verdict === "NO FINDING") {
        x.verdict = "MANUAL";
        x.reason = `${why} ${x.reason}`;
      }
    }
  }
  return verdicts;
}

function componentDetail(c: ComponentFact): string {
  const parts = [
    `${c.type} ${c.name}`,
    `exported: ${c.exported} (${c.exportedBasis})`,
  ];
  const perms = [c.permission, c.readPermission, c.writePermission].filter(
    Boolean,
  );
  if (perms.length > 0) parts.push(`permissions: ${perms.join(", ")}`);
  const schemes = c.intentFilters.flatMap((f) => f.schemes);
  if (schemes.length > 0)
    parts.push(`deep link schemes: ${schemes.join(", ")}`);
  return parts.join("; ");
}

/**
 * Debuggable without a merged manifest: the build type decides. Only the
 * `debug` build type is debuggable by default.
 */
function judgeSourceDebuggable(
  ctx: JudgeContext,
  dbg: AttrFact | undefined,
  v: (
    check: CheckId,
    verdict: Verdict,
    reason: string,
    evidence?: CheckVerdict["evidence"],
  ) => void,
): void {
  const types = ctx.gradle.modules.map((m) => m.buildType);
  const on = types.find((t) => t.debuggable?.value === true);
  if (on?.debuggable) {
    v(
      "debuggable",
      "FAIL",
      `The ${on.name} build type sets isDebuggable to true.`,
      [
        {
          file: on.debuggable.file,
          line: on.debuggable.line,
          detail: "isDebuggable = true",
        },
      ],
    );
    return;
  }
  const copied = types.find((t) => t.initWith);
  const odd = types.find((t) => t.debuggableUnresolved);
  const unsure =
    ctx.gradle.modules.length === 0
      ? "Ward found no build file for the app module."
      : odd?.debuggableUnresolved
        ? `isDebuggable for the ${odd.name} build type is set in a way Ward can't read (${odd.debuggableUnresolved.file}:${String(odd.debuggableUnresolved.line)}: not a literal, or set from outside the build type's block).`
        : copied?.initWith
          ? `The ${copied.name} build type copies another with initWith (${copied.initWith.file}:${String(copied.initWith.line)}); Ward doesn't follow it.`
          : ctx.gradle.conventionPlugins.length > 0
            ? `Convention plugins (${ctx.gradle.conventionPlugins.join(", ")}) may set isDebuggable; Ward doesn't read them.`
            : undefined;
  if (unsure) {
    v(
      "debuggable",
      "MANUAL",
      `${unsure} Build the variant and rerun, or check by hand.`,
      odd?.debuggableUnresolved
        ? [
            {
              file: odd.debuggableUnresolved.file,
              line: odd.debuggableUnresolved.line,
              detail: `isDebuggable: ${odd.debuggableUnresolved.raw}`,
            },
          ]
        : [],
    );
    return;
  }
  const evidence = types
    .filter((t) => t.debuggable)
    .map((t) => ({
      file: t.debuggable?.file ?? t.file,
      line: t.debuggable?.line ?? 0,
      detail: "isDebuggable = false",
    }));
  if (dbg)
    evidence.push({
      file: dbg.file,
      line: dbg.line,
      detail: 'android:debuggable="false"',
    });
  v(
    "debuggable",
    "NO FINDING",
    `Neither the manifests nor the ${types[0]?.name ?? "variant's"} build type make the app debuggable (only the debug build type is by default). Read: ${ctx.gradle.modules.map((m) => m.buildFile).join(", ")}.`,
    evidence,
  );
}
