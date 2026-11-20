# Plan 1: foundations

## Why
Get a deployed app that streams answers from an LLM, on a stack chosen
on purpose and written down. No retrieval yet: first understand a plain
LLM call (tokens, system prompt, streaming, cost), then add RAG in plan 2.

## Read first
CLAUDE.md, PRODUCT.md, docs/roadmap.md.

## Steps
- 01 Stack ADRs. One ADR per choice: app framework, database and vector
  store, embedding provider, LLM provider and model, hosting. Each ADR
  explains the concept in plain words before the options.
- 02 Scaffold: app skeleton, lint, typecheck, CI on GitHub Actions,
  .env.example, update CLAUDE.md Repo and Commands.
- 03 (me) Accounts and API keys, into .env.local and hosting settings.
- 04 Plain chat: one page, one API route, streaming answer, system
  prompt from prompts/, basic rate limit.
- 05 (me) Deploy, DNS for ward.rukavina.app.

Step files are written one at a time, each after the previous step lands.

## Invariants
- No retrieval in this plan.
- Secrets only in .env.local and the host's settings.
- Low cost: free or hobby tiers where they're good enough.
