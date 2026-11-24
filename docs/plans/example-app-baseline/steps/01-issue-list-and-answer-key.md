# 01 Issue list and answer key

## Goal
Fix the test before writing the app. Decide which issues get planted in
the example app, which decoys sit next to them, and how each one is
fixed in the clean twin. Write it all down as the answer key: a
machine-readable file that the scoring script (step 03) will read. No
app code yet. Writing the key first stops the key from being fitted to
whatever code comes out.

## Do
1. Check the current versions and ID lists from live sources: MASVS
   (control IDs such as MASVS-STORAGE-1), MASWE (weakness IDs) and
   MASTG (test IDs, and whether each test is static or dynamic). Record
   each version and URL in the answer key header. Cite IDs only; if any
   OWASP text gets copied, start docs/sources.md with its licence.
2. App concept, a few lines in the key's header: what the app does and
   what it touches (login, REST sync, local storage, a WebView, an
   analytics SDK, sharing or export, one library module). The planted
   issues must fit the app naturally.
3. Planted issues: 15 to 25, with:
   - at least one in each MASVS group (STORAGE, CRYPTO, AUTH, NETWORK,
     PLATFORM, CODE, RESILIENCE, PRIVACY)
   - 3 to 5 privacy issues (e.g. analytics before consent, personal
     data in logs or analytics events)
   - a few Play and manifest facts (targetSdk below Play's current
     requirement, an exported component, cleartext traffic)
   - a mix of difficulty: obvious, config-only, cross-file (data
     flowing from one file to another), and one that shows only in the
     merged manifest (from the library module)
   - mostly static. Any that need a running app are marked NEEDS DYNAMIC
     and scored separately.
4. Decoys: 4 to 6 pieces of code that look risky but are fine (e.g. MD5
   used as a cache key, cleartext allowed only to the emulator host in a
   debug-only config). Each says why it's fine. A finding on a decoy
   counts as a false alarm.
5. Answer key: `evals/answer-keys/example-app.json`. Per issue: neutral
   ID (no hint in it), category (security, privacy or play), severity,
   MASVS control, MASWE ID, MASTG test if any, expected verdict (FAIL,
   NEEDS DYNAMIC or MANUAL), difficulty, how it's planted, the fix for
   the twin, and one or more locations. A location is a file plus an
   anchor (a symbol or a short code snippet), not a line number: lines
   don't exist yet and shift on every edit. The scorer turns anchors
   into lines later. Decoys use the same shape, with `decoy: true`.
   A short `evals/README.md` explains the fields.
6. Karlo reviews the list. He knows Android security: every planted
   issue must be real, and every decoy must really be fine.

## Not in scope
- App code (step 02), the scoring script (step 03), running any agent
  (step 04).
- GDPR article mapping (plan 7).

## Done when
- The answer key parses as JSON and has 15 to 25 issues covering all 8
  MASVS groups, 3 to 5 privacy issues and 4 to 6 decoys.
- Every MASVS, MASWE and MASTG ID has been checked against the live
  source, and the versions are in the header.
- Every issue has a fix for the twin and at least one location.
- Karlo has approved the list.
- `npm run format:check` passes. Glossary has: answer key (ground
  truth), true and false positive, precision, recall, decoy. Roadmap
  2.1 ticked.
