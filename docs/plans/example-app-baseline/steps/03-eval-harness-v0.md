# 03 Eval harness v0

## Goal
Build the machinery that turns "run an agent on Penny Jar" into numbers:
a findings format every setup must return, one task prompt, a runner
that runs `claude -p` on a fresh copy of an app, and a scorer that
compares the findings with the answer key. Prove it end to end with one
trial of Claude Code alone on each app. No baseline numbers yet (step
04): this step makes sure the numbers step 04 produces can be trusted.

## Do
1. Workspace. The harness is TypeScript in `evals/` (ADR 0002 puts
   scoring scripts there), as a workspace package `@ward/evals` built
   like the others. Results go under `evals/results/`.
2. Findings format, v0. The agent returns JSON through Claude Code's
   structured output (`--json-schema`), so nothing has to be pulled out
   of free text and the agent needs no write access. Per finding:
   `title`, `category` (security, privacy, play), `severity`, `verdict`
   (`FAIL`, `NEEDS DYNAMIC`, `MANUAL`), `masvs` and `maswe` (IDs, may be
   empty), `locations` (file relative to the app root, `line`, optional
   `endLine`; a cross-file finding lists several) and `explanation`.
   Top level: `findings` and `inspected` (files looked at). The schema
   file lives in `prompts/` (its descriptions are read by the model, so
   it's prompt text) and is the single source: the scorer validates
   against the same file. Not Ward's report schema; plan 5 may align
   them.
3. Task prompt, `prompts/eval-task.md`. Neutral and realistic: "I'm
   about to publish this app on Google Play. Is it ready? Check
   security, privacy and Play requirements." Asks for file and line on
   every finding, IDs only where it knows them. No hint of what's
   planted. Every arm gets the same prompt; its hash goes in each
   result.
4. Runner, `npm run eval:run -- --app planted|clean --setup alone
   --model <id> --trial <n>`:
   - Copy only tracked files (`git archive` of the fixture folder) into
     a fresh temp directory outside the repo, leaf name `penny-jar` for
     both apps. No `.git`, no `evals/`, no docs, no build output.
   - Run `claude -p` there via spawn with an argument list (no shell).
     Never `--bare`. Tools: Read, Grep and Glob only. WebFetch and
     WebSearch off: Ward's repo is on GitHub with the answer key in it.
     Setup `alone` turns off CLAUDE.md, skills, plugins, MCP servers,
     hooks and auto memory (check `--safe-mode` and friends against the
     current headless docs; confirm in the transcript's init message).
     No session saved. A time limit; hitting it is recorded.
   - Model comes from `--model` (required): Karlo picks it.
   - Writes `evals/results/example-app/<date>-<setup>-<app>-t<n>/`:
     `meta.json` (date, Claude Code version, model as reported, setup,
     trial, app, key version, fixture commit, prompt and schema hashes,
     flags, duration, turns, tokens, estimated cost, errors) and
     `findings.json` (the agent's output, as returned). The full
     transcript stays local (gitignored) until a trace viewer exists.
   - Output that is missing or fails the schema marks the run failed.
     It is never scored as "no findings".
   - Setups live in one table in code, so step 04 adds rows, not code.
5. Scorer, `npm run eval:score -- <result dir>`:
   - Resolves each anchor to a line; fails if an anchor occurs zero or
     more than once (issues and shared decoys in the planted app, all
     decoys in the twin).
   - Location match: same file, and the finding's lines within 5 of the
     anchor line. Type match: shares a MASWE ID or MASVS control.
   - Location and type match one item: matched automatically (issue →
     true positive, decoy → false alarm). Anything else (location
     without type, ties, other places, every unmatched twin finding)
     goes to a hand-grading file, `grades.json`, pre-filled with the
     candidates. Karlo labels each: an item ID, `false-alarm`,
     `real-unplanted` (a key candidate) or `generic` (hardening advice).
   - Chains: one finding counts for every item it matches, so a finding
     citing both EA-12 and EA-13 locations scores both.
   - Writes `score.json` and prints a short summary. Planted app:
     issues found / 23, misses (false passes) by ID, by difficulty and
     MASVS group, decoy hits, other false alarms, duplicates, precision.
     Twin: false alarms and decoy hits. Both: citations whose file
     doesn't exist or whose line is past the end of the file. Any
     ungraded finding marks the score provisional.
   - Agent text is data: parsed and validated, never executed; control
     characters are stripped before printing.
6. Tests (Vitest, synthetic findings): anchor resolution, window edges,
   type match, ties, decoy hit, chain, duplicates, twin, hand grades,
   provisional, invalid output, bad citations, runner arguments (no
   `--bare`, web tools off) and the copy (no `.git`, no `evals/`). One
   test resolves every anchor of the real key against the real
   fixtures, replacing step 02's one-off check, so CI guards it.
7. Smoke test: one trial of `alone` on each app. Hand-grade, score,
   read both by eye. Commit them marked `smoke`; step 04 doesn't count
   them. `evals/README.md` gets the findings format, the matching
   rules and how to run.

## Not in scope
- The other setups (checklist skill, OWASP plugin) and N ≥ 3 trials,
  averages and spread (step 04).
- Running Gradle in the eval. With read-only tools the agent can't
  build, so EA-12 must be found from the library's manifest. Plan 6
  revisits this for all arms at once.
- Checking that cited MASVS and MASWE IDs exist (needs plan 3's index).
- Key v3 wording fixes from the gotchas (only if the scorer needs them).
- Trace viewer, eval page, injection suite.

## Done when
- `npm run lint`, `npm run format:check`, `npm run typecheck` and
  `npm test` pass, and CI is green.
- The real-key anchor test passes for both apps.
- Two smoke runs exist with `meta.json`, `findings.json`, `grades.json`
  and `score.json`, no ungraded findings, and an init message showing
  no plugins, MCP servers or CLAUDE.md.
- `grep` of the results and the copies finds no answer-key text and no
  home-directory paths.
- Glossary has: eval harness, trial, structured output, hand grading,
  hallucinated citation. Roadmap 2.3 ticked.
