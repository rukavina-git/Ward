---
name: step
description: Run the next unchecked step of the active plan in docs/plans/. Explain new concepts, plan, implement, test, review once, record progress.
disable-model-invocation: true
---

Run the next step of the active plan. If the step after it is small and
closely related, do both in one run (one review, one commit each). Keep every message short; I read on my phone.

1. Read `docs/plans/ACTIVE` (the plan folder name), then that folder's
   `00-overview.md` and `progress.md`. Pick the first unchecked step
   not marked "deferred". Read only that step's file. If none is left,
   say the plan is done, name the next plan from `docs/roadmap.md`,
   list any deferred steps, and stop.
2. If the step is marked "(me)", list what I need to do, in order, with
   links, and stop. If it has no step file yet, write one in the style
   of the others and go on; don't stop for approval.
3. Learn first. If the step uses an AI concept not yet in
   `docs/learning/glossary.md`, explain it in the big picture: plain
   words, max ~8 lines, no code, and how Ward will use it.
4. Read the code the step names. Then give a plan of at most 5 lines:
   what changes, which files, which tests, and any paid API calls with
   an estimated cost. If the code contradicts the step file, say so.
   Then go on without waiting. Stop and ask only for a real decision:
   scope or product changes, cutting a step, anything that costs money
   or plan usage (eval runs), or code that contradicts the step file.
5. Implement. Stay inside the step's scope and the overview's
   invariants. Say explicitly if you change a prompt in prompts/, the
   database schema, or the model. Check SDK usage and model ids against
   current docs.
6. Run the checks from the step's "Done when". Fix failures. Don't go
   on while they're red. If evals exist and the step touches retrieval,
   chunking, prompts or the model, run them before and after (ask first
   if it costs money) and report both scores.
7. Run the `reviewer` subagent once on the uncommitted diff, passing the
   step file path. Fix BLOCKERs only. List the rest without fixing them.
   No second review round.
8. Update `progress.md`: tick the step and add the commit hash. Tick
   the same step in `docs/roadmap.md`. Under Deviations, note anything
   that differs from the step file. Under Gotchas, note anything the
   next step should know. Add new terms to the glossary. Write "None"
   where there is nothing.
9. Commit code, progress.md, roadmap.md and glossary together on
   develop (Co-Authored-By line, no other attribution), then
   `git push origin develop`.
10. Report in at most 10 lines: what changed, what I learned (one
    line), check results, reviewer findings and what you fixed, open
    items. End with: "Run /clear, then /step."
