```
Ward check: 24 MASVS controls (all MASVS groups, variant release)
Controls: FAIL 3 · MANUAL 20 · NEEDS DYNAMIC 1
Checks:   FAIL 3 · MANUAL 98 · NEEDS DYNAMIC 46 · NO FINDING 76 · N/A 17

FAIL
  MASVS-CRYPTO-2  MASTG-TEST-0207  app/src/main/java/app/pennyjar/backup/AutoBackupWorker.kt:23
  MASVS-STORAGE-1  MASTG-TEST-0207  app/src/main/java/app/pennyjar/backup/AutoBackupWorker.kt:23
  MASVS-STORAGE-2  MASTG-TEST-0207  app/src/main/java/app/pennyjar/backup/AutoBackupWorker.kt:23

Not checked
  0 pending · 67 manual · 26 need a running app · 0 out of scope

Citation check: every ID, file:line and quote confirmed

NO FINDING means Ward found nothing, not that the app is safe.
Full report: .ward/report.json
```

- **Fix first:** `AutoBackupWorker.kt:23` writes all receipts (merchant, city, amount) as a plaintext CSV. `backup_rules.xml:3` and `data_extraction_rules.xml` exclude only the three SharedPreferences files, so that CSV and `receipts.db` still go into cloud backup and device transfer. Encrypt the CSV or exclude `files/backup` and the database from both rules files.
- **Judgment calls for you:** I raised this FAIL on my own reading that the data counts as sensitive. Only the note column is encrypted, so check that against your threat model.
- **Needs your decision (MANUAL):** There is no screenshot or overlay protection. The biometric unlock isn't tied to the stored data. `minSdk` is 26. The exported `HelpActivity` deep link is validated, but a crafted link can still make the app open an arbitrary http(s) URL in the browser.

The full report is in `.ward/report.json`. `NO FINDING` means Ward found nothing, not that the app is safe.
