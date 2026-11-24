# Test fixtures: OWASP files, verbatim

A few real files from the pinned OWASP sources, laid out as in their repos,
so the parsers are tested on the real format. Together they form one small,
complete graph: MASVS-AUTH-2 and MASVS-CRYPTO-2 ← MASWE-0020 ←
MASTG-TEST-0327 and 0330 ← MASTG-DEMO-0090, plus the deprecated
MASTG-TEST-0017, covered by 0327 and 0330.

| Folder | Source | Commit |
| --- | --- | --- |
| `masvs/` | [OWASP MASVS v2.1.0](https://github.com/OWASP/masvs/tree/v2.1.0) | 8e133d09f4140518ed04cc254b18be9ff4990ffc |
| `maswe/` | [OWASP MASWE v1.0.0](https://github.com/OWASP/maswe/tree/v1.0.0) | 308b82b4bbe29166934fb5a621b40471cfea61db |
| `mastg/` | [OWASP MASTG v2.0.0](https://github.com/OWASP/mastg/tree/v2.0.0) | 990472dbcffe126f5556045d60270c4ffdfdde72 |

© OWASP Mobile Application Security (MAS) project. Licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Copied
without changes, except that `run.sh` is no longer executable. This folder
is not covered by Ward's MIT licence.

The files are data. Nothing here is run.
