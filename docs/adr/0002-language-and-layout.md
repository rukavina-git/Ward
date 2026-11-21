# 2. Language, runtime and repo layout

Date: 2026-11-21
Status: Accepted

## What is this
The language Ward is written in, the program that runs it on a user's
machine (the runtime), and how the code is split into packages inside one
repo.

## Context
Ward has seven parts (ADR 0001):
1. A retrieval library: the index format plus keyword and vector search.
2. A local MCP server that Claude Code starts as a child process.
3. Analyzers that read Android project facts: merged manifest, network
   security config, targetSdk, dependencies.
4. Ingestion scripts that turn MASVS/MASTG into chunks and an index.
5. The report: a JSON schema, an HTML view, and later the local triage UI.
6. An eval harness.
7. A static website with search running in the browser.

The retrieval library is used by the MCP server, the evals and the
browser. If all three share one implementation, they all return identical
results, and an eval score means the same thing everywhere.

Users are Android developers running Claude Code. Karlo knows TypeScript
(web) and Kotlin (Android).

Cost is $0 for every option below: all the languages, runtimes and SDKs
are free and open source.

## Options
- **TypeScript on Node, one workspace.**
  - Pro: one language for the browser, the MCP server, the report UI and
    the scripts.
  - Pro: the official MCP TypeScript SDK is MIT-licensed. Its v2 docs
    describe support for the 2026-07-28 spec; whether v2 is stable or still
    beta is checked at step 02.
  - Pro: Transformers.js runs embedding models in both Node and the
    browser. The Claude API has an official TypeScript SDK.
  - Pro: npm is the usual way MCP servers are distributed.
  - Con: users need Node installed. Claude Code's native installer doesn't
    bring it.
  - Con: TypeScript can't evaluate `build.gradle.kts` files, because they're
    Kotlin code, not data.
- **Kotlin on the JVM for everything.**
  - Pro: Karlo's Android language, and every Android developer already has
    a JDK.
  - Con: the official MCP Kotlin SDK is still pre-1.0 (0.15.0 on Maven
    Central).
  - Con: the browser search would need a second implementation, so two
    copies of search could drift apart.
  - Con: slower startup, and a heavier runtime for embedding models.
- **Hybrid: TypeScript for core, MCP, report and site; Kotlin for the
  analyzers.**
  - Pro: the analyzers could use Android's own tooling (the manifest
    merger and Gradle's Tooling API) and read the real, resolved project
    rather than guessing from files.
  - Pro: search is still written once.
  - Con: two languages and two build systems in the repo.
  - Con: the MCP server has to start a JVM process for analyzer calls.
  - Con: more to package and release.
- **Python.**
  - Pro: the richest ML ecosystem and an official MCP SDK.
  - Con: no browser story, so search would again be written twice.
  - Con: not a language Karlo uses daily.

## Decision
TypeScript on Node.

**Analyzers:** they don't parse Gradle build scripts. They read Gradle's
outputs instead: the merged manifest and the dependency report. The skill
asks the user's agent to produce them by running Gradle tasks. If those
outputs prove insufficient in plan 4, the hybrid (Kotlin analyzers) is the
fallback.

**Node version:** Node 26, which entered Active LTS on 2026-10-28 according
to the Node.js schedule. One source still showed it as "Current", so
confirm on nodejs.org at step 02.

**Planned layout:**

```
.claude-plugin/marketplace.json   lists the plugin (repo = marketplace)
plugin/             the Claude Code plugin: plugin.json, skills, .mcp.json
packages/core       index format, chunk types, keyword + vector search
packages/mcp        MCP server and its tools
packages/analyzers  readers for Gradle outputs and Android config files
packages/report     report JSON schema, HTML view, later the triage UI
packages/ingest     source download, chunking, embedding, index build
evals/              questions, answer keys, scoring scripts, results
fixtures/           example Kotlin app with planted issues + clean twin
site/               static website
prompts/            prompts for offline LLM calls
docs/               roadmap, plans, ADRs, council minutes, learning notes
```

- The plugin lives in `plugin/`, so its `.mcp.json` doesn't collide with
  the repo-root `.mcp.json` that Karlo uses while developing (plan 4).
- The fixture's answer key lives under `evals/`, never under `fixtures/`.
- Tooling (package manager, lint, tests) is chosen in step 02.

## Consequences
- One search implementation everywhere, so the browser demo, the MCP
  server and the evals can't drift apart.
- The install guide must list Node as a prerequisite. If that turns out
  to hurt adoption, revisit at plan 9 with a single-file binary (one per
  platform).
- Reading Gradle outputs means a Gradle build step before a check. The
  skill handles it, and findings say which build variant they came from.

## Sources (checked 2026-11-21)
- MCP TypeScript SDK docs: https://ts.sdk.modelcontextprotocol.io/
- MCP Kotlin SDK: https://central.sonatype.com/artifact/io.modelcontextprotocol/kotlin-sdk
- Node.js release schedule: https://nodejs.org/en/about/previous-releases,
  https://www.devx.com/coding/nodejs-26-lts-new-features-release-date/
