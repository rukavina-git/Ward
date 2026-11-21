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
- `apps`: folders of the planted app and the clean twin.
- `concept`: what the app does, so planted issues fit it naturally.
- `sources`: MASVS, MASWE and MASTG versions, links and licences.
- `notes`: things to know when reading the IDs.

Each entry in `items` is a planted issue or a decoy:
- `id`: `EA-01`… for issues, `EA-D1`… for decoys. Neutral on purpose.
- `decoy`: `true` for code that looks risky but is fine.
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
  counts for that item.

## Scoring (step 03)

- A finding on a planted issue is a true positive. A planted issue with
  no finding is a miss.
- A finding on a decoy, or anywhere in the clean twin, is a false alarm.
- Anything else gets graded by hand. A real issue nobody planted goes
  into the key as a new item.
