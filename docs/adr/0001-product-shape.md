# 1. Product shape: a local pre-publish check plugin

Date: 2026-11-21
Status: Accepted (offline LLM use narrowed by 0007)

## Context
Ward started as a Q&A assistant over OWASP MASVS/MASTG (web chat + MCP).
A general assistant with web search already does that well, so it added
little. The owner wants something that's useful to him as an Android
developer, and that shows AI engineering skill: retrieval, tool design,
evals, AI security. Running costs must stay near zero.

A council of six independent reviewers weighed eight questions
(docs/council/2026-11-21-product-scope.md). The owner then decided.

## Options
- **Q&A web chat + MCP** (the original plan). Easy to build, but it's a
  commodity and loses to Claude with search. A live LLM chat on a $5 cap
  gets drained.
- **Hosted scanner** (upload an APK or repo). Vetoed by all six reviewers:
  it means keeping strangers' code on a hobby server, paying for compute
  and LLM calls with no ceiling, and competing head-on with MobSF.
- **Pre-publish check run by the user's own agent** (chosen). Ward
  supplies cited, versioned checklists and sources plus local analyzers;
  the user's Claude Code does the reasoning.

## Decision
- Ward is a Claude Code plugin: a local stdio MCP server (npm), a skill
  and local analyzers. No code leaves the user's machine.
- Ward makes no LLM calls at runtime. The LLM is used offline only:
  ingestion help, eval judging, pre-generated demo answers.
- Modules: security (MASVS/MASTG) is built first, then privacy and GDPR.
  v1 is released publicly with both. Users pick modules and MASVS groups
  per run.
- Selling point: completeness before publishing, measured against Claude
  Code alone. Not "better MASVS coverage than OWASP".
- Verdicts are FAIL, NO FINDING, NEEDS DYNAMIC, MANUAL or N/A. Never PASS.
- Report: JSON plus a read-only HTML view first. Triage happens in a local
  browser UI (localhost only) that writes `.ward/decisions.json`.
- Website: static. Demo, install guide, in-browser search, sample report,
  eval page. No live LLM.
- Evals use an example Kotlin app with planted issues plus a clean twin,
  kept in this repo, with the answer key outside the app folder.

## Consequences
- Easier: $0 per user, nothing to abuse, no server to run, and an easy
  case to make to security teams.
- Harder: there's little LLM code at runtime, so the AI story rests on
  retrieval quality, tool design and evals. Report quality depends on the
  user's model, so the eval page must name the model it used.
- Agent eval runs are expensive on the API, so they run on the owner's
  Claude plan or on Haiku, with small N.
- Revisit a remote MCP endpoint after v1. It's a small code change, but
  it needs hosting, abuse protection and auth.
- Revisit if the baseline (plan 2) shows Claude Code alone already finds
  almost everything.
