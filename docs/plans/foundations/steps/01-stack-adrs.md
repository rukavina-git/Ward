# 01 Stack ADRs

## Goal
Decide the stack on purpose, and understand each piece before code exists.

## Do
Write one ADR each (docs/adr/, template in README.md):
1. App framework (starting point: Next.js + TypeScript, which I know).
2. Database and vector store (starting point: Postgres + pgvector;
   compare with a dedicated vector database).
3. Embedding provider and model.
4. LLM provider and model.
5. Hosting for the app, and where the scheduled ingestion job runs.

Each ADR starts with a short "What is this" paragraph in plain words,
then options with cost at hobby scale. Check current prices and model
names from live docs, not memory.

## Not in scope
Any code. Accounts (step 03).

## Done when
- Five ADRs with Status: Proposed, reviewed by me, then set to Accepted.
- New terms added to docs/learning/glossary.md.
- roadmap.md 1.1 ticked.
