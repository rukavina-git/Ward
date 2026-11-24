---
name: council
description: Convene a council of independent subagents (AI engineer, application security expert, product owner, hiring manager, developer user, cost and operations) on an important product or architecture decision, then synthesize a recommendation. The owner decides.
disable-model-invocation: true
---

Run a council on the decision in the arguments (or the one under
discussion). Keep the final report short; I read on my phone.

## 1. Frame the question
Write a brief (max 25 lines) that every member gets verbatim:
- The decision, as 1–3 numbered questions.
- 2–5 concrete options per question, labelled (a, b, c…). Always
  include the plain, common option.
- Constraints: what is locked, what is out of scope, open facts.
- Files to read: always `PRODUCT.md` and `docs/roadmap.md`; add
  others only if they matter (ADRs, a step file, code paths, eval
  results).
Show nothing to me yet.

## 2. Convene (parallel, isolated)
Spawn all six members in one message as `general-purpose` agents.
Members never see each other's answers. Each prompt = the brief + the
member's role below + the answer format.

1. **AI engineer.** RAG and LLM systems in production: retrieval
   quality, chunking, evals, latency, model choice, what breaks at
   scale. Check current docs for anything version- or price-dependent.
2. **Application security expert.** OWASP MASVS/ASVS, mobile and web
   security. Is the answer correct and precise enough for an audit?
   Also the app's own security: prompt injection, data exposure.
3. **Product owner.** PRODUCT.md, roadmap order, what earns its place
   now, what can wait, what makes the demo convincing in one minute.
4. **Hiring manager (persona).** Engineering manager at a fintech,
   looking at Karlo's portfolio for 3 minutes. What would impress you,
   what looks like a tutorial copy? Answer in first person.
5. **Developer user (persona).** Android developer, security audit
   next month, uses Claude Code daily. Would you use this, and how?
   First person.
6. **Cost and operations.** Hosting and API cost at hobby scale, abuse
   of a public demo, rate limits, how much maintenance it needs.

Answer format for every member (max 200 words):
```
VOTE: Q1 <option>, Q2 <option>…
WHY: 2–4 bullets
RISK of my pick: 1 bullet
I'D VETO: an option I find unacceptable, or "none", and why
IDEA: one thing nobody listed, or "none"
```

## 3. Synthesize (you, as chair)
- Vote table per question (member × option).
- Where they agree, where they split and why.
- Vetoes and new ideas worth keeping.
- Your recommendation, with the AI engineer weighted highest on
  architecture, the security expert on answer quality, and the product
  owner on scope.
- What only the owner can decide.

## 4. Record
Write the minutes to `docs/council/YYYY-MM-DD-<topic>.md`: brief,
each member's answer verbatim, the synthesis. Leave the decision line
as "Owner: pending". After the owner decides, fill it in, and write an
ADR in `docs/adr/` if it changes architecture.

## 5. Report (max 12 lines)
Votes, recommendation, open choices for me. Link the minutes file.
