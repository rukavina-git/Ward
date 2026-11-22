# 04 Baseline

## Goal
Measure what Claude Code catches before Ward exists. Three arms, the
same model, prompt, tools and copy of the app: Claude Code alone, + a
plain MASVS checklist skill, + OWASP's plugin. At least 3 trials per arm
on both apps, scored with step 03's harness, summed up with averages and
spread, and a short note on what it means for Ward. Publish the numbers
even if they're bad for Ward.

## Before the runs (decided now, so the data can't move them)
- Fixtures and key stay frozen at key v2 for the whole baseline. The
  key v3 wording fixes wait; a changed fixture would orphan runs.
- Twin EA-09 (the sealed secret protects no data): leave the twin as is
  and grade the finding `real-unplanted` in every arm. It isn't a false
  alarm, so it doesn't tilt the comparison. Rejected: making the unlock
  key wrap the notes key, a redesign of the twin's storage.
- ADR 0001's "almost everything": the revisit is triggered if `alone`
  averages 21/23 or more on the planted app with at most 1 false alarm
  per twin run. Then the note flags it for `/council`; this step
  doesn't decide it.

## Do
1. Checklist arm, `prompts/eval-checklist-plugin/`: a minimal plugin
   (`.claude-plugin/plugin.json`) with one skill, `masvs-checklist`.
   SKILL.md holds the 24 MASVS v2.1.0 control statements verbatim, one
   per line under their 8 groups, plus a short procedure: go through
   every group, check the code, report file and line. Nothing else: no
   MASWE, no MASTG, no Play items, nothing from the answer key. The
   description is plain ("Review an Android app against OWASP MASVS
   before release"). Header: CC BY-SA 4.0 attribution, link, version.
   Rejected: a richer list with MASWE titles; it blurs the line with
   OWASP's arm and Ward.
2. OWASP arm: `code-security-skills` from OWASP/secure-agent-playbook,
   pinned to tag v0.2.11 (CC BY 4.0, checked). Fetched into a gitignored
   cache, not vendored; meta records the commit SHA. Its own description
   and files as published: no edits.
3. Runner:
   - Setup rows get an optional plugin source (local folder or pinned
     git tag). The runner copies the plugin into the temp folder beside
     `penny-jar`, never inside it, and passes `--plugin-dir`. No repo
     path reaches the agent.
   - Tools: arms with a plugin add `Skill` to Read, Grep and Glob.
     Nothing else (no Agent, no Bash), so OWASP's subagents don't run.
   - Check first: `--plugin-dir` with `--safe-mode`, and whether Read
     can open the plugin's data files under `dontAsk` (else
     `--add-dir`). If `--safe-mode` drops the plugin, find the closest
     isolation that keeps it, use it for all three arms, and rerun
     `alone` the same way. Arms differ only in the plugin.
   - Isolation is enforced, not just recorded: the run fails if
     `apiKeySource` isn't `none`, any MCP server loads, the plugins or
     tools differ from the setup row, or a tool reads outside the copy
     and the plugin folder.
   - Meta adds: skills invoked (from the transcript), plugin SHA.
     Bundled skills may still be listed; any use of one is recorded.
4. Grading: Claude writes proposals into a new `proposed` field with a
   one-line reason; `label` stays empty until Karlo confirms. The scorer
   ignores `proposed`. Grades use the same rules in every arm.
5. Runs: `claude-sonnet-5-5` (Karlo's choice in step 03), 3 trials ×
   3 arms × 2 apps = 18 runs, interleaved (trial 1 of every arm and app,
   then trial 2…), so drift hits all arms alike. All on one Claude Code
   version; if it changes mid-run, note it. A failed run is rerun and
   the failure kept in the log. Runs use Karlo's Pro login
   (`apiKeySource: none`): no money, only plan usage. Run in batches of
   6 (one trial of each arm and app); a run cut off by a usage limit is
   rerun after the reset.
6. Summary, `npm run eval:summary`: reads every non-smoke `score.json`
   for key v2 and writes `evals/results/example-app/summary.json` and
   `baseline.md`. Per arm and app: issues found /23 (mean, min–max),
   false-pass rate, twin false alarms, decoy hits, hallucinated-citation
   rate, precision, skill invoked (n/3), minutes, tokens, and the
   API-equivalent $ Claude Code reports (not billed; a size measure).
   Misses by ID across trials (which issues no arm finds). Headline:
   false-pass rate and hallucinated-citation rate, with spread.
7. Note in `baseline.md`, at most 10 lines: what the arms show, where
   Ward can add value, and whether ADR 0001's revisit is triggered.
8. `docs/sources.md`: MASVS v2.1.0 (CC BY-SA 4.0, quoted in the
   checklist skill) and the OWASP playbook (CC BY 4.0, used as an arm,
   not redistributed).
9. Tests: setup rows (plugin arms add only `Skill`), plugin copied
   outside the app copy, isolation check (each failure case), summary
   maths on synthetic scores, `proposed` ignored by the scorer.

## Not in scope
- Key v3 and fixture changes. Smoke runs stay uncounted.
- Ward, retrieval, Haiku arms, `/security-review` or MobSF arms.
- Running Gradle or a shell in any arm.
- Fixing step 03's other review nits (duplicates in precision, SIGKILL,
  INIT_CWD), unless one blocks a run.
- Trace viewer, eval page.

## Done when
- `npm run lint`, `npm run format:check`, `npm run typecheck` and
  `npm test` pass, and CI is green.
- 18 runs (3 per arm and app) with `meta.json`, `findings.json`,
  `grades.json` and `score.json`, every label confirmed by Karlo, and
  isolation passing in each.
- Each plugin arm's init message lists its plugin, and its transcript
  shows the plugin's files being read when the skill runs.
- `summary.json` and `baseline.md` exist; the note answers ADR 0001.
- `grep` of the results finds no answer-key text and no home-directory
  paths.
- `docs/sources.md` exists. Glossary has: eval arm, baseline, spread,
  pre-registration, skill triggering. Roadmap 2.4 ticked.
