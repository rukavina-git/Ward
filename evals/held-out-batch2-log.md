# Held-out batch 2: candidate log

Every candidate looked at for batch 2, with what happened to it and why
(plan 6 step 03). The rules are in
`docs/plans/proof/steps/03-held-out-batch-2.md`. A candidate is kept or
dropped by those rules, never by whether Ward would find it. Labelled by
Claude (Opus 5.5) on 2026-11-26.

## How candidates were found
1. Batch 1's leftover candidates (key notes).
2. GitHub commit search with batch 1's keywords: mostly small personal
   repos, then the search rate limit. Dropped as a source.
3. Commit history (no file contents, `--filter=tree:0`) of about 130
   known open-source Android apps, grepped for security words in commit
   messages from 2026-07-01 on.
4. Published repository security advisories of those repos.
5. Library upgrades in those repos, checked against OSV (api.osv.dev)
   for the version before the upgrade.

## Kept
| Repo | Fix | Kind | Why kept |
| --- | --- | --- | --- |
| 2dust/v2rayNG | e279415 | code | Backup restore extracts zip entries without a path check (zip slip). |
| signalapp/Signal-Android | b60f53f4 | code | Plaintext export: a dot-only chat name becomes a path that escapes the export folder. |
| ankidroid/Anki-Android | 5bb5a826 | code | GHSA-q29p-h3pp-mh3v: a content provider's DISPLAY_NAME is used as a cache file path. |
| ankidroid/Anki-Android | 1349d37a | absence | Crash reports attach logcat even when the exception was sanitised for personal data. |
| owncloud/android | 11237285 | code | Back on the passcode/pattern screen finishes it: the app lock is bypassed. |
| ACINQ/phoenix | 9e9ee07 | code | Any incoming intent (extras and all) goes to the navigation deep-link handler. |
| duckduckgo/Android | 6eff8db71b | code | The email JS bridge checks `webView.url`, which can be a pending navigation, not the calling page. |
| home-assistant/android | 5eb016f | config | FileProvider shares all of external storage (`external-path` "."). |
| woocommerce/woocommerce-android | ac447837d | config | FileProvider shares the whole internal cache (`cache-path` "."). |
| FossifyOrg/Messages | 1cc05f0 | config | Exported receivers let any app mark read, reply to, or delete SMS. |
| guardianproject/orbot | e2a935547c | config | Exported StartTorReceiver lets any app start Tor, on by default (audit ORB-02-013). |
| protonpass/android-pass | 893ed897 | absence | Exported ShortcutActivity shares diagnostic logs on any app's intent, with no confirmation. |
| M66B/FairEmail | 9b126853 | dependency | jsoup 1.18.3: GHSA-pmhh-3w7g-xqp8 (Cleaner) and GHSA-65r4-943x-97jj. |
| element-hq/element-x-android | df925c29 | dependency | jsoup 1.22.2: GHSA-pmhh-3w7g-xqp8. |
| Catfriend1/syncthing-android | 8c04bf3 | dependency | guava 33.7.1-android: GHSA-xxph-c9ww-hj94. |
| mycelium-com/wallet-android | 8e5a417 | code | Exported StartupActivity starts an Intent read from its own extras (intent redirection). |
| vitorpamplona/amethyst | c8caff1d | code | A logged exception prints the nostrconnect:// address with its pairing secret. |
| ThanchaPloy/PP68-SalesTrackingApp | 8be86149cc | config | Backup on with template rules while the JWT sits in plain SharedPreferences. |
| abidhasansojib/onyx-browser | 42803653ec | config | Two cases (HO-29, HO-30): user CAs trusted in release; WebView debugging always on. |

## Reserve (meets the rules; left out for the mix of kinds or the code cap)
| Repo | Fix | Kind | Note |
| --- | --- | --- | --- |
| ankidroid/Anki-Android | 52852fc2 | code | WebView media handler reads `..%2f` paths outside the media folder. Anki already has 2. |
| guardianproject/orbot | 551cdd4 | code | Zip slip restoring onion services (ORB-02-008). A third zip slip. |
| home-assistant/android | 07fb773 | code | Stored basic-auth credentials sent to a frame of another host. |
| protonpass/android-pass | 9bfa3b7a | code | Asset-link fetch follows redirects (incl. https to http). |
| M66B/FairEmail | (GHSA-w92m-2v27-mvg9) | code | Shared attachment display name used as a path. |

## Dropped
| Repo | Fix | Why dropped |
| --- | --- | --- |
| 2dust/v2rayNG | 842567f | Automated tool's fix to a path the app builds itself; nothing an attacker controls. |
| guardianproject/orbot | 952af9d | Hardcoded SQS credentials the project says are public by design; ambiguous. |
| guardianproject/orbot | a519c5c | UI logic bug (proxy toggled twice), not a static security issue. |
| guardianproject/orbot | f65a9e5 | Receiver already filtered by its intent filter; no real exposure. |
| guardianproject/orbot | 313539d | Only states `hasFragileUserData="false"`; nothing was wrong. |
| protonpass/android-pass | cc87bdd8 | App-lock bypass that depends on runtime timing across screens; not static. |
| mihonapp/mihon | 8780f1c | Headers are logged only when the user turns on verbose logging. |
| PhilKes/NotallyX | 1c78337 | Several integrity changes, no single clear vulnerability. |
| itkach/aard2-android | eb5ae0c | Framed and fixed as a robustness bug; no security claim. |
| wireapp/wire-android | e2be4ba | Lock bypass in a long activity/lifecycle flow; not judgeable statically. |
| commons-app/apps-android-commons | 7ade498 | Large multi-issue refactor (985 lines). |
| signalapp/Signal-Android | a1c18d30 | Extends Signal's own certificate blocklist to more clients; hardening. |
| nextcloud/talk-android | 556c3c26 | Deep-link routing bug, functional. |
| nextcloud/talk-android | 9d38ca85 | jackson-core bump: same issue as batch 1's HO-04. |
| thunderbird/thunderbird-android | ce0d6f1d (GHSA-mm8q-8263-vjf4) | Exposure depends on the device's platform blocklist, not the app. |
| cryptomator/android | af34aa8 (GHSA-5qmj-g47w-hx82) | Logic bug in a retry path across services; not small or static. |
| element-hq/element-x-android | GHSA-r4f9-46vw-v7g3 | Crash only (DoS). |
| ProtonVPN/android-app | 114faaa | Same fix as batch 1's HO-03. |
| ImranR98/Obtainium | c992281 | Flutter/Dart, not Kotlin or Java. |
| briar/briar | efba638 | jackson-databind 2.13.5 has the same advisories as 2.13.4.2: not a fix. |
| tirthsaraiya29/Whisk | 02af6645ec | Un-exports the launcher activity: a normal setup, not a bug (scanner-driven fix). |
| celzero/rethink-app | 51f12c1 | Loosens a caller check (restores a spoofable fallback); not a fix. |
| bisq-network/bisq-mobile | 757309c, 64e59e5 | Large feature change; redaction of debug-only logs. |
| emanuele-f/PCAPdroid | b613636 | Large settings-import validation rewrite (12 files). |
| home-assistant/android | 5ba87ae | App-lock overlay behaviour in Compose; runtime, not static. |
| nextcloud/android | 1c3451b0 | Login flow refactor; no single static issue. |
| roneill2000/homelab-android, KenlikDev/qmarket | 992c3349b9, 3625e57318 | Several issues in one change; onyx-browser covers the same kinds with separable files. |
| Darkstone-Studio/WardenBrowser | 3b00385c17 | Same kind as PP68 (backup); one backup case is enough beside batch 1's HO-09. |
| M66B/FairEmail | f52ac249 | BouncyCastle advisories hit bcprov, which is only transitive here; FairEmail already has a case. |
