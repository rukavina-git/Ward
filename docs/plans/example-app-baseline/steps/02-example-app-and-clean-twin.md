# 02 Example app and clean twin

## Goal
Build Penny Jar from the answer key: a small, realistic Kotlin app with
the 23 planted issues and 6 decoys, and its clean twin with every issue
fixed. Both build with Gradle. Apart from the planted issues, both apps
do things the current, correct way, so the twin really is clean. The
key stays the source of truth: where the code has to differ from it,
the key changes and the change is noted.

## Do
1. Toolchain. Use Android Studio's bundled JDK and the SDK at
   ~/Library/Android/sdk, through environment variables only (no
   `local.properties` in the repo: it holds an absolute path). Check
   current stable versions of Gradle, the Android Gradle Plugin, Kotlin
   and the Compose BOM from live sources. compileSdk 36, minSdk 26.
2. Planted app, `fixtures/example-app`: two modules, `:app` and
   `:sync`, as the key's concept describes. Keep it small: a few
   Compose screens (login, expense list, add expense, consent,
   settings, support), the help WebView activity, the backup worker,
   the receipts provider and database. Every planted issue and decoy
   sits at its key location.
   - No hints: no comments, names, strings or commit messages that
     point at an issue. Few comments overall.
   - Hosts use the reserved `.example` domain (e.g.
     `api.pennyjar.example`), so nothing calls a real server.
   - Fake tokens don't match any real provider's format, so GitHub
     secret scanning stays quiet.
   - Dependencies: permissive licences only (OkHttp, Gson, AndroidX,
     Mixpanel are Apache 2.0). Place tagging uses the platform
     LocationManager, not Play services (not open source).
   - The session token is stored encrypted with a Keystore key in
     both apps. Only the 'remember me' password (EA-01) is plain text.
   - R8 minify on in both apps, with the keep rules they need.
   - Gradle wrapper included. `.gitignore` covers build output,
     `.gradle/`, `local.properties` and IDE files.
3. Clean twin, `fixtures/example-app-clean`: a copy of the planted app
   with each item's `fix` applied, and nothing else changed. Same
   `rootProject.name`, `applicationId` and package names. EA-09's fix
   uses its own biometric-bound key, not the session-token key
   (background sync needs that one without a prompt).
4. Answer key updates (`keyVersion` 2). Each one is listed under
   Deviations in progress.md.
   - Anchors that occur more than once become declarations
     (`HELPDESK_API_TOKEN =`, `MIXPANEL_PROJECT_TOKEN =`,
     `RECEIPT_IMAGE_BASE =`; EA-22's PlaceTagger anchor likewise).
   - EA-08's anchor `java.util.Random()` becomes `Random()` with a
     normal import: a fully qualified call would be a hint.
   - EA-21 gets a second location: the track call that sends the
     merchant name.
   - Risky-looking code that stays in the twin becomes decoys: the
     backup rules, the bridge without its token method, the exported
     deep-link activity, debug-only HTTP logging. Decoys that exist
     only in the twin get `"app": "clean"`; without it, a decoy is in
     both apps.
   - `evals/README.md` describes `name`, `keyVersion`, `created` and
     the new `app` field.
5. Anchor check: a one-off script (not committed) confirms every
   anchor occurs exactly once in its file: issues and shared decoys in
   the planted app, all decoys in the twin. Step 03 builds the real
   anchor resolver.
6. Exclude `fixtures/` from Prettier and ESLint if either picks up
   files there.

## Not in scope
- The eval runner, findings format and scorer (step 03). Running any
  agent (step 04).
- Building the fixtures in CI. Unit tests or UI polish in the app.
- Real backend, real signing config, Play listing.

## Done when
- Both apps build: `./gradlew assembleDebug assembleRelease` in each
  (release unsigned is fine). If lint-vital stops the planted release
  build, the command skips that task (`-x lintVitalRelease`); nothing in
  the app turns lint off, since that would be a hint.
- `diff -r` of the two apps shows only the fixes from the key.
- The anchor check passes for both apps.
- The key parses, has `keyVersion` 2, and still has 23 issues.
- No hints: grep both apps for words like vuln, insecure, todo, fixme,
  hack, unsafe, plant, decoy, EA-.
- `npm run lint`, `npm run format:check` and `npm test` pass. Glossary
  has: fixture, clean twin. Roadmap 2.2 ticked.
