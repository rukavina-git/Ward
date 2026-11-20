---
name: explain
description: Explain an AI engineering concept in the big picture, tied to Ward, and save it to the learning notes.
disable-model-invocation: true
---

Explain the concept in the arguments (or the one we were just
discussing). I know web, Android and security well. I'm new to AI
engineering. I prefer the big picture over code.

1. Read `docs/learning/glossary.md` and `docs/learning/topics/` for
   anything already written on it, so you build on it instead of
   repeating it.
2. Explain, in this order, short enough to read on a phone:
   - **What it is**, in plain words, max 3 sentences.
   - **An analogy** from everyday life or from web/mobile work.
   - **A concrete example from Ward**: where it shows up and what
     happens step by step.
   - **What goes wrong**: the 2–3 most common failure modes.
   - **What I'd say in an interview**: 2–3 sentences.
   No code unless I ask. Use a small table or diagram only if it makes
   it clearer.
3. If anything is version- or price-dependent, check current docs
   instead of answering from memory, and say so.
4. Save: add or update the term in `docs/learning/glossary.md`. For a
   bigger topic, write `docs/learning/topics/<topic>.md` with the same
   sections. Don't commit; tell me what you saved.
5. End with one question I could answer to check I understood it.
