# Ward

**Ask the security standards.**

Ward is an AI assistant for web and mobile application security. It answers questions from
OWASP standards and platform security documentation, and every claim cites its source.

> Status: early development.

## What it will do

- **Answer with sources.** Every answer cites the exact requirement or section it comes from.
- **Admit when it doesn't know.** If the sources don't cover a question, Ward says so instead of guessing.
- **Work inside your tools.** Ward is also an MCP server, so you can use it from Claude Code, Cursor and other MCP clients.
- **Publish its quality scores.** A public evaluation set shows how often Ward answers correctly.

## Sources (planned)

- OWASP MASVS and MASTG (mobile)
- OWASP ASVS (web)
- OWASP Top 10 and Cheat Sheet Series
- Android platform security documentation

Ward is an independent project and is not affiliated with or endorsed by the OWASP Foundation.
Its source material is used under each source's own licence.

## Architecture (planned)

1. **Ingestion:** fetch sources on a schedule, split them into chunks, compute embeddings and store them.
2. **Retrieval:** hybrid search (keyword + vector) with reranking.
3. **Generation:** answers grounded only in the retrieved sources, with citations.
4. **Interfaces:** a web app and an MCP server on the same backend.
5. **Evals:** a fixed question set, scored automatically on every change.

## Licence

Code: MIT. Source documents keep their original licences.
