# Product

Decided by council and owner on 2026-11-21:
docs/council/2026-11-21-product-scope.md, ADR 0001.

## What Ward is

A pre-publish check for Android apps that runs inside your coding agent.
You add Ward to Claude Code (or Cursor) as a plugin and ask "is this app
ready to publish?". Your agent works through Ward's checklist: security,
privacy and GDPR, and later Play policy and licences. Every finding gets a
file:line, a cited rule and a fix. You triage the report in your browser,
and Ward remembers your decisions.

## Platform

- **Claude Code plugin:** a local MCP server (stdio, npm package), a skill
  that drives the run, and local code analyzers. It runs on the user's
  machine, and no code leaves it.
- **Website (ward.rukavina.app):** static. Landing page, demo video,
  install guide, in-browser search over the sources (no LLM), a sample
  report, the public eval page and a case study.
- **No hosted backend in v1.** A remote MCP endpoint may come later.

## Users

1. **Hiring managers and tech leads** visiting rukavina.app. They give it
   1–3 minutes and install nothing, so they judge from the video, the eval
   table, a sample report and the case study.
2. **Android developers** shipping a release or facing an audit, using
   Claude Code daily. They want a complete checklist, findings with
   file:line, their decisions remembered, and their code kept on their
   machine.
3. **Karlo himself**, on his own apps.

## Product purpose

Make sure nothing is forgotten before publishing. A general coding agent
checks what you ask it to. Ward brings the full checklist, cites the rule
for every item, and says plainly what it couldn't verify.

Success: on the eval apps, Claude Code + Ward catches publish blockers that
Claude Code alone skips, with few false passes and no made-up citations.
This is measured and published.

## Positioning

- **Complete, not deeper.** Ward doesn't claim to know MASVS better than
  OWASP's own tools. It covers everything you need before publishing
  (security, privacy and GDPR, later store policy and licences) that a
  general agent tends to skip.
- **Measured, not claimed.** The public eval compares four setups: Claude
  Code alone, + a plain checklist skill, + OWASP's plugin, and + Ward. The
  headline numbers are missed issues, false-pass rate and made-up-citation
  rate, published even when they're unflattering.
- **Honest verdicts:**
  - FAIL (with file:line)
  - NO FINDING (lists the files inspected)
  - NEEDS DYNAMIC (with the MASTG test)
  - MANUAL
  - N/A

  Never "PASS", no overall score, no "ready" badge.
- **Private and free to run.** Ward makes no LLM calls at runtime. The
  user's agent does the reasoning, so Ward costs nothing per user.

## How a run works

1. `/ward:check`: the user picks areas (all, a module, or one MASVS group
   such as NETWORK).
2. Local analyzers read the facts that have exact answers: merged manifest,
   network security config, targetSdk, dependencies. The agent gets
   checklist items and sources from Ward's MCP tools and inspects the code.
3. The report is saved as JSON in `.ward/` and rendered as HTML.
4. `/ward:review` opens the report in the browser. It's served by a local
   server that only listens on the user's own machine. The user
   bulk-triages: fix, accept (with a reason) or skip. Decisions go into
   `.ward/decisions.json`, committed and reviewable in PRs. Reruns show
   only new or changed items.
5. `/ward:fix` fixes the items marked "fix".

## Modules

- **v1:** security first (MASVS v2.1, MASTG v2.0), then privacy and GDPR.
  v1 is released publicly only once both are in.
- **Later:** Play policy (plain-code checks where possible), licences (via
  existing tools), targetSdk bump, iOS, web.
- Users pick modules and MASVS groups per run.

## Sources

- **OWASP MASVS and MASTG** (CC BY-SA): attribution and a link on every
  citation.
- **Android developer docs:** CC BY 4.0 according to the council; verify
  before ingesting.
- **GDPR and EU guidance** for the privacy module: licence to verify.
- **Play policy pages:** no open licence found. Store facts and links, not
  their text.

Details and licences go in docs/sources.md, created with the first
ingestion.

## Example app

A Kotlin app with planted issues, plus a clean twin of it, generated for
the evals and kept in this repo. Its code has no hint comments, and the
answer key lives outside the app folder.

## Out of scope (v1)

- Hosted scanning (uploading APKs or repos).
- Live LLM chat on the website.
- Accounts, payments.
- Legal advice. Ward flags obligations and cites the source. It gives no
  legal opinions and no compliance verdicts.
- CI gates driven by LLM verdicts.

## Constraints

- **Near-zero running cost:** static site, local plugin, and about $5 of
  prepaid API credit (auto-reload off) for offline work only: ingestion
  help, eval judging, pre-generated demo answers. Agent eval runs use the
  owner's Claude plan or Haiku.
- **Not affiliated with OWASP.** "OWASP" is never part of the product name.
