# Plan 1: foundations

## Why
Choose the stack on purpose and write it down, set up the repo, and see
how an agent calls a tool before building any retrieval. Ward makes no
LLM calls and uses no paid APIs (ADR 0001, ADR 0007): the user's agent
does the reasoning, so the first thing to learn is how it uses Ward's
tools.

## Read first
CLAUDE.md, PRODUCT.md, docs/roadmap.md, docs/adr/0001-product-shape.md.

## Steps
- 01 Stack ADRs. One ADR per choice: language and repo layout, retrieval
  storage, embedding model, LLM for offline work, distribution and site
  hosting. Each ADR explains the concept in plain words before the options.
- 02 Scaffold: TypeScript workspace, lint, typecheck, tests, CI on GitHub
  Actions, update CLAUDE.md Repo and Commands.
- 03 Hello MCP: a tiny stdio MCP server with one tool, connected to
  Claude Code through the repo-root .mcp.json. Watch the agent find the
  tool, call it and use the result.

Step files are written one at a time, each after the previous step lands.

## Invariants
- No retrieval in this plan.
- No hosted backend, no web chat.
- Secrets only in .env.local.
- No paid APIs, no API keys (ADR 0007).
