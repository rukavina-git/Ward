# Plan 2 progress

- [x] 01 issue list and answer key
- [ ] 02 example app and clean twin
- [ ] 03 eval harness v0
- [ ] 04 baseline

## Deviations
- The roadmap had three steps. The app step was split into 01 (issue
  list and answer key) and 02 (app and twin), so the answer key is fixed
  before any code is written.
- Step 01:
  - Key fields are camelCase. Decoys carry `whyFine` and no severity,
    MASTG, difficulty, planted or fix. Difficulty has a fifth value,
    `absence` (EA-23).
  - The key doesn't record whether each MASTG test is static or dynamic.
    All cited tests are static except MASTG-TEST-0287 (dynamic). No issue
    is NEEDS DYNAMIC.
  - Only IDs are cited, so there's no docs/sources.md yet.
  - After review, Karlo approved three changes: EA-08 reworded (a
    per-device seeded `Random` can't predict other users' tokens) and set
    to medium. EA-02's threat spelled out with minSdk 26 (it stays high).
    EA-13 and EA-15 set to medium, because each needs a second flaw.

## Gotchas
Carried over from plan 1: see docs/plans/foundations/progress.md.
- No system JDK on Karlo's Mac; the Android SDK is at
  ~/Library/Android/sdk and `ANDROID_HOME` is unset. Step 02 needs a JDK
  for Gradle (Android Studio's bundled one, or a separate install).
- MASWE v1.0.0 renumbered its IDs, but MASTG v2.0.0 tests still name
  the beta IDs. Translate through `mappings.maswe-beta` in each MASWE
  file. This matters for plan 3's ingest (control → MASWE → test).
  MASTG-TEST-0334 maps to the wrong weakness even after translation
  (noted in the key).
- Step 02:
  - Anchors must occur exactly once. Anchor on declarations
    (`HELPDESK_API_TOKEN =`), because `HELPDESK_API_TOKEN`,
    `ACCESS_FINE_LOCATION`, `MIXPANEL_PROJECT_TOKEN` and
    `RECEIPT_IMAGE_BASE` may each appear twice.
  - `java.util.Random()` forces a fully qualified call, which is a mild
    hint, so change that anchor.
  - Any anchor change updates the key and is noted as a deviation.
  - Risky-looking code that stays in the twin (backup rules, the bridge
    without its token method, the exported deep-link activity,
    debug-only logging) becomes decoys in the key.
  - Set minify the same in both apps.
  - EA-21 needs a second location: the track call that sends merchant
    names.
  - EA-09's fix needs its own biometric key, not the key for the session
    token (background sync needs that one).
  - Fake tokens must not match real provider formats, or GitHub secret
    scanning flags them.
  - Gson 2.8.5 may raise a Dependabot alert on the repo.
  - Consider reserved `.example` domains for every host.
- Step 03:
  - A finding matches an item on location plus issue type (MASWE ID or
    keywords). Ties are graded by hand.
  - Decide whether one finding can count for both items of a chain
    (EA-12/13, EA-14/15).
  - Copy both apps under the same neutral folder name, with identical
    rootProject.name and applicationId.
  - The scorer fails when an anchor matches zero times or more than once.
  - Generic hardening advice (pinning, root detection, FLAG_SECURE) in
    either app is graded by hand.
- evals/README.md doesn't yet describe the header fields `name`,
  `keyVersion` and `created`.
