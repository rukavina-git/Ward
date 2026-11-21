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
```

The runner copies the app's committed files to a fresh temp folder named
`penny-jar`, runs `claude -p` there with only Read, Grep and Glob (no
web, no shell, no writes) and writes `meta.json` (date, versions, model,
setup, hashes, tokens, estimated cost) and `findings.json` (the output
as returned). Setups are listed in `src/setups.ts`; `alone` adds
`--safe-mode`, so no CLAUDE.md, user plugins, MCP servers, hooks or
memory. Output that is missing or invalid marks the run failed; it is
never scored as "no findings". `transcript.jsonl` and `stderr.txt` stay
local (gitignored). Add `--smoke` for a test run that the baseline
doesn't count.

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
- One finding counts for every item it matches, so a finding citing
  both places of a chain (EA-12 and EA-13) scores both.
- `score.json`, planted app: issues found out of 23, misses (false
  passes) by ID, by difficulty, MASVS group and category, duplicates,
  decoy hits and other false alarms, and precision (correct findings
  over correct plus false alarms; generic left out). Twin: false alarms
  and decoy hits. Both: bad citations (a file that doesn't exist, a line
  past its end, a path outside the app).
