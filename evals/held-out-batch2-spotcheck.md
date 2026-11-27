# Batch 2 spot check (Karlo)

Five of 18 cases, checked before any step 06 run. For each: open the
fix, open the code at the parent, and tick one box. A "no" means the
case is dropped or fixed **before** any run, with a new key sha.

Questions per case: (a) is this a real security issue, (b) is it in the
code at the parent, at those lines, (c) does the fix fix it, (d) is the
MASVS control right.

## HO-17: Privileged JS bridges check webView.url, which can be a pending navigation, not the calling page
code, MASVS-PLATFORM-2, MASTG-TEST-0334. Fix: Also require the committed back/forward entry to match, in the email, content-scope and subscription bridges.

- Fix: https://github.com/duckduckgo/Android/commit/6eff8db71b3e928163ea07f55fce042489a80f7d
- Code: https://github.com/duckduckgo/Android/blob/bd7169f70515d2381d872aef32b01124f02032c5/app/src/main/java/com/duckduckgo/app/email/EmailJavascriptInterface.kt#L39-L48
- Code: https://github.com/duckduckgo/Android/blob/bd7169f70515d2381d872aef32b01124f02032c5/content-scope-scripts/content-scope-scripts-impl/src/main/java/com/duckduckgo/contentscopescripts/impl/messaging/ContentScopeScriptsJsMessaging.kt#L185-L190
- Code: https://github.com/duckduckgo/Android/blob/bd7169f70515d2381d872aef32b01124f02032c5/subscriptions/subscriptions-impl/src/main/java/com/duckduckgo/subscriptions/impl/messaging/SubscriptionMessagingInterface.kt#L84-L89

- [x] right (Karlo, 2026-11-27)

## HO-22: Exported StartTorReceiver lets any app start Tor, allowed by default
config, MASVS-PLATFORM-1, MASTG-TEST-0366. Fix: Starts from other apps are off by default; the user has to allow them.

- Fix: https://github.com/guardianproject/orbot/commit/e2a935547c6ae78d35dd59d7de11f5d43c5addda
- Code: https://github.com/guardianproject/orbot/blob/69d2f1a39d92cfb11c183efe60dad193ba4af559/app/src/main/AndroidManifest.xml#L95-L102
- Code: https://github.com/guardianproject/orbot/blob/69d2f1a39d92cfb11c183efe60dad193ba4af559/app/src/main/java/org/torproject/android/util/Prefs.kt#L200-L202
- Code: https://github.com/guardianproject/orbot/blob/69d2f1a39d92cfb11c183efe60dad193ba4af559/app/src/main/res/xml/preferences.xml#L25-L29

- [x] right (Karlo, 2026-11-27)

## HO-14: Crash reports attach logcat even when the exception was sanitised for personal data
absence, MASVS-STORAGE-2. Fix: A last report collector replaces logcat with a placeholder for sanitised reports.

- Fix: https://github.com/ankidroid/Anki-Android/commit/1349d37aa02094b90628f1871c54c19ebb75d48f
- Code: https://github.com/ankidroid/Anki-Android/blob/559ab49ed3d5bd1a4e4ec38efbb76d718c02532a/AnkiDroid/src/main/java/com/ichi2/anki/AcraCrashReporter.kt#L85-L112

- [x] right (Karlo, 2026-11-27)

## HO-27: Backup on with template rules while the JWT sits in plain SharedPreferences
config, MASVS-STORAGE-2, MASTG-TEST-0262. Fix: Backup is turned off and the template rule files are removed.

- Fix: https://github.com/ThanchaPloy/PP68-SalesTrackingApp/commit/8be86149cc7bd59003ff61d14e9221c2f88ede01
- Code: https://github.com/ThanchaPloy/PP68-SalesTrackingApp/blob/30d9e61830b62cb7ffe29ae8880914583aa242f5/app/src/main/AndroidManifest.xml#L30-L32
- Code: https://github.com/ThanchaPloy/PP68-SalesTrackingApp/blob/30d9e61830b62cb7ffe29ae8880914583aa242f5/app/src/main/java/com/example/pp68_salestrackingapp/di/TokenManager.kt#L55-L56

- [x] right (Karlo, 2026-11-27)

## HO-25: jsoup 1.22.2 with a known advisory (GHSA-pmhh-3w7g-xqp8)
dependency, MASVS-CODE-3, MASTG-TEST-0272. Fix: Upgrade jsoup to 1.23.1.

- Fix: https://github.com/element-hq/element-x-android/commit/df925c29e4005213355e671eef52e5b1556016dd
- Code: https://github.com/element-hq/element-x-android/blob/07ca468847009342d711aba77162f647ff36c398/gradle/libs.versions.toml#L202-L202

- [x] right (Karlo, 2026-11-27)
