# Roadmap

Legend: [x] done · [ ] to do · (me) manual, done by me · (deferred)
waiting on me

Each plan teaches one part of AI engineering. The "Learn" line says which.
Rewritten after the council of 2026-11-21
(docs/council/2026-11-21-product-scope.md). Plans 3 to 6 revised after
the baseline council of 2026-11-22
(docs/council/2026-11-22-baseline-scope.md, ADR 0009).

## Done

- [x] Repo, README, licence
- [x] Claude setup: CLAUDE.md, /step, /explain, /council, reviewer, guard hook
- [x] Product council: Ward is a local pre-publish check plugin (ADR 0001)
- [x] No paid APIs: LLM work runs in Claude Code on my plan (ADR 0007)
- [x] Baseline council: claim precision and evidence, not completeness
      (ADR 0009)

## Any time
- [ ] (me) Short post on rukavina.app: the baseline, "I measured before
      building". Not blocking.

## Plan 1: foundations
Learn: how an agent calls a tool (MCP), and a repo set up for AI work.
- [x] 1.1 Stack ADRs: language and layout, retrieval storage, embeddings,
      LLM for offline work, distribution and site hosting
- [x] 1.2 Scaffold: TypeScript workspace, lint, typecheck, tests, CI
- [x] 1.3 Hello MCP: a tiny local MCP server with one tool, connected to
      Claude Code; watch the agent call it

## Plan 2: example app and baseline
Learn: what an eval is, and why you measure before you build.
- [x] 2.1 Issue list and answer key: planted security and privacy issues
      plus decoys, mapped to MASVS and MASWE
- [x] 2.2 Example Kotlin app with the planted issues, plus a clean twin;
      answer key outside the app folder
- [x] 2.3 Eval harness v0: findings format, task prompt, runner, scoring
      script (missed issues, false passes)
- [x] 2.4 Baseline: Claude Code alone, + plain checklist skill, + OWASP's
      plugin (small N, on my Claude plan)

## Plan 3: knowledge base (first RAG)
Learn: chunking, keyword and vector search, embeddings, retrieval evals,
and deciding by measurement.
- [ ] Ingest MASVS and MASTG by ID (control → MASWE → test → demo);
      docs/sources.md
- [ ] Chunk and store as an index file; exact ID lookup over the graph
- [ ] Retrieval eval: 40–60 queries with expected IDs (recall@5, MRR),
      seeded from the baseline runs' findings
- [ ] BM25 keyword search, built by hand
- [ ] Embeddings and vector search, built by hand, compared with BM25 on
      the retrieval eval; shipped only if they win (ADR 0009)

## Plan 4: MCP server and analyzers
Learn: tool use, MCP, how AI assistants call external tools.
- [ ] Held-out eval set, frozen before any check is written: real
      security-fix commits from open-source Android apps (absences,
      dependency CVEs, config), decoys toward 30, a "defensible" label.
      Run Claude Code alone on it at once, against a bar written first;
      if it aces this too, rethink before building analyzers
- [ ] Local MCP server (stdio): checklist, get check, search
- [ ] Analyzers in plain code: merged manifest, network security config,
      targetSdk, dependencies against an offline OSV snapshot
- [ ] Use Ward from Claude Code while building it (.mcp.json)

## Plan 5: the check
Learn: agent workflows, skills, structured output.
- [ ] Skill + report JSON schema (a verdict with evidence for every
      control in scope); /ward:check
- [ ] Must-exist checks: account deletion, privacy policy link,
      data-deletion URL
- [ ] Read-only HTML report
- [ ] Citation checker: cited IDs, file:line and quotes must exist
- [ ] Package as a Claude Code plugin; run it on my own app

## Plan 6: proof
Learn: end-to-end evals for agents, and AI security.
- [ ] End-to-end eval: all four setups plus analyzers only, on the example
      app and the held-out set, at least 3 trials, spread reported; false
      passes next to false alarms, share of controls with a verdict
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
- [ ] Static site: landing, demo video or slideshow of a real run,
      2-minute install guide, in-browser search, sample report, eval page
      with traces
- [ ] (me) Deploy, DNS for ward.rukavina.app
- [ ] Publish the plugin (npm, trusted publishing); weekly source-update job
- [ ] Case study on rukavina.app

## Later
- v2 or v3: direct Claude API work (streaming, prompt caching, batches),
  optional and capped at $5 (ADR 0007)
- Play policy module (plain-code checks), licences (existing tools),
  targetSdk bump module
- Auditor and pentester pack
- Remote MCP endpoint
- iOS; web (OWASP ASVS)
