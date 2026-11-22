# Council: what the baseline means for Ward (2026-11-22)

**Decision. Owner, 2026-11-22:** the chair's recommendation is accepted
in full (Karlo asked for it, with the reasons explained).
1. Claim precision and evidence, not completeness.
2. Plan 3: exact ID lookup + BM25 first; vectors built by hand as a
   comparison, shipped only if they win on the retrieval eval.
3. Held-out set from real security-fix commits in open-source Android
   apps, frozen before plan 4 writes any check. MASTG demos only as
   "in corpus" smoke cases.
4. Add a "defensible" label (EA-D7 first). Publish every hand grade with
   its reason; a second grader when one is available.
5. Short post on the baseline: yes, any time, not blocking.

Recorded in ADR 0009, PRODUCT.md and docs/roadmap.md.

Members: AI engineer, application security expert, product owner, hiring
manager (persona), developer user (persona), cost and operations. Each
answered independently and saw none of the others. Answers are capped at 200
words.

## Synthesis (chair)

### Votes

| Member     | Q1 | Q2 | Q3            |
|------------|----|----|---------------|
| AI eng     | b  | b  | b + c         |
| AppSec     | b  | b  | b + c         |
| Product    | b  | b  | c + b         |
| Hiring mgr | b  | b  | b + c         |
| Developer  | b  | b  | b + c         |
| Cost/ops   | b  | b  | b¹ + e        |

¹ MASTG demos as the held-out cases.

### Where they agree
- **Q1 b, unanimous.** Claim precision and evidence, not completeness.
  Claude Code alone already finds 21.7/23 textbook issues. What it lacks is
  proof of what it checked (NO FINDING with files inspected, NEEDS DYNAMIC
  with the MASTG test), exact facts that come out the same every run, and
  fewer false alarms.
- **Q2 b, unanimous.** Build the ID graph (control > MASWE > test) plus
  keyword search. Three members (AI eng, hiring mgr, cost/ops) add: still
  build vectors by hand, but as a measured comparison that ships only if
  recall@5 and MRR improve. That keeps the learning goal and makes "should
  we add vectors?" something the eval decides.
- **Q3 b, unanimous; c, 5 of 6.** Add held-out cases and harder kinds of
  issue (absences, dependency CVEs, config/build issues). Karlo wrote the
  app, the key, and soon Ward's checks, so a win on this set alone would be
  circular.
- **Analyzers own exact facts.** Four members name the Gson CVE as a
  plain-code job (dependency versions against an offline OSV/GHSA
  snapshot), not a retrieval one.

### Where they split
- **Where held-out cases come from.** AppSec and cost/ops: MASTG demos
  (written by OWASP, small, cheap to run, kept current). AI engineer vetoes
  that: the demos would sit in Ward's own index (leakage) and are likely in
  the model's training data. He proposes twins taken from security-fix
  commits in open-source Android apps (parent = planted, fix = clean).
  Chair's note: open-source apps are also likely in training data, so that
  source carries the same contamination risk, just less of it.
- **Skill-trigger test now (e).** Only cost/ops picks it now. It's already
  planned for plan 5 (step 04 gotcha), so the split is about timing.

### Shared risk
Four members say the precision gain is small (about 2 false alarms per twin
run) and noisy at N=3. Two (developer, AppSec) warn Ward could "win" on
false alarms by holding back findings, which hides real issues. The AI
engineer says 10 decoys is too few, and one decoy (EA-D7) dominates: plan
for 30+.

### Vetoes
- **Q3 a (reuse this set only):** five of six (all but cost/ops). A set
  near the ceiling that the author wrote can't show a gain at N=3, and
  publishing that comparison would mislead.
- **Q2 d (widen the corpus now):** cost/ops. Unverified licences (Play
  pages can't be bundled) and a second corpus to keep current, with no eval
  showing a need.
- **MASTG demos as held-out cases:** AI engineer (leakage, see above).

### New facts the members found (not verified by the chair, unless noted)
- OSV publishes bulk vulnerability data for offline use; GHSA is said to
  be CC BY 4.0 (verify). (AI eng)
- The MASVS/MASTG corpus is about 2.5k chunks. (AI eng, estimate)
- The local embedding model is a 34 MB ONNX file plus native runtime
  files. Chair checked: matches ADR 0004. (Cost/ops)
- The baseline took 18 runs, about 3M tokens and about $4.5
  API-equivalent, all on the Pro plan. Chair checked: consistent with
  baseline.md. (Cost/ops)
- The twin isn't fully clean: its biometric unlock was graded a real
  unplanted issue. (AppSec)

### Ideas worth keeping
- **Must-exist checks:** account deletion, privacy policy link,
  data-deletion URL. Absences are what "forgotten" means in PRODUCT.md,
  and agents miss them. (Product)
- **Per-control audit export and coverage metric:** one row per MASVS
  control (verdict, files inspected, reason for any accepted risk). Score
  the share of controls with an explicit verdict; Claude alone can't show
  what it skipped. (Developer)
- **Re-grade the twin before it becomes the precision benchmark.** EA-D7
  (cloud backup of a finance DB and receipt photos, with rules) deserves
  MANUAL, not "false alarm". Add a "defensible" label, a second grader who
  isn't the author, and severity weighting. (AppSec)
- **Analyzers-only arm:** no LLM, $0, same answer every run, one run.
  Shows exactly what the plain-code layer adds. (Cost/ops)
- **Reuse the 18 baseline runs' findings as labelled retrieval queries**
  for plan 3's retrieval eval, at no cost. (AI eng)
- **Publish the baseline now** as part 1 of the case study ("I measured
  before building"). (Hiring mgr)

### Chair's recommendation
- **Q1 b.** The claim becomes: a report you can hand an auditor. Every
  control gets an explicit verdict with evidence, exact facts come from
  analyzers, there are fewer false alarms, and nothing required is missing
  (must-exist checks). "Nothing forgotten" survives as per-control coverage
  and absences, not as recall on textbook bugs. Guard against the shared
  risk: report false passes next to false alarms, so suppressing findings
  can't win.
- **Q2 b, with vectors as a hand-built comparison** (AI engineer weighted
  highest). Plan 3 builds the ID graph and BM25 (keyword ranking) by hand,
  then embeddings by hand, and keeps vectors only if the retrieval eval
  shows a gain. Seed the retrieval eval with the baseline findings.
- **Q3 b + c, fixed before Ward's checks are written** (like step 01 fixed
  the key before the app). Not MASTG demos as the held-out set (AI
  engineer's leakage veto holds); use them only as labelled "in-corpus"
  smoke cases. Grow decoys toward 30, and re-grade EA-D7 with a
  "defensible" label. Add the analyzers-only arm in plan 6. The trigger
  test stays in plan 5.
- **Order:** plan 3 (slim RAG) next, unchanged in place. Build the harder
  and held-out set before plan 4 writes any analyzer or check.
- This changes ADR 0001's selling point and PRODUCT.md's positioning, so it
  needs a new ADR once decided.

### For the owner to decide
1. Change the claim from completeness to precision and evidence (per-control
   verdicts, analyzer facts, must-exist checks)?
2. Plan 3: ID graph + BM25, with vectors built by hand and kept only if the
   retrieval eval earns them?
3. Held-out source: open-source fix-commit twins, a second app someone else
   plants (who?), or MASTG demos despite the leakage veto?
4. Re-grade EA-D7 as defensible/MANUAL, and find a second grader?
5. Build the harder and held-out set between plans 3 and 4?
6. Publish the baseline now as case study part 1?

---

## Brief (given verbatim to every member)

Context: Plan 2 is done. On Ward's own private Kotlin app (23 planted issues, 10 decoys, plus a clean twin with every issue fixed), Claude Code alone (Sonnet 5.5, 3 trials, prompt "is this app ready to publish?") found 21.7/23 (never fewer than 21). Misses: an absence (no account deletion), a known-vulnerable Gson version, and now and then weak RNG, biometric bypass, and one other. Twin: 1 to 3 false alarms per run, mostly decoys (backup-on-with-rules flagged in every run). A plain checklist skill (used every run) changed nothing measurable. OWASP's plugin skill never triggered (0/6). Bad citations: 0 to 2%. ADR 0001's pre-registered "rethink Ward" bar was not triggered, but only because of the twin false alarms. Next on the roadmap: Plan 3, a hand-built RAG knowledge base over MASVS/MASTG.

Q1. What is Ward's value claim now? (a) Keep as is: completeness + citations; plan 6's eval decides. (b) Precision: fewer false alarms, honest verdicts (NO FINDING lists files inspected, NEEDS DYNAMIC), exact facts from plain-code analyzers. (c) Breadth first: privacy/GDPR and Play policy, which agents tend to skip; move privacy ahead. (d) Workflow: triage, remembered decisions, reruns that show only changes. (e) Stop or pivot Ward.

Q2. What happens to Plan 3 (RAG)? (a) As planned: ingest by ID, chunk, embed locally, hybrid keyword + vector search, retrieval eval. (b) Slim: ID-graph lookup (control > MASWE > test) + keyword search; vectors only if the retrieval eval shows a need. (c) Defer: analyzers and harder eval cases first, RAG after. (d) Widen: add privacy and Android docs to the corpus now.

Q3. What must the eval add before Ward is built further? Pick up to two. (a) Nothing; reuse this set in plan 6. (b) Held-out cases: MASTG demos, or a second app Karlo didn't plant. (c) Harder kinds: absences, dependency CVEs, config/build issues, privacy issues. (d) A weaker-model arm: Haiku + Ward vs Sonnet alone. (e) A skill-trigger test (does the skill fire on natural prompts?).

Constraints. Locked: local Claude Code plugin, no LLM calls at runtime, no paid APIs or API keys, static site, verdicts never "PASS", results published even when bad for Ward. Learning RAG, embeddings and evals by hand is a goal in itself (CLAUDE.md), and Ward is a portfolio piece for AI engineering roles. Out of scope: hosted scanning, web chat. Open facts: N=3 per arm, one model, one app written with full knowledge of its issues, the issues are mostly textbook ones.

Files to read: PRODUCT.md, docs/roadmap.md, docs/adr/0001-product-shape.md, evals/results/example-app/baseline.md, evals/answer-keys/example-app.json (skim). Optional: docs/council/2026-11-21-product-scope.md (the first council).

## Member answers (verbatim)

### AI engineer

VOTE: Q1 b, Q2 b, Q3 b + c

WHY:
- Recall on textbook issues is already near the ceiling (21.7/23). What it misses are exact facts and absences. The Gson CVE needs an analyzer that checks dependency versions against an offline OSV/GHSA Maven snapshot ([OSV data](https://google.github.io/osv.dev/data/); GHSA is CC BY 4.0, verify), not retrieval.
- The model already knows MASVS (0–2% bad citations). RAG's real job is narrower: hand the agent the exact MASTG test conditions so it stops flagging decoys like EA-D7. That can be tested.
- The corpus is about 2.5k chunks linked by IDs, so ID graph + BM25 (keyword ranking) is the fair baseline. Still build vectors by hand as an ablation, about a day at this size, and ship them only if recall@5/MRR improves. The learning stays, and the claim has to be earned.
- Karlo wrote the issues and will write the checks. Without held-out and harder cases, plan 6 tests his memory.

RISK of my pick: 10 decoys is too few to measure precision, and one decoy (EA-D7) dominates. Plan for 30+.

I'D VETO: Q3a. A saturated set that Karlo wrote himself can't show a gain at N=3. Also veto MASTG demos as held-out cases: they'd be in Ward's own index (leakage) and likely in the model's training data.

IDEA: Real twins from security-fix commits in open-source Android apps (parent commit = planted, fix commit = clean twin). Also reuse the findings from the 18 baseline runs as labelled retrieval queries at no cost: the answer key already maps them to MASWE/MASTG IDs.

### Application security expert

VOTE: Q1 b, Q2 b, Q3 b + c

WHY:
- An audit needs evidence, and Claude alone already finds 21.7/23 textbook bugs. Plain-code analyzers give exact facts: they can check dependency versions against OSV, which catches EA-19 every time. A checklist item that requires evidence catches absences like EA-23.
- MASVS, MASWE and MASTG form an ID graph, so a correct citation is an exact lookup at a pinned version. That has to handle the MASWE beta to v1.0.0 renumbering. Vectors make results fuzzy where an audit needs them exact. Add vectors only if the retrieval eval shows a need.
- The issue set was written by its own author and is textbook. The author knew the answers while writing it, and the scores are near the ceiling. MASTG demos are written by OWASP, so they are held-out cases with known answers, under CC BY-SA.

RISK: The precision claim rests on decoy labels, and those are judgement calls. Ward could "win" by holding back findings.

I'D VETO: Q3a. At 94% recall with N=3, plan 6 can't tell the arms apart, and publishing that comparison would mislead.

IDEA: Re-grade the twin before it becomes the precision benchmark. It isn't clean: graders labelled its biometric gap a real, unplanted issue. EA-D7 is a fair flag: a financial database and receipt photos going to cloud backup deserve MANUAL ("confirm this is intended"), not "false alarm". Add a "defensible" label, a second grader who isn't the author, and severity weighting.

### Product owner

VOTE: Q1 b, Q2 b, Q3 c + b

WHY:
- Claude Code alone finds 21.7 of 23 textbook issues, so a one-minute demo can't sell "completeness". It can sell precision. On the clean twin, Claude Code alone flags the correct backup rules (EA-D7) in every run. Ward would read the rules file and say NO FINDING, listing the files it inspected. Analyzers also give the same answer every run: the vulnerable Gson version gets flagged in every run, where Claude Code alone found it in only 1 of 3.
- The slim version of plan 3 builds the ID graph (control > MASWE > test) that the checklist tool needs anyway. It still teaches chunking, keyword search and retrieval evals. Whether to add vectors becomes a decision the retrieval eval makes, which is a stronger portfolio story than "added embeddings". Analyzers come next.
- Agents did not skip privacy: EA-20 to EA-22 were found. What they missed was an absence (EA-23, no account deletion). Harder kinds of cases show where Ward can win. Held-out cases stop Karlo from grading his own checks against issues he planted himself.

RISK of my pick: the gains are small (about 2 false alarms per twin run down to 0) and noisy at N=3. If a decoy like EA-D7 is debatable, critics can argue the precision claim away.

I'D VETO: Q3 a. Karlo wrote the app, the answer key, and soon Ward's checks. A win on that same set is circular, and the public eval page would show it.

IDEA: "must exist" checks: things a release needs to have, such as account deletion, a privacy policy link and a data-deletion URL. A missing feature is exactly what "forgotten" means in PRODUCT.md's purpose, and the baseline shows agents miss absences.

### Hiring manager (persona)

VOTE: Q1 b, Q2 b, Q3 b + c

WHY:
- The baseline is the strongest thing in the repo. You measured first and wrote down that the agent alone finds 21.7 of 23. If you keep "completeness" as the claim after that, it looks like you're ignoring your own data.
- At a fintech, false alarms are what get security tools switched off. Honest NO FINDING verdicts plus exact facts from plain code tell me you know where an LLM belongs and where it doesn't.
- Embedding everything and running hybrid search is the tutorial everyone ships. "ID graph plus keyword search, with vectors only where the retrieval eval showed a gap" is a judgment call, and I'd ask about it in an interview. Build the vector version anyway, as a measured comparison.
- My first question would be "who wrote the test?" A held-out app and harder kinds of issue (absences, CVEs) are where the misses are.

RISK of my pick: the twin gets about 2 false alarms per run, with N=3. A drop may not stand out from the noise, so the precision gain could be too small to show.

I'D VETO: Q3 a. You wrote this set knowing every answer, and the agent alone already gets nearly all of it. It can't show a gain, and if it did, I wouldn't trust it.

IDEA: Publish the baseline now as part 1 of the case study, "I measured before building". Don't wait for plan 9.

### Developer user (persona)

VOTE: Q1 b, Q2 b, Q3 b + c

WHY:
- Before my audit, Claude Code alone already finds the textbook bugs. What it can't give me is proof of what it checked. NO FINDING with the files inspected, and NEEDS DYNAMIC with the MASTG test, are what I'd hand the auditor.
- Its two misses are the ones that would hurt me: no account deletion (Play rejects the app) and a vulnerable Gson (the auditor's dependency scan finds it on day one). Plain-code analyzers should own facts like these.
- Backup-with-rules flagged on every run wastes my time. After two false alarms I stop reading.
- I don't care about vectors. I care that the MASVS > MASWE > MASTG IDs are exact, and an ID graph gets them right every time.

RISK of my pick: if Ward cuts false alarms by suppressing findings, it can hide real issues. A false pass before an audit is worse than noise.

I'D VETO: Q3 a. An eval on an app written by someone who knew every bug proves nothing about my app, and I wouldn't trust the eval page.

IDEA: an audit export with one row per MASVS control (verdict, files inspected, reason for any accepted risk). Score the share of controls that get an explicit verdict, because Claude alone can't show what it skipped.

### Cost and operations

VOTE: Q1 b, Q2 b, Q3 b (MASTG demos) + e

WHY:
- Analyzers give value at the lowest running and upkeep cost: plain code, $0 per run, same answer every time. Sonnet already finds the textbook issues. What it misses or gets wrong are exact facts (Gson version, targetSdk, merged manifest) and false alarms.
- Slim RAG ships no 34 MB model and no ONNX native binaries in the npm package or the site. A new MASTG release then means a re-parse, not a re-embed. Build the vectors offline as a measured experiment: you still learn them, and they ship only if recall@5 earns it.
- Agent runs are the real cost. The baseline took 18 runs, about 3M tokens and about $4.5 API-equivalent, all on Pro limits. MASTG demos are held out, small (cheap runs) and kept current by OWASP. A trigger test is a few short runs and gates everything else (OWASP's skill fired 0/6).

RISK of my pick: a gap of 1–2 false alarms per run is noise at N=3, so proving the precision claim needs more trials and more Pro usage. A CVE check also needs a vulnerability feed kept current offline.

I'D VETO: Q2 d. It adds sources with unverified licences (Play pages can't be bundled) and a second corpus to keep current, before any eval shows a need.

IDEA: an "analyzers only, no LLM" eval arm. It costs $0, gives the same answer every time and needs one run. It shows exactly what the plain-code layer adds.
