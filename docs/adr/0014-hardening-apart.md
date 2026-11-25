# 14. Hardening checks reported apart by default

Date: 2026-11-25
Status: Accepted

## Context
On the clean twin (no planted bugs), skill v2 gave 9 FAILs. Eight were
missing protections: no root detection, debugger detection, pinning,
screen-capture blocking, overlay protection, enforced updates, storage
integrity, keyboard-cache attributes. That is true to MASTG, but an
ordinary app fails all of them, and they bury the one real finding.
MASTG tags each test with profiles: L1 (every app), L2 (high-value
data), R (anti-tamper), P (privacy). All eight are L2 or R only.

## Options
- **Leave verdicts as they are, sort the summary.** Cheap. Con: the FAIL
  count and control verdicts still mislead.
- **Hide every L2/R-only test by default.** Uses OWASP's own tags. Con:
  it also hides real bugs OWASP tags R only: a debuggable release build
  (EA-17), WebView debugging on (EA-16, held-out HO-10), weak APK
  signing.
- **Ward-owned list of L2/R-only tests that ask whether a protection is
  present; report their FAILs apart by default** (chosen). Con: a list
  Ward has to keep up as MASTG adds tests.

## Decision
`packages/report/src/hardening.ts` lists the hardening tests. A test
may join only if OWASP's profiles have neither L1 nor P (a unit test
checks this against the index). Concrete misconfigurations stay out.
With no profile, those rows get `hardening: true`: the agent still
answers them, but their verdicts stay out of the control verdict and
`counts.checks` (they go to `counts.hardening`), and the summary lists
FAILs under "Hardening not present", not as FAILs. A control with only
hardening checks reads FAIL as MANUAL. With profile L2 or R nothing
changes. In evals, hardening rows are not findings
(`evals/src/report-findings.ts`).

## Consequences
The FAIL list shows what an ordinary app should fix. A banking app has
to pass profile L2 or R to see hardening as FAIL; the summary says so.
Dev runs from before Ward 0.13 can be re-rolled with the list, since
the change is code only. Revisit when MASTG retags tests, or if users
miss hardening they expected.
