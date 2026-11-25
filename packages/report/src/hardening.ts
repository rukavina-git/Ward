/**
 * Hardening checks (ADR 0014): MASTG tests that ask whether a protection
 * is present (root detection, pinning, screen-capture blocking, overlay
 * protection, obfuscation, enforced updates, …). OWASP puts each in the
 * L2 or R profile only, never L1 or P. Without a profile, Ward reports
 * their FAILs apart, as "hardening not present", outside the control
 * verdicts and the FAIL count: an ordinary app fails most of them, and
 * they bury the real findings. With profile L2 or R they count as usual.
 *
 * Ward owns this list. L2/R tests that find a concrete misconfiguration
 * stay out of it and keep failing: debuggable flag (0226), WebView
 * debugging (0227), APK signing (0224, 0225), expired pins (0243),
 * StrictMode in release (0263–0265), notifications (0315), key purposes
 * (0015, 0307, 0308), biometric use (0017, 0018, 0326–0330).
 * A test may join only if its profiles have neither L1 nor P (a unit
 * test checks this against the index).
 */
export const HARDENING_TESTS: ReadonlySet<string> = new Set(
  [
    "0010", // auto-generated screenshots (FLAG_SECURE)
    "0012", // device-access-security policy (screen lock required)
    "0022", // custom certificate stores and pinning
    "0023", // Security Provider
    "0035", // overlay attacks
    "0036", // enforced updating
    "0045", // root detection
    "0046", // anti-debugging
    "0047", // file integrity checks
    "0048", // reverse engineering tools detection
    "0049", // emulator detection
    "0050", // runtime integrity checks
    "0051", // obfuscation
    "0222", // PIC not enabled
    "0223", // stack canaries not enabled
    "0242", // missing certificate pinning (NSC)
    "0245", // platform version APIs
    "0247", // secure screen lock detection APIs
    "0249", // runtime secure screen lock detection
    "0258", // keyboard caching attributes
    "0289", // screenshots while backgrounded
    "0291", // screen capturing prevention APIs
    "0295", // GMS Security Provider not updated
    "0324", // root detection mechanisms
    "0325", // runtime root detection
    "0338", // storage integrity check APIs
    "0340", // overlay attack protections
    "0341", // hook detection
    "0351", // emulator detection
    "0352", // debugging detection APIs
    "0353", // runtime debugging detection
    "0368", // obfuscation, Java/Kotlin
    "0369", // obfuscation, native code
    "0382", // runtime enforced updating
    "0392", // enforced updating APIs
  ].map((n) => `MASTG-TEST-${n}`),
);

/** Whether a check is reported apart in this scope (no profile given). */
export function isHardening(id: string, profile: string | null): boolean {
  return profile === null && HARDENING_TESTS.has(id);
}
