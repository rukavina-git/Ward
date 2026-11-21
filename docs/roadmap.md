# Roadmap

Legend: [x] done · [ ] to do · (me) manual, done by me · (deferred)
waiting on me

Each plan teaches one part of AI engineering. The "Learn" line says which.
Rewritten after the council of 2026-11-21
(docs/council/2026-11-21-product-scope.md).

## Done

- [x] Repo, README, licence
- [x] Claude setup: CLAUDE.md, /step, /explain, /council, reviewer, guard hook
- [x] Product council: Ward is a local pre-publish check plugin (ADR 0001)

## Plan 1: foundations
Learn: how an LLM API call works, tokens, streaming, system prompts, cost.
- [ ] 1.1 Stack ADRs: language and layout, retrieval storage, embeddings,
      LLM for offline work, distribution and site hosting
- [ ] 1.2 Scaffold: TypeScript workspace, lint, typecheck, tests, CI
- [ ] 1.3 (me) Anthropic API key, $5 prepaid, auto-reload off
- [ ] 1.4 LLM spike: one streaming call from a script, prompt from
      prompts/, tokens and cost logged

## Plan 2: example app and baseline
Learn: what an eval is, and why you measure before you build.
- [ ] Example Kotlin app with planted security and privacy issues, plus a
      clean twin; answer key outside the app folder
- [ ] Scoring script v0: findings vs answer key (missed issues, false passes)
- [ ] Baseline: Claude Code alone, + plain checklist skill, + OWASP's
      plugin (small N, on my Claude plan)

## Plan 3: knowledge base (first RAG)
Learn: chunking, embeddings, keyword and vector search, retrieval evals.
- [ ] Ingest MASVS and MASTG by ID (control → MASWE → test → demo);
      docs/sources.md
- [ ] Chunk, embed locally, store as an index file
- [ ] Keyword + vector search, built by hand
- [ ] Retrieval eval: 40–60 queries with expected IDs (recall@5, MRR)

## Plan 4: MCP server and analyzers
Learn: tool use, MCP, how AI assistants call external tools.
- [ ] Local MCP server (stdio): checklist, get check, search
- [ ] Analyzers in plain code: merged manifest, network security config,
      targetSdk, dependencies
- [ ] Use Ward from Claude Code while building it (.mcp.json)

## Plan 5: the check
Learn: agent workflows, skills, structured output.
- [ ] Skill + report JSON schema; /ward:check
- [ ] Read-only HTML report
- [ ] Citation checker: cited IDs, file:line and quotes must exist
- [ ] Package as a Claude Code plugin; run it on my own app

## Plan 6: proof
Learn: end-to-end evals for agents, and AI security.
- [ ] End-to-end eval, all four setups, at least 3 trials, spread reported
- [ ] Prompt-injection suite: hostile comments and files in the checked app
- [ ] Retrieval fixes driven by failures (reranking etc.), evals before
      and after

## Plan 7: privacy and GDPR module
Learn: adding a knowledge domain, and where model judgement is needed.
- [ ] Sources and licences (GDPR, Android privacy docs, Data Safety)
- [ ] Checks and analyzers: permissions, SDK list, consent before
      analytics, Data Safety CSV diff
- [ ] Planted issues in the example app; evals for the module

## Plan 8: triage UI
Learn: local tools that are safe by design.
- [ ] /ward:review: local report UI (localhost only, random token), bulk
      fix / accept / skip
- [ ] .ward/decisions.json; reruns show new or changed items; /ward:fix

## Plan 9: website and v1 release
- [ ] Static site: landing, video, install guide, in-browser search,
      sample report, eval page with traces
- [ ] (me) Deploy, DNS for ward.rukavina.app
- [ ] Publish the plugin (npm, trusted publishing); weekly source-update job
- [ ] Case study on rukavina.app

## Later
- Play policy module (plain-code checks), licences (existing tools),
  targetSdk bump module
- Auditor and pentester pack
- Remote MCP endpoint
- iOS; web (OWASP ASVS)
