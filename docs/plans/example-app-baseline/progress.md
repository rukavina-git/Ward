# Plan 2 progress

- [x] 01 issue list and answer key (e0121ef, CI green:
  https://github.com/rukavina-git/Ward/actions/runs/44947344852)
- [x] 02 example app and clean twin
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
- Step 02:
  - compileSdk is 37.2 (`compileSdk = 37`, `compileSdkMinor = 2`), not
    36: current AndroidX, Compose and OkHttp need 37.1 or later. AGP
    installed platform 37.2 into the SDK on its own.
  - No `-x lintVitalRelease` needed: lint-vital skips debuggable
    builds (the planted release is one), and the twin passes it.
  - Key v2 anchors: EA-05, EA-10 and EA-D5 anchor on declarations
    (`X =`). EA-08 is `Random()`. EA-22 keeps `ACCESS_FINE_LOCATION`,
    which occurs only once in PlaceTagger.kt.
  - Key v2 content: EA-21 has a second location (`put("merchant"`).
    EA-02's CSV holds date, amount, category, merchant and place, with
    no note (plain notes in a backup would undo note encryption in the
    twin). EA-09's fix uses its own biometric key and unlocks by opening
    a sealed secret. New field `app` and four twin-only decoys
    EA-D7 to D10, so 10 decoys in all (step 01 aimed for 4 to 6).
  - EA-16 is fixed by removing WebView debugging, not gating it on
    debug builds (the key allows either; one decoy fewer).
  - The twin adds what the fixes need: email prefill (EA-01), a support
    endpoint (EA-05), export through the file picker (EA-02), delete
    account (EA-23), consent applied to Mixpanel (EA-20).
  - Both apps have a "Share usage statistics" switch, because the
    consent screen promises one. In the planted app it only stores the
    answer, like the consent screen (part of EA-20).
  - After review: the twin kept Mixpanel's automatic events on
    (`true, true`), so the diff holds only EA-20's fix.

## Gotchas
Carried over from plan 1: see docs/plans/foundations/progress.md.
- Building the fixtures: `JAVA_HOME="/Applications/Android
  Studio.app/Contents/jbr/Contents/Home"` (JDK 25) and
  `ANDROID_HOME=~/Library/Android/sdk`, then `./gradlew assembleDebug
  assembleRelease` in each app. Gradle 9.9.2, AGP 9.5.2, Kotlin 2.4.21.
- MASWE v1.0.0 renumbered its IDs, but MASTG v2.0.0 tests still name
  the beta IDs. Translate through `mappings.maswe-beta` in each MASWE
  file. This matters for plan 3's ingest (control → MASWE → test).
  MASTG-TEST-0334 maps to the wrong weakness even after translation
  (noted in the key).
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
  - Copy only tracked files (e.g. `git archive`). The fixture folders
    hold gitignored build output, and its merged manifest gives EA-12
    away.
  - Issue anchors resolve in the planted app, decoy anchors in each app
    the decoy is in (`app`). EA-D7, D8 and D9 share anchors with
    planted issues.
  - Likely twin findings to grade by hand (reviewer nits, not fixed):
    the email kept in plain prefs for 'remember me'; the biometric
    unlock secret protects no data, so hooking `openSecret` still
    unlocks; no `distributionSha256Sum` in the Gradle wrapper; Lint
    style nits (KTX helpers, icon folder, OldTargetApi).
  - EA-D3's other half, the debug `http://10.0.2.2:8080/` in
    sync/build.gradle.kts, isn't a D3 location yet. A correct finding
    there would be unmatched.
  - Key wording to fix in the next key version: EA-09 says the callback
    sets an 'unlocked' flag (it navigates); EA-12 says read only (the
    provider also allows insert, update and delete).
  - Android Lint is a free static checker; on the planted app it could
    be a cheap extra eval arm (idea only).
- Gson 2.8.5 in the planted app may raise a Dependabot alert. Dismiss
  it as a test fixture.
