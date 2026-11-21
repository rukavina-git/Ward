# 03 Hello MCP

## Goal
See how an agent uses a tool, at the smallest possible size, before Ward
has any real tools. One tiny local MCP server with one tool, started by
Claude Code from the repo-root `.mcp.json`. Watch Claude find the tool,
decide to call it, and use the result.

## Do
1. `packages/mcp`: a stdio MCP server built on the MCP TypeScript SDK v2
   (`@modelcontextprotocol/server`). Check the current docs for the stdio
   API and the licence first.
2. One tool, `hello`: takes a name and returns `hello()` from
   `@ward/core`. That also proves one workspace package can use another.
   Give it a clear name, description and input schema, because the model
   picks a tool by reading those.
3. Logs go to stderr only. In stdio, stdout carries the protocol, so any
   stray `console.log` breaks the connection.
4. Tests: a unit test for the tool handler, and one test that starts the
   built server over stdio with the SDK client, lists the tools and calls
   `hello`. No model is involved.
5. Repo-root `.mcp.json` starts the built server. Then, in a fresh Claude
   Code session, I approve the server and ask something that needs the
   tool. Save what happened (tool list, the call, the result, Claude's
   answer) to `docs/learning/hello-mcp.md`, explained in plain words.
6. Experiment: make the description vague, and see whether Claude still
   picks the tool. Write down what changed.

## Not in scope
- Real Ward tools, retrieval or analyzers (plans 3 and 4).
- The plugin's own `.mcp.json` and npx launch (plan 5).
- Publishing to npm.

## Done when
- `claude mcp list` shows the server connected.
- Claude calls `hello` in a real session, and `docs/learning/hello-mcp.md`
  shows the exchange.
- The unit test and the stdio test pass, all six npm scripts pass, and
  CI is green.
- Glossary has: tool call, tool schema, JSON-RPC. roadmap 1.3 ticked.
