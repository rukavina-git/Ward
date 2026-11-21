# Hello MCP: watching an agent use a tool

Step 1.3, 2026-11-21. A tiny MCP server (`packages/mcp`) with one tool,
`hello`, started by Claude Code from the repo-root `.mcp.json`. No model
runs inside the server; Claude decides when to call it.

## 1. What Claude is shown: the tool schema

When Claude Code connects, it asks the server "what tools do you have?"
(`tools/list`). This is the whole answer. The model never sees our code,
only these words:

```json
{
  "name": "hello",
  "title": "Say hello from Ward",
  "description": "Greets a person by name and reports whether Ward, the Android pre-publish checker, is built yet. Use it when the user asks Ward to say hello or asks whether Ward is working.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100,
        "description": "The name of the person to greet, e.g. 'Karlo'."
      }
    },
    "required": ["name"]
  }
}
```

We write the input as a zod schema in TypeScript; the SDK turns it into
this JSON Schema. The same schema checks the arguments before our code
runs: `{"name": ""}` comes back as a tool error, not a crash.

## 2. What goes over the wire: JSON-RPC

Each line is one JSON message on the server's stdin (→) or stdout (←).
This is a real capture of the SDK client calling the tool:

```
→ {"method":"initialize","params":{"protocolVersion":"2025-11-25",...},"jsonrpc":"2.0","id":0}
→ {"jsonrpc":"2.0","method":"notifications/initialized"}
→ {"method":"tools/call","params":{"name":"hello","arguments":{"name":"Karlo"}},"jsonrpc":"2.0","id":1}
← {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"Hello, Karlo. Ward is not built yet."}]}}
```

The `id` pairs a reply with its request. A message without an `id` is a
notification: no reply expected. Because stdout is this channel, the
server logs only to stderr, and ESLint now fails on `console.log` in
`packages/mcp`.

## 3. Claude using it

Three headless runs (`claude -p ... --output-format stream-json`), same
question each time: "I'm Karlo. Is Ward working yet?" Only the `ward`
server was loaded (`--strict-mcp-config`). Model: Opus 5.5, on my plan.

### Run 1: clear description

1. Startup: `ward` connected, 24 tools available, one of them
   `mcp__ward__hello` (Claude Code prefixes MCP tools with
   `mcp__<server>__`).
2. Claude ran a Bash command to look at the repo (git diff, roadmap).
3. It called ToolSearch to load the `hello` schema. Claude Code defers MCP
   tools: at first the model sees only their names, and loads the full
   schema when it wants one. So the name is the first thing it reads.
4. Tool call: `mcp__ward__hello` with `{"name": "Karlo"}`.
5. Result: `Hello, Karlo. Ward is not built yet.`
6. Answer: "No, Ward doesn't check apps yet. But the hello MCP server from
   step 1.3 does work. I just called the `ward` MCP tool `hello` with
   your name, and it answered: Hello, Karlo. Ward is not built yet." Then
   it summed up the roadmap.

4 turns, 9 s.

### Run 2: vague description

Same server, description changed to "Does a thing." Claude still called
`hello` with `{"name": "Karlo"}`, and even pointed out that the
description should say what the tool does. The name `hello`, the server
name `ward` and the repo context were enough.

Side effect: this session ran `npm test` on its own, which rebuilt
`dist/` and quietly put the clear description back for later runs. Lesson:
when running an experiment through an agent, take away tools it doesn't
need.

### Run 3: vague name and description, no built-in tools

Tool renamed to `tool_a`, description "Does a thing.", and `--tools ""`
so the only tool was `mcp__ward__tool_a`. Claude said "I'll call Ward's
MCP tool to check" and called it with `{"name": "Karlo"}`. With nothing
else to choose from and a server called `ward`, the server name carried
it.

2 turns, 7 s.

## 4. What I learned

- The model picks a tool only from its name, description and schema.
  Here that was easy: one tool, and the question named the server.
- The description matters when tools compete. In a real session Ward sits
  next to dozens of other tools, so plan 4's tool names and descriptions
  have to say precisely what each one does and when to use it.
- Names come first: with deferred loading, Claude sees only
  `mcp__ward__hello` until it loads the schema.
- One run per setup is an anecdote, not a measurement. Plan 2's evals are
  how we'll measure.
- `total_cost_usd` in the JSON output (about $0.19, $0.21, $0.06) is
  Claude Code's estimate of what the tokens would cost on the API. On my
  plan nothing is billed; it uses plan quota (ADR 0007).

## 5. Interactive session

The project server first shows as "Pending approval" in
`claude mcp list`. In a fresh `claude` session (Opus 5.5, auto mode), I
approved `ward` and asked "im karlo. is ward working".

- Claude Code summed it up as "Called ward, ran 2 shell commands": it
  called `hello` with my name and ran the repo's checks.
- Answer: "Yes, Ward works as far as it's been built, which so far is
  only step 03, the hello MCP server. I called its hello tool from here
  and it replied: 'Hello, Karlo. Ward is not built yet.' ... That reply
  is the placeholder text; the real tools come in plan 4."
- It also found a real problem: approving the server writes
  `.claude/settings.local.json`, which Prettier then checked and failed.
  The file is in my global git ignore, which Prettier doesn't read. Fixed
  by adding it to `.prettierignore`.
- Afterwards `claude mcp list` shows `ward: node
  packages/mcp/dist/index.js - ✔ Connected`.

Same behaviour as the headless runs: no prompting, it found the tool from
the question and passed my name in.
