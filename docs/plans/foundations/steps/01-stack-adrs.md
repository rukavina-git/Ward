# 01 Stack ADRs

## Goal
Decide the stack on purpose, and understand each piece before code exists.
Product shape is fixed by ADR 0001: a local Claude Code plugin, no LLM at
runtime, a static website.

## Do
Write one ADR each (docs/adr/, template in README.md), numbered from 0002:
1. Language, runtime and repo layout. Starting point: TypeScript on Node,
   one workspace with a shared retrieval library used by the MCP server,
   the eval harness and the website. Compare with Kotlin/JVM for the
   Android analyzers.
2. Retrieval storage. Starting point: an index file shipped with the
   package, searched by brute force. Compare with Postgres + pgvector and
   a hosted vector database.
3. Embedding model. Starting point: a small local open model (for example
   bge-small-en-v1.5). Compare with an embeddings API. Check licences.
4. LLM provider and model for offline work: the spike, ingestion help, the
   eval judge, pre-generated demo answers. Choosing the model is my call.
5. Distribution and hosting: Claude Code plugin + npm package, MCP
   transport, static site host, where the source-update job runs.

Each ADR starts with a short "What is this" paragraph in plain words,
then options with cost at hobby scale. Check current prices, versions,
licences and model names from live docs, not memory.

## Not in scope
Any code. Accounts (step 03).

## Done when
- Five ADRs with Status: Proposed, reviewed by me, then set to Accepted.
- New terms added to docs/learning/glossary.md.
- roadmap.md 1.1 ticked.
