# Plan 1: foundations

## Why
Choose the stack on purpose and write it down, set up the repo, and learn
how a plain LLM call works (tokens, system prompt, streaming, cost) before
any retrieval. Ward has no web chat and no hosted backend (ADR 0001), so
the LLM call is a script, not a page.

## Read first
CLAUDE.md, PRODUCT.md, docs/roadmap.md, docs/adr/0001-product-shape.md.

## Steps
- 01 Stack ADRs. One ADR per choice: language and repo layout, retrieval
  storage, embedding model, LLM for offline work, distribution and site
  hosting. Each ADR explains the concept in plain words before the options.
- 02 Scaffold: TypeScript workspace, lint, typecheck, tests, CI on GitHub
  Actions, .env.example, update CLAUDE.md Repo and Commands.
- 03 (me) Anthropic API key into .env.local; $5 prepaid, auto-reload off.
- 04 LLM spike: one streaming call from a script, system prompt from
  prompts/, tokens and cost logged.

Step files are written one at a time, each after the previous step lands.

## Invariants
- No retrieval in this plan.
- No hosted backend, no web chat.
- Secrets only in .env.local.
- Low cost: free tiers, single test calls only.
