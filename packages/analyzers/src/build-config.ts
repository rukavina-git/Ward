/**
 * Build config analyzer: SDK levels and the build type from Gradle (via
 * the manifest analyzer, which prefers the merged manifest's values),
 * and one verdict on Google Play's target API requirement.
 */
import type { GradleFacts } from "./gradle.js";
import {
  analyzeManifest,
  type AttrFact,
  type Location,
  type ManifestReport,
  type Verdict,
} from "./manifest.js";

/**
 * Google Play's target API rule for new apps and updates, phone and
 * tablet. Source: https://developer.android.com/google/play/requirements/target-sdk
 * (facts only), checked 2026-11-23. Wear OS, TV, Automotive and XR have
 * lower levels and are out of scope.
 */
export const PLAY_TARGET = {
  minTarget: 36,
  since: "2026-08-31",
  checked: "2026-11-23",
  source: "https://developer.android.com/google/play/requirements/target-sdk",
} as const;

export interface BuildConfigVerdict {
  check: "target-sdk";
  verdict: Verdict;
  mastg: string[];
  maswe: string[];
  reason: string;
  evidence: (Location & { detail: string })[];
}

export interface BuildConfigReport {
  analyzer: "build_config";
  variant: string;
  limits: string[];
  minSdk?: AttrFact;
  targetSdk?: AttrFact;
  gradle: GradleFacts;
  playRule: typeof PLAY_TARGET;
  verdicts: BuildConfigVerdict[];
}

export async function analyzeBuildConfig(
  projectRoot: string,
  variant = "release",
  options: { manifest?: ManifestReport } = {},
): Promise<BuildConfigReport> {
  const m = options.manifest ?? (await analyzeManifest(projectRoot, variant));
  const target = m.facts.targetSdk;
  const value =
    target && /^\d{1,3}$/.test(target.value) ? Number(target.value) : undefined;
  const base = {
    check: "target-sdk" as const,
    mastg: [],
    maswe: ["MASWE-0042"],
  };
  const evidence = target
    ? [
        {
          file: target.file,
          line: target.line,
          detail: `targetSdk ${target.value}`,
        },
      ]
    : [];
  let verdict: BuildConfigVerdict;
  if (value === undefined) {
    verdict = {
      ...base,
      verdict: "MANUAL",
      reason:
        "Ward couldn't resolve targetSdk to a number (see limits). Google Play requires API 36 for new apps and updates.",
      evidence,
    };
  } else if (value < PLAY_TARGET.minTarget) {
    verdict = {
      ...base,
      verdict: "FAIL",
      reason: `targetSdk is ${String(value)}. Since ${PLAY_TARGET.since}, Google Play accepts new phone and tablet apps and updates only if they target API ${String(PLAY_TARGET.minTarget)} or higher (rule checked ${PLAY_TARGET.checked}).`,
      evidence,
    };
  } else {
    verdict = {
      ...base,
      verdict: "NO FINDING",
      reason: `targetSdk ${String(value)} meets Google Play's API ${String(PLAY_TARGET.minTarget)} requirement for phone and tablet apps (rule checked ${PLAY_TARGET.checked}).`,
      evidence,
    };
  }
  return {
    analyzer: "build_config",
    variant,
    limits: m.limits,
    ...(m.facts.minSdk && { minSdk: m.facts.minSdk }),
    ...(target && { targetSdk: target }),
    gradle: m.gradle,
    playRule: PLAY_TARGET,
    verdicts: [verdict],
  };
}
