# 5. LLM for offline work

Date: 2026-11-21
Status: Accepted

## What is this
The LLM that Ward's own scripts call. Ward makes no LLM calls at runtime
(ADR 0001); the user's agent does the reasoning. Karlo's scripts still
need one, offline, for a few jobs.

## Context
Uses:
- the plan 1 spike (learning tokens, streaming and cost)
- ingestion help: drafting check cards from MASTG, reviewed by hand
- the eval judge: grading free-text findings against the answer key
- pre-generated demo answers for the eval page

Constraints:
- Budget: about $5 of prepaid credit, auto-reload off.
- CLAUDE.md: choosing the model is the owner's decision, and model ids
  come from current docs.
- The eval judge reads output from agent runs on a fixture app that
  contains planted prompt injections. That input is untrusted.

## Options
Prices are per 1M tokens, input / output, from the claude-api skill
(cached 2026-11-03).

- **Claude Haiku 5.5 (`claude-haiku-5-5`):** $0.10 / $0.50 for prompts up
  to 100K tokens, $0.50 / $2.50 beyond.
  - One RAG-sized call (4k tokens in, 1k out) costs about $0.001.
  - One pass over the ~1M-token corpus with ~300k tokens of output costs
    about $0.25.
- **Claude Sonnet 5.5 (`claude-sonnet-5-5`):** $2 / $10.
  - The same corpus pass costs about $5, the whole budget.
- **Claude Opus 5.5 (`claude-opus-5-5`):** $4 / $20. The claude-api skill
  uses it as the default; here it's the highest quality per call and the
  most expensive.
- **Message Batches API:** 50% off any of the above, for jobs that can
  wait: ingestion passes, eval judging.
- **Other providers (OpenAI, Gemini):** rejected. Ward's users are Claude
  Code users, one provider keeps the code simple, and the claude-api skill
  keeps model ids and prices current.

## Decision (owner chose Haiku 5.5 on 2026-11-21)
1. Haiku 5.5 is the default for every offline API call. Use Batches for
   bulk jobs.
2. Heavy one-off drafting (check cards) runs in Claude Code on Karlo's
   plan, not on the API, and is reviewed by hand.
3. The eval judge moves up to Sonnet 5.5 only if a check shows Haiku
   disagrees with Karlo's own grading on a sample.
4. Agent eval runs (plans 2 and 6) use Claude Code on Karlo's plan, not
   the API.
5. The judge's input is treated as untrusted data:
   - It's passed as clearly marked data, never as instructions.
   - The judge's verdicts are checked against the answer key in code.
   - Citation checks are done by code, not by the judge.
6. Demo answers go through Ward's retrieval. Their citations are built
   from chunk metadata (ADR 0003), never written by the model. If nothing
   relevant is found, the answer says it doesn't know.

## Consequences
- The $5 lasts: the spike plus several ingestion and judge passes cost
  well under $1.
- **Refusals:** safety classifiers may decline some security content. Code
  must check `stop_reason` for `"refusal"` and log it. Haiku 5.5 has no
  server-side fallback on refusal.
- **Effort:** Haiku 5.5's default effort level is `medium`, so scripts set
  it explicitly.
- Eval results and pre-generated answers always name the model and date.
- Model ids and SDK calls come from the claude-api skill at the time the
  code is written, not from this ADR.

## Sources (checked 2026-11-21)
- Model ids, prices, Batches discount, refusal and effort behaviour: the
  claude-api skill (model table cached 2026-11-03).
