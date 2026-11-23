# 06 Must-exist checks

## Goal
Catch the absences Claude alone misses (EA-23, no account deletion):
things Google Play requires to exist in the app. Plain code, no LLM.
Each check is an analyzer verdict on a MASVS-PRIVACY weakness row, so
it lands in the report like any other analyzer.

## Rules (Play policy, read 2026-11-23)
- Account deletion: an app that lets users create an account must offer
  an in-app path to delete it (a link in the app to a web page counts)
  and a web link in the Data safety form.
  https://support.google.com/googleplay/android-developer/answer/13327111
- Privacy policy: every app needs a privacy policy link or text inside
  the app, plus one in Play Console.
  https://support.google.com/googleplay/android-developer/answer/10144311

## Do
1. `packages/analyzers/src/must-exist.ts`: `analyzeMustExist(root)`.
   Walks module source sets (not test or debug sets, no `build/`, no
   symlinks, size and count caps) and scans `.kt`, `.java` and `res/`
   XML line by line, skipping comment lines. Three verdicts:
   - `account-deletion` (MASWE-0076): sign-up signals and no deletion
     signal → FAIL with the sign-up lines; both → NO FINDING with the
     lines; no sign-up signal → MANUAL.
   - `privacy-policy` (MASWE-0072): no link or text → FAIL, evidence the
     app manifest's `<application` line; found → MANUAL (Ward doesn't
     read the policy).
   - `data-deletion-url` (MASWE-0073): always MANUAL; the URL lives in
     Play Console. Lists any deletion URLs found in the app.
   Evidence carries the exact line as `quote`. `limits` lists what a
   line scan can't see.
2. MCP tool `must_exist`; added to `report_skeleton`/`write_report`
   analyzers. Server 0.9.0.

## Not in scope
Reachability of the delete path from the UI, reading the policy text,
Data safety answers (Plan 7), skill changes.

## Eval
No prompt, retrieval or model change: no eval run. The held-out set runs
again only with a new skill version.

## Cost
None.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass.
- Tests: each verdict branch on temp projects; comment lines and test
  source sets ignored; example app gives account-deletion FAIL at the
  sign-up code; clean twin gives NO FINDING; skeleton has the rows
  prefilled; stdio tool list.
