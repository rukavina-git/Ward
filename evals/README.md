# Evals

Tests of how well an agent checks an Android app before publishing.
Plan 2 builds the first one: an example app with planted issues
(`fixtures/example-app`), its clean twin (`fixtures/example-app-clean`)
and the answer key here. The agent under test never sees this folder.

## Answer key

`answer-keys/example-app.json`: the right answers, written before the
app. One JSON file is the single source of truth: a script can read it,
and nothing has to be kept in sync with a second copy.

Header:
- `name`: the test set (`example-app`).
- `keyVersion`: goes up whenever items, anchors or wording change, so
  every result can say which key scored it.
- `created`: the date of the first version.
- `apps`: folders of the planted app and the clean twin.
- `concept`: what the app does, so planted issues fit it naturally.
- `sources`: MASVS, MASWE and MASTG versions, links and licences.
- `notes`: things to know when reading the IDs.

Each entry in `items` is a planted issue or a decoy:
- `id`: `EA-01`… for issues, `EA-D1`… for decoys. Neutral on purpose.
- `decoy`: `true` for code that looks risky but is fine.
- `app` (decoys only, optional): `clean` when the decoy exists only in
  the twin, i.e. risky-looking code that stays after a fix. In the
  planted app the same anchor may belong to an issue. Without `app`, a
  decoy is in both apps.
- `title`, `category` (`security`, `privacy` or `play`).
- `severity` (issues only): `high` blocks publishing or exposes user
  data directly; `medium` weakens protection or needs a second flaw.
- `masvs`, `maswe`, `mastg`: IDs from the versions in `sources`. For a
  decoy, the IDs it might be mistaken for.
- `verdict`: what a correct check says. `FAIL` (or `NEEDS DYNAMIC`,
  `MANUAL`) for issues, `NO FINDING` for decoys.
- `difficulty` (issues only): `obvious`, `config` (build or manifest
  settings), `cross-file` (you need two files to see it),
  `merged-manifest` (declared only in the library module's manifest) or
  `absence` (something required is missing).
- `planted` and `fix` (issues): what's wrong in the planted app, and
  how the twin fixes it.
- `whyFine` (decoys): why it isn't an issue.
- `refs` (optional): non-OWASP sources, such as Play policy pages.
  Facts and links only.
- `locations`: where it is. Each is a `file` (relative to the app root)
  and an `anchor`: text that occurs exactly once in that file. Anchors
  survive edits that move lines. A finding at any location of an item
  counts for that item. Issue anchors are looked up in the planted app;
  decoy anchors in every app the decoy is in.

## Findings format

What every setup must return, defined in
`prompts/eval-findings.schema.json`. Claude Code gets the schema with
`--json-schema` and returns matching JSON (structured output); the
scorer validates the same file. Per finding: `title`, `category`
(`security`, `privacy`, `play`), `severity` (`high`, `medium`, `low`),
`verdict` (`FAIL`, `NEEDS DYNAMIC`, `MANUAL`; never PASS), `masvs` and
`maswe` (IDs, may be empty), `locations` (`file` relative to the app
root, `line`, optional `endLine`) and `explanation`. Top level:
`findings` and `inspected` (files read). The task prompt is
`prompts/eval-task.md`. Changing either file is a prompt change: each
result records both hashes.

## Running

Node 26 and a logged-in Claude Code. Runs use the plan, never an API
key: the runner drops `ANTHROPIC_*` variables.

```
npm run eval:run -- --app planted --setup alone --model <id> --trial 1
npm run eval:score -- evals/results/example-app/<run>
npm run eval:summary
```

The runner copies the app's committed files to a fresh temp folder named
`penny-jar`, runs `claude -p` there with only Read, Grep, Glob and Skill
(no web, no shell, no writes) and writes `meta.json` (date, versions,
model, setup, plugin, hashes, skills invoked, tokens, API-equivalent $)
and `findings.json` (the output as returned). Output that is missing or
invalid marks the run failed; it is never scored as "no findings".
`transcript.jsonl` and `stderr.txt` stay local (gitignored). Add
`--smoke` for a test run that the baseline doesn't count. A rerun of a
failed trial gets `-a2`, `-a3`…; the failed one is kept.

Setups (arms) are rows in `src/setups.ts`. All arms get the same tools,
prompt, model and isolation, and differ only in their plugin:
- `alone`: no plugin.
- `checklist`: `prompts/eval-checklist-plugin`, a skill with the 24 MASVS
  v2.1.0 control statements and nothing else.
- `owasp`: `code-security-skills` from OWASP's Secure Agent Playbook,
  tag v0.2.11 (CC BY 4.0), cloned into the gitignored `evals/.cache/`
  and refused if the tag no longer points at the pinned commit.

- `ward`: Ward's MCP server, no skill (held-out only).
- `ward-check`: the repo's `plugin/` (skill `/ward:check`) and Ward's
  MCP server, plus Write limited to `.ward/`. Prompt `/ward:check`, no
  schema: the runner copies `.ward/report.json` and `fills.json` out and
  turns the report into `findings.json` in code
  (`src/report-findings.ts`). What it is compared with:
  `held-out-ward-check.md`.

The plugin is copied into the temp folder beside `penny-jar`, never into
it, and passed with `--plugin-dir` and `--add-dir`. Isolation, the same
for every arm: `--setting-sources ""` (no user, project or local
settings, so no user plugins or hooks), `--strict-mcp-config`, auto
memory off, and `--restricted`, which keeps the file tools inside the
copy and the plugin. Not `--safe-mode`: it hides plugin skills. The run
fails if the init message shows an API key, an MCP server, other tools,
or a plugin that is neither built in nor the arm's own, or if a file
tool reads outside the copy and the plugin. Reads that `--restricted`
refused are counted (`outsideBlocked`), not failed.

## Scoring

- Each anchor resolves to a line. An anchor found zero times or more
  than once stops the scorer.
- A finding location matches an item location when it's in the same
  file and its lines are within 5 of the anchor's. Its type matches when
  it shares a MASWE ID or a MASVS control with the item.
- Location and type match one item: matched automatically. An issue is
  a true positive; a decoy is a false alarm.
- Two items matching at one location (a tie), a mix of issue and decoy,
  location without type, a finding anywhere else, and every finding in
  the twin that isn't a decoy hit go to `grades.json`, with candidates
  and a suggestion. Karlo sets each `label` to an item ID,
  `false-alarm`, `real-unplanted` (a real issue nobody planted: a key
  candidate) or `generic` (hardening advice). A label also overrules an
  automatic match. Until all are labelled, the score is provisional.
  Claude may write a `proposed` label and a one-line `proposedWhy`; the
  scorer ignores both until Karlo confirms and `label` is set.
- One finding counts for every item it matches, so a finding citing
  both places of a chain (EA-12 and EA-13) scores both.
- `score.json`, planted app: issues found out of 23, misses (false
  passes) by ID, by difficulty, MASVS group and category, duplicates,
  decoy hits and other false alarms, and precision (correct findings
  over correct plus false alarms; generic left out). Twin: false alarms
  and decoy hits. Both: bad citations (a file that doesn't exist, a line
  past its end, a path outside the app).

## Summary

`npm run eval:summary` reads every non-smoke run for the current key and
writes `results/example-app/summary.json` and the tables in
`baseline.md` (the note below them is hand-written and kept). Per arm
and app: runs (and failed attempts), issues found, false-pass rate,
bad-citation rate, precision, false alarms, decoy hits, how often the
arm's own skill was used, minutes, tokens and API-equivalent $, each as
mean (min–max) across trials. Also: which issues each arm missed, which
no arm ever found, and ADR 0001's revisit bar, fixed in step 04 before
any run: `alone` averages 21 or more of 23 with at most 1 false alarm in
every twin run.
