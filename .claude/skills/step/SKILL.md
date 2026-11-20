---
name: step
description: Run the next unchecked step of the active plan in docs/plans/. Explain new concepts, plan, wait for approval, implement, test, review once, record progress.
disable-model-invocation: true
---

Run exactly one step of the active plan. Keep every message short; I read on my phone.

1. Read `docs/plans/ACTIVE` (the plan folder name), then that folder's
   `00-overview.md` and `progress.md`. Pick the first unchecked step
   not marked "deferred". Read only that step's file. If none is left,
   say the plan is done, name the next plan from `docs/roadmap.md`,
   list any deferred steps, and stop.
2. If the step is marked "(me)", list what I need to do, in order, with
   links, and stop. If it has no step file yet, write one in the style
   of the others, show it, and stop for approval.
3. Learn first. If the step uses an AI concept not yet in
   `docs/learning/glossary.md`, explain it in the big picture: plain
   words, max ~8 lines, no code, and how Ward will use it.
4. Read the code the step names. Then give a plan of at most 5 lines:
   what changes, which files, which tests, and any paid API calls with
   an estimated cost. If the code contradicts the step file, say so.
   Wait for my "go". Don't edit anything before it.
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
