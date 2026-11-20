# Roadmap

Legend: [x] done · [ ] to do · (me) manual, done by me · (deferred)
waiting on me

Each plan teaches one part of AI engineering. The "Learn" line says which.

## Done

- [x] Repo, README, licence
- [x] Claude setup: CLAUDE.md, /step, /explain, /council, reviewer, guard hook

## Plan 1: foundations
Learn: how an LLM API call works, tokens, streaming, system prompts, cost.
- [ ] 1.1 Stack ADRs: framework, database, embedding provider, LLM, hosting
- [ ] 1.2 Scaffold the app, lint, typecheck, CI
- [ ] 1.3 (me) Accounts and API keys (LLM, embeddings, database)
- [ ] 1.4 Plain chat with streaming (no retrieval yet)
- [ ] 1.5 (me) Deploy to ward.rukavina.app

## Plan 2: first RAG
Learn: chunking, embeddings, vector search, grounded prompts, citations.
- [ ] Ingest MASVS (source file, version, licence → docs/sources.md)
- [ ] Chunk by requirement, embed, store in a vector database
- [ ] Retrieve top matches for a question
- [ ] Answer only from sources, with citations; "I don't know" path

## Plan 3: evals
Learn: how to measure AI quality, and why it matters most.
- [ ] (me) Write ~40 questions with expected answers and sources
- [ ] Scoring script: retrieval hit rate, answer correctness, citation accuracy
- [ ] Baseline scores; public eval page

## Plan 4: better retrieval
Learn: why plain vector search fails and how to fix it.
- [ ] Add MASTG
- [ ] Hybrid search (keyword + vector)
- [ ] Reranking
- [ ] Platform versions on chunks; deprecated content
- [ ] Re-run evals after each change

## Plan 5: MCP server
Learn: tool use, MCP, how AI assistants call external tools.
- [ ] MCP server on the same backend (search, get requirement)
- [ ] Docs: connect from Claude Code and Cursor

## Plan 6: hardening
Learn: running AI in production.
- [ ] Prompt-injection defences and tests
- [ ] Rate limits, cost cap, usage logging
- [ ] Scheduled re-ingestion when sources change

## Plan 7: case study
- [ ] Compare with a general assistant on the eval set
- [ ] Case study page on rukavina.app

## Later
- Android security docs, OWASP ASVS (web), Top 10, Cheat Sheet Series
- Agent that checks a project against MASVS
