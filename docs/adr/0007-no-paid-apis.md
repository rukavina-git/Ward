# 7. No paid LLM or embedding APIs

Date: 2026-11-21
Status: Accepted

Supersedes ADR 0005. Narrows ADR 0001 (offline LLM use) and ADR 0004
(the Voyage option).

## What is this
Whether Ward's own repo calls a paid API at all. Ward never calls an LLM
at runtime (ADR 0001): the user's agent does the reasoning. ADR 0005
still planned an Anthropic API key with $5 of credit for Karlo's offline
scripts. This ADR drops that.

## Context
ADR 0005 used the API for four things:
- the plan 1 spike (learning tokens, streaming and cost)
- ingestion help (drafting check cards), already moved to Claude Code
- the eval judge (grading findings against the answer key)
- pre-generated demo answers for the website

The owner doesn't want a separate account, key and bill for a pet
project. The website demo is meant to be a video or slideshow of a real
run, not live or pre-generated LLM answers. Visitors who want more can
install the plugin in about two minutes and try it themselves.

## Options
- **Keep ADR 0005: Haiku 5.5 on the API, $5 prepaid.**
  - Pro: direct API code in the portfolio (streaming, prompt caching,
    batches).
  - Con: a second account, a key to keep secret, and a bill. Rejected by
    the owner.
- **A local open-weights LLM for judging (e.g. via Ollama).**
  - Pro: free, no key.
  - Con: a multi-GB download, weaker than Claude, and another moving
    part. Not needed if scoring is done in code. Rejected.
- **No paid APIs; LLM work runs in Claude Code on Karlo's plan**
  (chosen).
  - Pro: $0 on top of the plan Karlo already pays for. No account, no
    key, no secrets in the repo.
  - Con: no direct API code to show. Eval runs count against the plan's
    usage limits.

## Decision
1. Ward's repo makes no calls to a paid API. No Anthropic key, no Voyage
   key, no other paid account.
2. Eval scoring is code. The report JSON has a check ID, file and line
   for every finding, so matching findings against the answer key and
   checking citations are plain code. Where a match needs judgement,
   Karlo grades it by hand.
3. Agent eval runs and any other scripted LLM work use Claude Code in
   non-interactive mode (`claude -p`, the docs call it headless) on
   Karlo's plan. Never with `--bare`: bare mode skips the subscription
   login and needs an API key.
4. Output from those runs stays untrusted input (prompt injection from
   the example app). Code checks it; it never drives actions.
5. The website demo is a video or slideshow of a real run on the example
   app, plus a sample report and an install guide that takes about two
   minutes. No pre-generated LLM answers.
6. Plan 1 drops step 03 (API key). Step 04 (LLM spike) becomes "hello
   MCP": a tiny local MCP server with one tool, connected to Claude
   Code, to see how an agent calls a tool.
7. Plan 3's embedding comparison uses voyage-4-nano locally for both the
   corpus and the queries, if its licence and size check out. No Voyage
   account.

## Consequences
- Running cost: $0 beyond Karlo's existing Claude plan.
- Karlo can still see tokens and cost: `claude -p --output-format json`
  reports `total_cost_usd` and a per-model breakdown. On a subscription
  that's an estimate, not a bill.
- Eval results depend on the Claude Code version and the plan's model.
  Every result records both.
- Plan usage limits cap how many eval trials fit in a day. N stays small
  (at least 3 trials per setup).
- The portfolio shows MCP, retrieval and evals, but no direct API calls.
  Revisit in v2 or v3 (roadmap, Later): an optional step capped at $5
  for streaming, prompt caching and batches.
- CLAUDE.md now says: no paid APIs or keys, and ask before adding any
  paid service.

## Sources (checked 2026-11-21)
- Claude Code non-interactive mode, JSON output with `total_cost_usd`,
  and `--bare` needing `ANTHROPIC_API_KEY`:
  https://code.claude.com/docs/en/headless
