# 07 Use Ward from Claude Code

## Goal
First real use of Ward by an agent: Claude Code with Ward's MCP tools on
one held-out case, the same task and model as the gate (step 02), so the
two runs can be compared. Keep the unedited transcript and log every
Ward call, search queries included.

## Do
1. Eval arm `ward` in `evals/src/setups.ts`: no plugin, one MCP server
   `ward` (node on the built `packages/mcp/dist/index.js`, absolute
   path). Passed with `--mcp-config` beside `--strict-mcp-config`, so it
   is the only server. Ward's 7 tools (`mcp__ward__*`) are added to
   `--allowedTools`; built-in tools, prompt, schema and isolation stay
   as in every other arm. The task prompt is unchanged (no prompt
   change): the agent finds Ward through the tools' own descriptions.
2. Isolation for the arm: the init message must list exactly the arm's
   MCP server, connected, and exactly its tools. A Ward tool's
   `projectRoot` counts as a read: outside the copy it fails the run.
3. meta.json gets `mcp` (server, Ward version) and `wardCalls`: each
   Ward call in order with its tool, input (temp path redacted) and
   whether it errored; `searchQueries` lists the search queries. Also
   the transcript's sha256, so the local transcript provably stays as
   written.
4. Held-out runs accept `--setup ward` too. `eval:score-heldout` keeps
   `gate.md` to the `alone` runs (the gate is frozen) and writes the
   same table for any other arm to `<arm>.md`.
5. One live run (plan usage, Karlo picks the case): Sonnet 5.5, trial 1,
   parent commit, like the gate. Score it, propose labels, compare with
   the `alone` run of the same case.

## Not in scope
- A Ward skill or plugin arm (plan 5: the report).
- More cases, trials or models. Fixing step 05/06 reviewer SHOULDs.
- Changing the task prompt, the bar or the answer key.

## Eval
No retrieval, chunking, prompt or model change. The one run is the
measurement itself: record it in docs/measurements.md.

## Cost
Plan usage only: one run, about a minute (gate runs took 21 to 51 s).
The `dependencies` tool downloads OSV data (about 11 MB, public).

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass; CI green.
- Tests: the `ward` arm's flags; isolation fails a second MCP server, a
  missing or failed `ward` server and a `projectRoot` outside the copy;
  Ward calls and search queries come out of a transcript.
- One ok `ward` run, labels proposed, result and Ward calls in
  measurements.md and progress.md.
