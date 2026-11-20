# Product

## Platform

web (Next.js app) + MCP server, sharing one backend.

## Users

1. **Hiring managers and tech leads** visiting rukavina.app. They try the
   demo for a minute and read the case study. They judge whether Karlo
   understands AI systems, not just APIs.
2. **Developers and QA** preparing for a security review or audit of a web
   or mobile app. They want a precise answer with the exact requirement,
   fast, and they want to check the source.
3. **Developers using AI coding tools** (Claude Code, Cursor). They plug
   Ward in as an MCP server so their assistant can look up security
   requirements while coding.

## Product purpose

Answer application security questions from the standards themselves, with
citations, and say "I don't know" when the sources don't cover it.
Success: a developer gets a correct, cited answer they can verify in one
click, and a hiring manager sees measured quality, not a demo that only
works on happy paths.

## Positioning

- **Focused beats general.** A general assistant gives a generic answer;
  Ward cites the exact MASVS/ASVS requirement and the matching platform
  API, with versions.
- **Measured, not claimed.** A public eval page shows the question set
  and scores, including where Ward fails.
- **Honest.** No answer without a source.

## Sources

v1: OWASP MASVS and MASTG (mobile). Later: Android security docs, OWASP
ASVS (web), Top 10, Cheat Sheet Series. Details and licences:
docs/sources.md (created with the first ingestion).

## Out of scope (v1)

- Scanning user code or apps (possible later as an agent).
- Accounts, history, payments.
- Legal or compliance advice.

## Constraints

- Low running cost: hobby-scale hosting, rate limits on the public demo.
- Not affiliated with OWASP. "OWASP" is never part of the product name.
