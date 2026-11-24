import type { LinkOverride } from "@ward/core";

/**
 * Hand fixes for MASTG v2.0.0 tests whose beta weakness ID doesn't
 * translate to exactly one right MASWE v1.0.0 weakness. Proposed by Claude
 * from the test and weakness texts, approved by Karlo on 2026-11-22.
 * `named` must still match the test's front matter, so an override goes
 * stale (and ingest fails) when OWASP changes the test.
 */
export const overrides: readonly LinkOverride[] = [
  {
    test: "MASTG-TEST-0206",
    named: "MASWE-0108",
    weaknesses: ["MASWE-0073"],
    reason:
      "Beta MASWE-0108 maps to MASWE-0073 and MASWE-0074. The test checks PII in traffic against the privacy policy and Data Safety declarations: data collection declarations (0073), not tracking domains (0074).",
  },
  {
    test: "MASTG-TEST-0307",
    named: "MASWE-0012",
    weaknesses: ["MASWE-0007", "MASWE-0010"],
    reason:
      "Beta MASWE-0012 maps to MASWE-0007, 0009 and 0010. The test checks asymmetric key pairs used for several purposes; key reuse is a mode of improper encryption (0007) and of signatures (0010). MACs (0009) use symmetric keys.",
  },
  {
    test: "MASTG-TEST-0308",
    named: "MASWE-0012",
    weaknesses: ["MASWE-0007", "MASWE-0010"],
    reason: "Runtime twin of MASTG-TEST-0307; same reasoning.",
  },
  {
    test: "MASTG-TEST-0324",
    named: "MASWE-0097",
    weaknesses: ["MASWE-0051"],
    reason:
      "Beta MASWE-0097 maps to no v1 weakness. The test checks root detection: MASWE-0051 (Root/Jailbreak Detection Not Implemented), which lists no beta ID.",
  },
  {
    test: "MASTG-TEST-0325",
    named: "MASWE-0097",
    weaknesses: ["MASWE-0051"],
    reason: "Runtime twin of MASTG-TEST-0324; same reasoning.",
  },
  {
    test: "MASTG-TEST-0334",
    named: "MASWE-0069",
    weaknesses: ["MASWE-0033"],
    reason:
      "Beta MASWE-0069 maps to MASWE-0034 (local resources with untrusted content), but the test checks native code exposed through JavaScript bridges: MASWE-0033. Same call as the answer key's EA-15.",
  },
];
