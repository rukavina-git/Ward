# 05 Network security config and targetSdk analyzers

## Goal
Turn step 04's MANUAL cleartext and debuggable verdicts into exact ones
by reading what decides them: the network security config (NSC) and
the Gradle build files (targetSdk, minSdk, the release build type's
`isDebuggable`). Two new MCP tools: `network` and `build_config`.

## Do
1. `packages/analyzers/src/gradle.ts`: per module, read
   `build.gradle(.kts)` (and `gradle/libs.versions.toml` for
   `libs.versions.x` references): minSdk, targetSdk, compileSdk with
   file:line and the raw expression; the variant's build type block
   (`release { … }`) for `isDebuggable` / `debuggable`. Anything Ward
   can't resolve (a constant, `initWith`, convention plugins in
   `buildSrc/` or `build-logic/`) is reported as unresolved, never
   guessed. Comments are stripped first.
2. `packages/analyzers/src/network.ts`: resolve
   `android:networkSecurityConfig` (`@xml/name`) to
   `<module>/src/<set>/res/xml/name.xml` for the sets that feed the
   variant (no debug set for release). Facts: base-config and each
   domain-config's cleartext flag, domains, trust anchors, pin-sets
   (pin count, expiration), debug-overrides. Verdicts:
   cleartext (MASTG-TEST-0235, with usesCleartextTraffic and targetSdk
   defaults), user CAs trusted (MASTG-TEST-0286, and 0285 for targetSdk
   below 24), pinning missing (MASTG-TEST-0242, MANUAL: may be in code),
   expired pins (MASTG-TEST-0243).
3. targetSdk verdict (MASWE-0042, no MASTG test): FAIL below Play's
   requirement, from a dated table in Ward's code with its source URL
   (API 36 for new apps and updates since 2026-08-31, checked
   2026-11-23). Phone/tablet only; the verdict says so.
4. Manifest analyzer: use Gradle's targetSdk when no manifest has one
   (implied exported, provider defaults); debuggable reads the build
   type in source mode. Its cleartext verdict moves to `network`.
5. MCP tools `network` and `build_config` (same input and notice as
   `manifest`). Tests offline on the fixtures and hand-written projects:
   EA-10 FAIL, EA-17 FAIL at `isDebuggable = true`, EA-18 FAIL at
   `targetSdk = 34`, EA-D3 not raised (debug set), clean twin raises none
   of these; version catalog, unresolved constant, `initWith`, user CAs
   in debug-overrides only, expired pin. Never HO-01…HO-10.

## Not in scope
- Pinning in code (OkHttp CertificatePinner, custom TrustManager).
- Wear OS, TV, Automotive target levels. Dependencies (step 06).
- Running Gradle.

## Eval
No retrieval, chunking, prompt or model change: no eval run.

## Cost
None. No LLM calls.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass; CI green.
- On the example app: EA-10, EA-17, EA-18 FAIL with file:line; on the
  clean twin none of them, and EA-D3 is not raised.
- Play's target rule recorded in docs/sources.md (facts only).
- Glossary has: network security config, build type.
