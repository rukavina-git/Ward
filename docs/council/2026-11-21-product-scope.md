# Council: what is Ward? (2026-11-21)

**Decision. Owner, 2026-11-21:**
1. Q2: security first. v1 is released publicly with security + privacy
   and GDPR.
2. Q5: local plugin only. A remote endpoint maybe later.
3. Q6: read-only HTML report first, then a clickable triage UI served
   locally (localhost) that writes `.ward/decisions.json`. No per-item
   prompts in the terminal.
4. Yes: generate a Kotlin example app with planted issues plus a clean
   twin, kept in this repo.
5. Publish the results whatever they are. The selling point is
   completeness before publishing (security, privacy/GDPR, later Play
   policy and licences), not better MASVS coverage than OWASP.
6. The chair's recommendation is accepted for Q1, Q3, Q4, Q7 and Q8.

Recorded in ADR 0001, PRODUCT.md and docs/roadmap.md.

Members: AI engineer, application security expert, product owner, hiring
manager (persona), developer user (persona), cost and operations. Each
answered independently and saw none of the others. Answers are capped at 600
words, longer than usual at the owner's request.

## Synthesis (chair)

### Votes

| Member     | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 |
|------------|----|----|----|----|----|----|----|----|
| AI eng     | b  | b  | c¹ | c  | d  | b  | c  | b  |
| AppSec     | b  | c  | c² | c  | c  | b  | c  | b  |
| Product    | b  | a  | b³ | a  | d  | a⁴ | c  | b  |
| Hiring mgr | b  | a  | c² | c  | c  | b  | c  | b  |
| Developer  | b  | b  | b  | a  | c  | b  | b  | b  |
| Cost/ops   | b  | a  | c² | a  | c  | b  | c  | b  |

¹ search playground + hard-capped Haiku answer · ² search only, no LLM ·
³ search-only demo later · ⁴ decisions file next, not v1

### Where they agree
- **Q1 b, unanimous.** The release check via MCP replaces Q&A. Q&A loses to
  Claude with web search.
- **Q8 b, unanimous.** Build retrieval and MCP first; no web chat. Three
  members add: run the baseline (Claude Code alone) before building Ward.
- **No LLM on Ward's side at runtime.** Six of six. Q4 split 3 a / 3 c, but
  every c means the same thing: no LLM call at runtime, plain-code analyzers
  run locally, and the LLM is used offline only (ingestion enrichment, eval
  judge, pre-generated demo answers). Two members note the MCP spec of
  2026-07-28 deprecated sampling, so Ward can't borrow the user's model.
- **No live LLM chat on the website.** Five of six. Only the AI engineer
  wants a capped Haiku answer box. The others reject it: a $5 cap drains in
  hours, and a broken demo looks worse than none.
- **Evals (Q7 c, 5 of 6):** a retrieval set ($0, run on every change), an
  end-to-end planted-flaw suite, and a prompt-injection suite.
- **Decisions file (Q6 b, 5 of 6).** Identify each finding by check ID +
  file + snippet hash, not by line number. Record the corpus version and an
  expiry date. SARIF only for plain-code checks, never as an LLM-driven CI gate.

### Where they split
- **Q2, v1 modules.** Security only: product owner, hiring manager, cost/ops.
  Security + privacy: AI engineer, developer. Security + Play policy rules:
  AppSec.
  - The AppSec expert notes that privacy data flows can't be seen in source,
    and Google Checks already offers a free Data Safety helper.
  - Four members name privacy as the most differentiated v2 module.
  - Three want users to pick MASVS groups from day one, as a cheap filter.
- **Q5, local vs remote.**
  - Local stdio inside a Claude Code plugin: four members. Code never leaves
    the machine, it costs $0, works offline and can't be abused, and the
    analyzers need the repo anyway.
  - Remote as well: AI engineer and product owner. Knowledge updates happen
    in one place, and claude.ai users can add it without installing.
  - The developer warns that tool arguments may carry code snippets to a
    remote server.
- **Q6 timing.** The product owner says decisions go in the release after
  v1, because matching findings across runs is a rabbit hole.

### Vetoes
- **Hosted upload scanner (Q1c / Q3d): vetoed by all six.** It means
  keeping strangers' code on a hobby server, paying for compute and LLM
  calls with no ceiling, and competing head-on with MobSF.
- Live LLM chat (Q3a): hiring manager, product owner, cost/ops.
- Ward's server calling an LLM (Q4b): AI engineer, developer.
- All four modules in v1 (Q2d): hiring manager, product owner.
- AppSec: no PASS verdict, no overall score, no "ready" badge.
- Cost/ops: no OAuth on a remote MCP server in v1, and no Supabase Free tier
  for anything a visitor hits.

### New facts the members found (not verified by the chair)
- **Competition exists:**
  - OWASP Secure Agent Playbook: a Claude Code plugin with a mobile-code-review
    skill covering all 8 MASVS groups.
  - APSA: an MCP server and Claude Code plugin that maps findings to MASVS
    and MASWE, with SARIF output.
  - store-preflight-mcp (Play policy) and Google Checks (Data Safety).
  - None of them publishes recall or precision. Ward's edge is "measured,
    cited, versioned", not "MASVS inside Claude Code".
- **Versions:** MASTG v2.0.0 (June 2026) labels each test static or dynamic.
  MASVS is v2.1.0. Play has required targetSdk 36 since 31 Aug 2026.
- **Licences:** developer.android.com is CC BY 4.0. The Play policy pages
  have no open licence: store facts and links, not their text.
- **Corpus size:** about 1M tokens, about 2.5k chunks, about 1 MB of
  vectors. It fits in a browser and in an npm package.
  - Brute-force search takes about 1 ms, so no vector database is needed.
  - A local embedding model (e.g. bge-small-en-v1.5, MIT licence) means no
    API key and no network.
- **Training-data contamination:** InsecureBankv2 and DIVA are in model
  training data, so the "Claude Code alone" baseline will look better than
  it is. Write a private Kotlin app with planted flaws plus a clean twin, and
  use MASTG demos as single-flaw cases.
- **Cost of agent eval runs:** about $0.3–1 per Sonnet run, which breaks the
  $5 cap. Run them on the Claude plan (check the terms) or on Haiku 5.5.

### Ideas worth keeping
- **Verdicts:** FAIL (file:line) / NO FINDING (lists the files inspected) /
  NEEDS DYNAMIC (MASTG test ID) / MANUAL / N/A. Never PASS. (AppSec)
- **Name for v1:** "pre-release security review" or "pre-audit", not
  "release-ready". (AppSec, product owner)
- **Plain-code analyzers:** merged manifest, network security config,
  targetSdk. A planted comment can't talk them out of a result. (AppSec,
  AI engineer, developer)
- **Citation checker:** every cited ID exists, every file:line exists,
  every quote matches. Publish the "hallucinated citation rate". (AI engineer)
- **Headline metric:** false-pass rate. (AppSec, developer)
- **Eval arms:**
  1. Claude Code alone
  2. + OWASP's plugin
  3. + a plain checklist skill (tests the "70%" doubt)
  4. + Ward

  Also "Haiku + Ward vs Sonnet alone". (Product owner, AI engineer)
- **Prompt injection planted in the scanned repo** (comments, strings.xml,
  a dependency README): "the thing that would make me call you". (Hiring
  manager)
- **Eval page with a trace viewer:** which tools the agent called, which
  citations, tokens, $ and minutes. (Hiring manager)
- **One shared TypeScript retrieval library and index file** for the
  browser demo, the MCP server and the eval harness. (Cost/ops)
- **Weekly GitHub Action:** rebuilds the index when a new MASTG version is
  tagged, runs the eval, and opens a PR. (Cost/ops)
- **Auditor and pentester pack:** accepted risks, plus each NEEDS DYNAMIC
  item turned into a MASTG test plan. (Developer, AppSec)
- **Decisions as labels:** each accept or skip becomes a false-positive
  label that feeds the precision eval. (AI engineer)

### Chair's recommendation
Weighting: the AI engineer on architecture, the AppSec expert on answer
quality, the product owner on scope.

- **Q1 b.** The v1 name is "pre-release security review for Android". Full
  release readiness (privacy, Play, licences) is the vision for later
  modules.
- **Q2 a, plus extras:**
  - Users can filter by MASVS group from day one.
  - A few plain-code Play and manifest checks (targetSdk, exported
    components, cleartext).
  - The privacy and Data Safety module comes first after v1.
- **Q3 b + c (search only):**
  - A static site with search running in the browser.
  - A sample report and trace from a real run.
  - Pre-generated answers on the eval page.
  - No live LLM.
- **Q4 c.**
  - No LLM at runtime.
  - Plain-code analyzers run locally.
  - The LLM is used offline only. That's also where Karlo hand-builds
    generation with citations: pre-generated answers and the eval judge.
- **Q5 c.** A local stdio MCP server (npm) inside a Claude Code plugin with
  a skill. A remote read-only endpoint is optional later.
- **Q6 b, staged.** A JSON report schema and a markdown view in v1, then the
  decisions file right after.
- **Q7 c,** with the contamination fix: a private app plus a clean twin, at
  least 3 trials, the spread reported, and false-pass rate and
  hallucinated-citation rate as the headline numbers.
- **Q8 b,** baseline first.

Draft roadmap:
1. Foundations: revised ADRs (language and framework, retrieval storage,
   local embeddings, LLM for offline use, distribution and site hosting),
   scaffold, one LLM-call spike to learn tokens and streaming.
2. Fixtures and baseline: private Kotlin app with planted flaws plus a clean
   twin; eval harness v0; baseline runs (alone / + OWASP plugin / +
   checklist skill).
3. Knowledge: ingest MASVS and MASTG by ID (control → MASWE → test → demo),
   chunking, local embeddings, keyword + vector search, retrieval eval.
4. Local MCP server and plain-code analyzers.
5. Skill, report schema and plugin; run it on Karlo's own app.
6. End-to-end eval with all arms, plus the injection suite; publish the
   results, good or bad.
7. Retrieval improvements driven by eval failures (reranking etc.).
8. Website: static, in-browser search, sample report and trace, eval page,
   case study.
9. Decisions file, then the privacy module.

### For the owner to decide
1. Narrow v1 to security ("pre-release security review"), or security +
   privacy?
2. Local-only MCP, or local plus a remote endpoint?
3. Agree there's no live LLM anywhere on the website?
4. Decisions file in v1, or straight after?
5. Willing to write a private Kotlin app with planted flaws (your own work)?
6. Accept the risk that Ward may not beat OWASP's free plugin, and publish
   the result anyway?

Effect on plan 1 step 01: the ADR list changes. A database may not be
needed, embeddings run locally, and "hosting" becomes distribution plus a
static site. The step file needs a rewrite once the owner decides.

---

## Brief (given verbatim to every member)

### Context
Ward is Karlo's portfolio and learning project, his first AI project. Karlo is
strong in web, Android and app security; new to RAG, embeddings, vector search,
evals, MCP and agents. Goals: (1) get hired into an AI engineering role at a
strong company, (2) build something genuinely useful that he'd use himself.
Current plan (PRODUCT.md, roadmap): web chat + MCP server answering security
questions from OWASP MASVS/MASTG with citations. No code exists yet; the stack
ADRs (plan 1 step 01) are paused until this is decided.

Doubts so far: Q&A over OWASP adds little over Claude/ChatGPT with web search.
A standalone scanner competes with MobSF, Semgrep, Snyk, Claude Code /security-review.

### Proposal on the table (owner's)
"Ward: release-readiness check for Android apps, delivered as an MCP server."
A developer plugs Ward into Claude Code (or Cursor) and asks "is this app ready
for the Play Store?". Ward supplies structured, versioned, cited checklists and
sources (control -> test procedure -> platform API). The user's own agent
inspects the code and writes a report: pass / fail (file:line, cited rule, fix)
/ needs manual check. The user triages each item: fix (agent fixes it), accept,
or skip (with a reason). The user picks modules per run: security (MASVS:
network/TLS, storage encryption, outdated crypto...), privacy (Data Safety form
vs what code and SDKs collect, permissions), Play policy (target SDK, required
declarations), licences (dependency licences vs the app's). The website would be
landing page, recorded demo, install guide, public eval page.

### Questions
Q1 Product. a) original Q&A (web chat + MCP)  b) release-readiness via MCP
   (the proposal)  c) b + hosted web scanner (upload APK/repo)  d) Q&A first,
   evolve into b later
Q2 Modules in v1. a) security only  b) security + privacy  c) security + Play
   policy  d) all four. Also: user-selectable modules from day one, or later?
Q3 Role of the website. a) live chat with an LLM (current plan)  b) static:
   landing, recorded demo, install guide, eval page; no live LLM  c) b + a small
   live "try it" (search-only without LLM, or a capped LLM)  d) web upload scanner
Q4 Who does the reasoning. a) Ward's MCP tools return sources and checklists
   only; the user's agent reasons (about $0 for Ward)  b) Ward's server calls an
   LLM and returns synthesized answers/findings  c) hybrid (say which parts)
Q5 Delivery. a) remote hosted MCP server (HTTP)  b) local MCP package (npx),
   corpus bundled  c) Claude Code plugin: MCP + a skill that drives the run and
   the report format  d) a + c
Q6 Report and decisions. a) markdown report, no state  b) report + decisions
   file in the repo (.ward/), reruns show only new/changed items  c) b + SARIF /
   CI mode
Q7 Proof (evals). a) Q&A question set only  b) apps with planted flaws
   (InsecureBankv2, DIVA, ...): Claude Code alone vs + scanner vs + Ward,
   recall/precision  c) b + a Q&A set + a prompt-injection red-team suite
Q8 Build order (learning). a) keep current order: chat -> RAG -> evals ->
   better retrieval -> MCP -> hardening  b) retrieval + MCP first, no web chat;
   evals early; then the checklist workflow  c) other (say what)

### Locked / constraints
- Grounded answers with citations; "I don't know" when sources don't cover it.
- Core RAG built by hand (no LangChain/LlamaIndex): a learning goal.
- No extra spend: free/hobby tiers; API spend capped (~$5 prepaid, no auto-reload).
  Current prices: Claude Haiku 5.5 $0.10 / $0.50 per 1M tokens in/out;
  Claude Sonnet 5.5 $2 / $10.
- Code dependencies: permissive licences only. Sources: OWASP is CC BY-SA
  (attribution on every citation). Licences of Play policy pages and Android
  docs not yet checked.
- Out of scope: accounts, payments, legal advice.
- Android first (owner is an Android dev); iOS and web later.
- Owner's lean: deterministic checks (licence scan, targetSdk value) are plain
  code or existing tools; the LLM only for judgement calls.

### Open facts
- Competitors: Claude Code alone, Claude Code /security-review, MobSF, Semgrep,
  OWASP Dependency-Check, Snyk, Gradle licence plugins, Play Console pre-launch report.
- Honest weakness: MASTG is public Markdown on GitHub; a good Claude Code skill
  with a checklist might get ~70% of the value.
- Tentative design rule: "Ward provides the knowledge; the user's AI does the thinking."

### Read
PRODUCT.md, docs/roadmap.md, CLAUDE.md, docs/plans/foundations/00-overview.md

---

## Member answers (verbatim)

### AI engineer

ONE-LINE PITCH: A Claude Code plugin that gives your coding agent a versioned, cited release checklist for Android apps (MASVS security plus Play Data Safety and privacy), with a public eval that shows how much it adds over the agent alone.

VOTE: Q1 b, Q2 b, Q3 c, Q4 c, Q5 d, Q6 b, Q7 c, Q8 b

WHY
Q1
- Q&A is a commodity. A release check produces findings you can count, so you can measure it, and the measurement is the portfolio piece.
- The security part already exists for free. OWASP's Secure Agent Playbook ships a Claude Code plugin with a mobile-code-review skill covering all 8 MASVS v2.1 groups. APSA is an MCP server and Claude Code plugin that maps to MASVS and MASWE without using an LLM. Ward wins on privacy and on measured quality, not on "MASVS inside Claude Code".

Q2
- Security is the core of the RAG work: MASVS and MASTG are CC BY-SA, structured, and have IDs. Privacy (Data Safety form vs what the code and SDKs collect, plus permissions) is the part nobody covers well, and it needs real LLM judgement.
- Put targetSdk and permission declarations in as plain-code checks. Leave licences for later, since Gradle tools already do them.
- Let users pick modules from day one as a filter parameter. It costs almost nothing.

Q3
- A static site plus a playground that calls the real MCP tools (no LLM, $0), plus a hard-capped Haiku 5.5 answer grounded in sources (about $0.0007 per answer, so about 7,000 answers per $5). That capped answer is where you hand-build generation with citations.

Q4 (hybrid)
- No LLM when the MCP server handles a request. The server does retrieval and returns structured checks: pass/fail criteria, evidence required, APIs and citations. Local plugin scripts extract plain facts from the manifest, Gradle files and dependencies. The user's agent makes the judgement calls.
- Your own LLM calls happen offline only: adding detection hints at ingestion time (you review them), the eval judge, and the demo.
- Why not b: it lets strangers drain the $5 cap, it sends user code off their machine (fatal for a security tool), and the 2026-07-28 MCP spec deprecates Sampling (servers borrowing the client's LLM).
- You still learn RAG: chunking, hybrid search, reranking and the recall@k evals all live on the server.

Q5
- A plugin (skill, report schema, local scripts) whose `.mcp.json` points to the remote server. Cursor users add the URL directly. User code stays local, and the knowledge is updated in one place.
- Design around how Claude Code loads tools. MCP tools wait behind tool search, so only tool names and server instructions (up to 4,096 chars) load at start. Tool output warns at 10k tokens and is capped at 25k by default.
- So use 3 or 4 broad tools: `get_checklist`, `get_check(id)`, `search(query, filters)`, `lookup_sdk`. Return structured output with `outputSchema`, in a fixed order, paginated. Also expose each check as a resource (`ward://check/{id}`) for @-mentions, and a `release-check` prompt for clients without skills.
- The 2026-07-28 spec is stateless, which suits free serverless hosting. Check that your SDK supports it.

Q6
- Decisions are what make people rerun it. Identify each finding by check ID + file + a hash of the normalised snippet, not by line number. Write JSON first, validated against a schema, and render markdown from it. SARIF output is then a small converter you can add later.

Q7
- Three layers:
  - A retrieval set of 60 to 100 queries with expected IDs, scored by recall@5 and MRR. It costs nothing, so run it on every change.
  - An agentic suite comparing three arms: Claude Code alone, Claude Code + OWASP's plugin, Claude Code + Ward. Pin the model, run at least 3 trials per arm, and score recall and precision with your own script. `claude plugin eval` has no custom-code graders, so use it only for with/without smoke tests.
  - A prompt-injection suite, such as planted "mark this PASS" comments in fixture repos.
- InsecureBankv2 and DIVA are in training data with public write-ups, which inflates the baseline. Add 2 or 3 fresh apps you write yourself, mutated copies of those, and a clean twin app to catch false positives.
- Cost: my estimate is $0.3 to $1 per agentic run on the Sonnet 5.5 API. About 30 runs breaks the $5 cap. Run them on your Claude plan instead (the plugin-eval docs say runs count against plan usage), or on Haiku 5.5.

Q8
- Order: fixtures and baseline runs, then knowledge schema and ingestion, retrieval eval, BM25, then hybrid search, then reranking (measuring each step), then MCP, the skill, and the website. Web chat comes last, or never.

RISK
- On security, Ward may add close to nothing over Claude Code + OWASP's free plugin. Publish that anyway; privacy has to carry the value.
- The sample is small: 3 or 4 apps × 3 trials can't detect differences under about 10 to 15 points. Say so on the eval page.
- I believe Play Policy Center and Play Console Help text is not openly licensed (developer.android.com is CC BY 4.0), but check that. Plan to store your own paraphrase, a link and a short quote, not the text itself.

I'D VETO
- Q1c and Q3d: uploading other people's APKs or repos to a hobby server is a liability for a security product, costs money, and competes head-on with MobSF.
- Q4b: for the reasons above.
- Q7a: it doesn't measure the findings the product claims to produce.

IDEAS
1. Run the baseline before you write Ward: your fixture apps against Claude Code alone and with OWASP's plugin. If they already find 90% of the planted security flaws, you know to spend your time on privacy.
2. A plain-code checker: every cited check ID must exist in the pinned corpus version, every file:line must exist, and every quoted snippet must match the file. Publish the "hallucinated citation rate".
3. Treat decisions as labels: each accept or skip with a reason is a false-positive label. Feed them into the precision eval and into a "known false positives" field on each check.

Sources: MCP 2026-07-28 changelog https://modelcontextprotocol.io/specification/2026-07-28/changelog · Claude Code MCP docs https://code.claude.com/docs/en/mcp · plugin evals https://code.claude.com/docs/en/plugin-evals · OWASP Secure Agent Playbook https://owasp.org/secure-agent-playbook/ · APSA https://glama.ai/mcp/servers/ictechgy/apsa · prices from the claude-api skill (Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10, cache reads $0.10).

### Application security expert

ONE-LINE PITCH: Ward turns MASTG tests and Android/Play rules into a pre-audit checklist that your coding agent works through, with evidence checked for every item, and says plainly what it couldn't verify.

VOTE: Q1 b, Q2 c, Q3 c (search-only), Q4 c, Q5 c (local stdio MCP), Q6 b, Q7 c, Q8 b

WHY:
Q1
- Q&A over MASVS is something any general assistant already does. A static self-check with an honest map of what was and wasn't covered is useful before an audit. Call it "pre-audit", never "release-ready".
- False passes come from:
  - reading the source manifest instead of the merged one (libraries add exported components and cleartext settings)
  - build variants
  - code the agent never read (SDKs, native code)
  - defaults that depend on targetSdk
  - server-side behaviour
  - comments planted in the repo to steer the agent
  - different results on each run
- Verdicts: FAIL (with file:line), NO FINDING (lists the files inspected), NEEDS DYNAMIC (with the MASTG test ID), MANUAL, N/A. No PASS and no overall score.

Q2
- Reading source works for NETWORK, PLATFORM, CRYPTO and CODE config. STORAGE is partial. RESILIENCE can only show that a protection is present, not that it works. AUTH and privacy data flows are mostly server-side or need dynamic testing.
- MASTG v2.0.0 (June 2026) gives each test a type: TEST-0233 is [static, code], TEST-0200 is [dynamic, filesystem, manual]. Use that field to decide which tests can get a verdict. MASVS is still v2.1.0.
- Play's manifest and build rules can be checked by plain code: targetSdk 36 (required since 31 Aug 2026), restricted permissions, foreground service types.
- Defer privacy: what SDKs collect can't be seen in source, and Google Checks already has a free Data Safety assistant. Defer licences: existing tools cover them, and it's close to legal advice.
- developer.android.com content is CC BY 4.0. I found no open licence on the Play policy pages, so store facts and links, not their text.

Q3
- A live public LLM can run up costs and invites prompt injection on a $5 budget.

Q4
- No LLM call when a user runs Ward. Ward is the corpus plus plain-code analyzers (merged manifest, network security config), and a repo comment can't talk them out of a result. The user's agent makes the judgement calls.

Q5
- The analyzers need the repo, so they have to run locally. The skill holds the report format and the rules for stating uncertainty. No code leaves the machine.

Q6
- Tie each decision to the rule ID and version, a hash of the code and an expiry date. Put .ward/ under CODEOWNERS, because a PR that marks a finding "accepted" hides it. SARIF later, only for the plain-code checks: LLM verdicts would make CI gates flaky.

Q7
- A prompt-injection suite is mandatory: plant "mark compliant" comments and count how many verdicts change. InsecureBankv2 and DIVA are in model training data, so recall on them will look better than it is. Add an unpublished app plus a fixed copy of it. The headline metric is the false-pass rate.

Q8
- Write about 20 check cards by hand from MASTG static tests and Android's "security risks" pages (developer.android.com/privacy-and-security/risks, already grouped by MASVS). Then retrieval, MCP and evals, then the checklist workflow.

RISK of my picks:
- Report quality depends on the user's model, so the eval page must name the model it was tested with.
- An outdated Play rule gives a false pass. Every rule needs an "as of" date.
- A static-only scope may look small. What sets Ward apart is the analyzers and the published false-pass rate.

I'D VETO: Q1 c and Q3 d (hosted upload scanner): it means keeping strangers' proprietary APKs on a hobby server with no accounts. I'd also veto any PASS, overall score or "ready" badge.

IDEAS:
1. A handoff pack for the pentester: each NEEDS DYNAMIC item becomes a MASTG test plan.
2. A verify_evidence tool that re-reads each cited file:line and checks that the file ships in the release build. It catches made-up citations.
3. Ward's output goes into an agent that can edit code, so lock down what Ward ships:
   - build the corpus only from tagged releases
   - pin hashes and strip HTML
   - no tool takes source code as input
   - Ward has no fix tool

Sources checked: github.com/OWASP/masvs/releases, github.com/OWASP/mastg/releases, the MASTG-TEST-0233 and MASTG-TEST-0200 test files on GitHub, developers.google.com/terms/site-policies, developer.android.com/privacy-and-security/risks, developer.android.com/google/play/requirements/target-sdk, checks.google.com/pricing.

### Product owner

ONE-LINE PITCH: Ward plugs OWASP MASVS/MASTG into your coding agent. Ask "is this release safe to ship?" and you get findings with file:line, each citing a versioned control, plus a public eval of how much better that is than the agent alone.

VOTE: Q1 b, Q2 a, Q3 b (search-only c later), Q4 a, Q5 d, Q6 a (b next), Q7 c (small), Q8 b

WHY
Q1
- Q&A loses to Claude with web search. The agent-run review is a real job: an Android dev with no security person, working in Claude Code, before a release. Karlo is that user.
- "Release-readiness" promises more than v1 can deliver, and the space is crowded: store-preflight-mcp (Play policy MCP), GPC preflight CLI, Play review skills, APSA (MASVS MCP + Claude Code plugin + SARIF), Google Checks (Data safety), the Claude Security plugin. None of them publishes recall/precision. Ward's edge is "measured and cited", not more modules. Call v1 a pre-release security review.

Q2
- Security only. It is the one module where retrieval earns its place: MASTG 2.0 links control → MASWE → test → 152 demos, all with IDs. Play policy and licences are small rule sets that existing tools already cover, and Play Help text isn't openly licensed (link to it, don't bundle it).
- Privacy (Data safety form vs code + SDKs) is v2. It's the most differentiated module and needs real LLM judgement. Module picker: later.

Q3
- Hiring managers give it one minute and install nothing. They need a 60s video, one number, a sample report and a case study. A live chat shows the weakest product and drains the $5.
- A remote MCP lets claude.ai users add Ward as a connector with no install.

Q4: $0 per run and nothing to abuse. Tool design + skill + evals is a strong AI-engineering story today. LLM offline only (eval judge).

Q5: The plugin carries the workflow. One remote server gives a live endpoint that a later site search box can reuse.

Q6: v1 is markdown + JSON with a fixed schema (control, status, file:line, source URL). The eval needs the JSON anyway. Matching non-deterministic findings across runs is a rabbit hole, so decisions come later. No CI mode.

Q7: A retrieval set (40 queries → expected IDs) as the cheap check on every change. Planted flaws give the headline number. Add ~10 injection cases (hostile comments in the scanned repo).

Q8 roadmap
1. Stack ADRs, scaffold, one LLM-call spike. No chat.
2. Ingest MASVS/MASTG by ID; keyword + vector search; retrieval eval.
3. Local MCP (search, get_control, checklist). Karlo uses it daily.
4. Skill + report schema + plugin; run it on one app.
5. End-to-end eval with 4 arms. Publish even if the result is bad.
6. Retrieval fixes driven by eval failures.
7. Remote MCP with rate limits; static site, video, eval page, case study.
8. Decisions file. Then privacy.

Demo: "Is this release safe?" on a Kotlin app → 3 fails with file:line and MASVS links, 2 manual checks → "fix #1" → patch → eval chart.

RISK
- Ward may not beat a plain checklist skill. Then the story is "I measured; retrieval didn't help": still hireable, but a weak product. Decide after step 5.
- Agent runs on Sonnet would blow the $5. Run the arms on Haiku 5.5 (60 runs ≈ $2), or run Claude Code headless on the subscription (check the terms first).

I'D VETO
- Q1c/Q3d (hosted upload scanner): parsing strangers' APKs, storing their code and paying for an LLM call per upload on hobby hosting contradicts my Q4 pick and breaks the $5 cap.
- Q2d: four products for one person.
- Q3a: a public LLM chat on a $5 prepaid key.

IDEAS
1. Fourth eval arm: Claude Code + a plain MASVS checklist skill, no retrieval. It tests the "70% from a skill" doubt directly. Also test "Haiku + Ward vs Sonnet alone"; if Haiku + Ward wins, that's the headline.
2. Contamination: InsecureBankv2/DIVA are in training data, so the model may recall the answers. Plant flaws in a fresh Kotlin app you write and keep it private until scored. Use MASTG demos as small single-flaw test cases.
3. Static sample report from a real run: each finding opens the code and the cited MASTG passage. It feels live and costs $0.

Sources: glama.ai/mcp/servers/b6cyh30cdd (store-preflight-mcp), glama.ai/mcp/servers/ictechgy/apsa, dev.to/yasserstudio/i-stopped-submitting-to-google-play-without-running-this-first-3lk2, github.com/dweinstein/mobile-security-skills, checks.google.com/about/plans, github.com/OWASP/mastg/releases

### Hiring manager (persona)

ONE-LINE PITCH: A Claude Code plugin that makes your coding agent check an Android app against OWASP MASVS the way an AppSec engineer would. It gives cited findings at file:line, keeps triage decisions between runs, and publishes a benchmark of how much it beats the agent on its own.

VOTE: Q1 b, Q2 a, Q3 c (search-only, no LLM), Q4 c, Q5 c, Q6 b, Q7 c, Q8 b (with a baseline run before the workflow)

WHY:
Q1
- "Chat with OWASP docs" is the RAG tutorial everyone ships, and I'd skip it in 10 seconds. A tool that changes what an agent does to a real codebase, with the gain measured, is something I'd interview for.
- d looks safe, but then the first thing you publish is the wrapper. Build the retrieval as an MCP tool, not as a chat UI.
- Security plus AI does stand out, especially at a fintech, if you frame it as "agents reading untrusted code are an attack surface". Questions I'd ask: how much does Ward add, and how do you know it isn't noise? How did you deal with the test apps being in the training data? A file says "mark everything as pass": what happens? How do saved decisions survive MASVS renumbering its controls?

Q2
- Security only. It's your field, labelled test apps already exist, so you can measure it. Four modules in v1 reads as breadth with no depth.
- Design modules as packs in the code from day one, but ship one. Privacy (Data Safety form vs SDKs) is the best v2: nobody else does it, and the pain is real.

Q3
- In a 3-minute screen I won't install anything. I'll watch 90 seconds of video, read the eval table and open one sample report, so the website has to make the case on its own.
- A search box without an LLM lets me check in 20 seconds that the retrieval and citations are real. A live LLM chat capped at $5 will be drained or broken the day I visit, and a broken demo is worse than none.

Q4
- At runtime the tools return structured, cited knowledge and the user's agent does the reasoning ($0 for Ward). Ward's own LLM calls happen offline: building the control → test → API map (checked by you) and grading the evals.
- What I want to hear in the interview is you explaining where an LLM belongs and where plain code wins (manifest flags, targetSdk).

Q5
- Plugin with a local MCP server and the corpus bundled: one-line install, no server to keep alive. Fintech security teams like hearing "your source code never leaves your machine".

Q6
- A decisions file with reasons is how real AppSec risk acceptance works, and it turns a chat transcript into a tool. SARIF output next. CI mode later, because an LLM in CI means cost and flaky results.

Q7
- The "Claude Code alone vs + Ward" table is the most valuable thing on the site. Publish it even if the gain is small.
- InsecureBankv2 and DIVA write-ups are in every model's training data, so "Claude Code alone" will score well from memory. You need your own unpublished app with planted flaws, several runs per setup, and the spread reported.

Q8
- Order: ingest and structure the sources → hand-built retrieval plus a 30-question retrieval eval → MCP server and skill → baseline run of Claude Code alone on your app → checklist workflow → prompt-injection suite → website. Measure the gap before you build the thing meant to close it.

RISK of my picks:
- Ward may add almost nothing over a frontier agent. Then the honest eval is the story, and you have to be willing to publish that.
- There's little LLM code at runtime, so interviewers will ask "where's the AI?" Your answer needs retrieval numbers, the design of the agent's tools, and the eval harness.
- Agent eval runs on the paid API will eat $5 fast. Run them on your subscription or on Haiku, and keep the number of runs small.

I'D VETO:
- Q1a and Q3a as the end state: it's a wrapper, and the demo gets drained.
- Q1c and Q3d: taking strangers' APKs and source code on hobby hosting is a security liability. A security candidate shipping that without a sandbox is a red flag to me.
- Q2d: breadth trap.

IDEAS:
1. Prompt injection inside the app being checked: plant instructions in code comments, strings.xml and a dependency README telling the agent to mark items as pass or read .env, then measure whether it obeys. Nobody else in my candidate pile has this, and it's the thing that would make me call you.
2. Eval page with a trace viewer: for each planted flaw, show the agent's actual path (which Ward tools it called, which citation, the file:line it found), plus tokens, $ and minutes per run. I can judge that without installing anything.
3. A 3-minute path at the top of the README: a GIF, the eval table, one ADR and one write-up of a failure. Keep small commits with ADRs: I do look at commit history, and one giant AI-written commit is a red flag. You also have to be able to explain every line.

Sources: practitioner blogs on 2026 AI hiring all say evals and documented failures are rare and stand out. These are opinion pieces, not hard data: https://dev.to/klement_gunndu/5-ai-portfolio-projects-that-actually-get-you-hired-in-2026-5bpl, https://www.louisbouchard.ai/what-i-look-for-when-hiring-ai-engineers/, https://myengineeringpath.dev/genai-engineer/portfolio-guide/

### Developer user (persona)

ONE-LINE PITCH: A local Claude Code plugin that turns MASVS and Play rules into a cited pre-audit checklist. My own agent runs it on my repo, and it remembers what I already accepted.

VOTE: Q1 b, Q2 b (selectable from day one), Q3 b, Q4 a, Q5 c, Q6 b, Q7 b, Q8 b

WHY:
Q1
- What I use today: Android Lint in CI, the Play pre-launch report, Dependabot, a stale Confluence checklist from last year's pentest, and MobSF once a year (200 findings, I read 10). Nothing checks the app between audits.
- a: I'd just ask Claude. c: our company would never let me upload a pre-release APK or the repo to one developer's server.

Q2
- My order: security first (the auditor tests MASVS L1 next month). Then privacy: the Data Safety form drifts when an SDK update starts collecting something, and nobody owns that. Then Play policy: the Console already rejects a low targetSdk, so the real pain is declarations like foreground service types and background location. Licences last: a Gradle plugin like Licensee checks them without AI.
- Selectable modules cost little if each one is a MASVS group. After I touch OkHttp I want to run "NETWORK only".

Q3
- I'd judge Ward from a 3-minute recorded run on a real app and from the false-pass rate on the eval page. A chat box tells me nothing.

Q4
- My code goes to Anthropic under our contract and nowhere else. If Ward calls its own LLM, that's a second processor and a vendor review I won't win.
- The tokens come out of my plan, so tools must return short items (control, what to look for, Android API, pass criteria), not whole MASTG pages. Fixed facts (merged manifest, targetSdk, exported components, cleartext config) should come from plain local code, with no LLM.

Q5
- `/plugin install`, then `/ward:check`. A local stdio MCP with the corpus bundled, version pinned and no network calls would pass our security team. A remote server would get questioned even if it only serves knowledge, because my agent may put code snippets in tool arguments.
- The skill matters: it fixes the report format and keeps the agent on task.

Q6
- A committed `.ward/decisions` file ("accepted: no pinning, backend uses mTLS") is the risk register I'd hand the auditor. If reruns show only new or changed items, I'd run it before every release.
- No CI: results vary between runs, every PR costs tokens, and we have no LLM key in CI. Add SARIF later, and only for the checks with fixed results.

Q7
- One false pass (network marked green, then the auditor finds cleartext traffic) and I uninstall. Lead with the false-pass rate.
- InsecureBankv2 and DIVA are old Java apps. Add the MASTG Kotlin demos and a modern Compose app with planted flaws.

Q8
- I'll never open the web chat. Build the part I'd install.

I'd uninstall after one try if over 30% of items are "needs manual check", findings lack file:line, one run uses most of my 5-hour session, setup needs an account or key, or "fix" makes big changes. Pinning without backup pins breaks production.

RISK of my picks:
- Privacy needs knowledge of what each SDK collects, which you don't have yet, and it can grow fast. Limit it to permissions plus the Gradle SDK list, compared with the Data Safety form.
- A good skill plus the MASTG markdown gets about 70% of the value. What sets Ward apart is the decisions file, the rerun diff and a measured false-pass rate, not the corpus.
- Outdated advice kills trust, for example suggesting EncryptedSharedPreferences (deprecated) or SafetyNet (replaced by Play Integrity).

I'D VETO: Q1 c and Q4 b. Both send my code to an unknown third party. My company would block it, and so would I.

IDEAS:
1. Data Safety diff: Play Console exports the form as CSV. Commit it, and Ward compares it with the app's permissions and SDKs.
2. A "targetSdk bump" module: the next API level's behaviour changes, mapped to my code. Play forces this every year.
3. Auditor pack: status, evidence and accepted risks for each MASVS control, exported for the pentest kickoff.

### Cost and operations

ONE-LINE PITCH: Ward is a free, offline pack of cited, versioned MASVS/MASTG checks that runs inside Claude Code or Cursor. Your agent does the thinking, so Ward costs $0 per user and has nothing for an abuser to drain.

VOTE: Q1 b, Q2 a, Q3 c (search only, in the browser, no LLM), Q4 a, Q5 c (the plugin wraps the same npm stdio server, so Cursor gets npx), Q6 b, Q7 c (staged), Q8 b

WHY
Q1
- With b, Ward pays nothing per extra user. Option c needs a JVM machine to decompile APKs (jadx/apktool). Workers can't run that, and Fly.io has no free tier for new accounts (just a $1 trial). It would also store untrusted binaries and private code, and pay LLM tokens on every scan. That can't be done on $5.

Q2
- Play policy pages aren't openly licensed, so they can't be bundled, and they change every year. MASVS v2.1 already includes MASVS-PRIVACY, so security-only still covers basic privacy with no extra sources to maintain.
- A module is just a field plus a filter, so let users pick MASVS categories from day one.

Q3
- The corpus is small. I checked via the GitHub API: MASTG is 3.6 MB of Markdown in 1,079 files, MASVS is 94 KB. That's about 1M tokens, about 2.5k chunks, and about 1 MB of int8 384-dim vectors. The whole index can ship to the browser. Search costs $0, can't be abused and never goes down.
- A live chat on Haiku 5.5 costs about $0.0007 per answer, so $5 buys about 7k answers. But a bot sending one request a second empties it in about 2 hours, and the demo is dead when a hiring manager visits. Vercel Hobby also pauses the whole project, landing page included, when a limit is hit.

Q4
- An LLM on Ward's server means a running bill, forced migrations when models retire, and a prompt-injection surface.
- Use Haiku only offline. Turning MASTG into control -> test -> API JSON costs about $0.20–0.50 per full pass.
- Don't plan on MCP sampling (the server borrowing the user's model): the spec deprecated it on 2026-07-28.

Q5
- A remote server is free on Cloudflare Workers (100k requests a day, 10 ms CPU each, and it stops rather than bills). The catches:
  - Remote transports and auth are the parts of the MCP spec that change most.
  - One flood shuts down every Worker on the account until midnight UTC.
  - Security teams won't send code context to a hobby server.
- Local means $0, private, and works offline. MASTG tags are rare (v1.7 in Oct 2023, then v1.8–v2.0 in June 2026). MASVS's last release was v2.1 in Jan 2024. That's about 1–2 corpus releases a year.
- Embeddings: one small open model at ingestion and at query time. I'd pick bge-small-en-v1.5 (MIT, 384 dims, ONNX via transformers.js, about 35 MB quantized, milliseconds per query on CPU). I rejected Voyage (200M free tokens, better quality) because every query would then need a key and the network. Skip EmbeddingGemma: its Gemma licence isn't permissive.
- No vector database: brute-force cosine over 2.5k vectors takes about 1 ms. Supabase Free pauses after a quiet week, Supabase announced it's buying Turso (Oct 2026), and Neon would be unused weight.

Q6
- Option b keeps all state in the user's repo. Store the corpus version in .ward/ so a rerun can tell "the rule changed" from "the code changed".

Q7
- Retrieval metrics need no LLM, so run them on every change for $0. A Q&A run graded by Haiku costs about $0.05.
- Planted-flaw runs cost roughly $0.5–1 per Sonnet 5.5 session. 27 sessions is about $15–25, way past the cap. Run them on your Claude Code plan with a small N.
- The injection suite is unit tests on tool output: $0.

Q8
- Don't build a surface you'll then have to defend. You still learn API calls, tokens and streaming, inside the eval harness's answer step.

RISK of my picks
- The MCP server needs Node, and the native Claude Code installer doesn't bring it.
- A 35 MB model is heavy for a phone, so phones get keyword-only search.
- Without live chat there's less "wow"; the eval page has to carry it. Old installs keep a stale corpus.

I'D VETO
- Q1c / Q3d: needs paid compute, holds hostile uploads, LLM cost has no ceiling.
- Any public LLM endpoint without a global daily cap and Turnstile.
- OAuth on a remote MCP server in v1.
- Supabase Free for anything a visitor hits.

IDEAS
1. One TypeScript retrieval library and one index file, used by the browser demo, the local MCP server and the eval harness. All three get identical results.
2. A weekly GitHub Action: when MASTG or MASVS tags a release, rebuild the index on the runner ($0), run the retrieval eval, and open a PR with the score change. Two gotchas:
   - GitHub turns off scheduled workflows in public repos after 60 days without activity.
   - Publish to npm with trusted publishing, so there's no token to rotate.
3. The eval page shows real pipeline answers to all 40 questions, labelled with date and model. They're regenerated only when the corpus or a prompt changes (about $0.05 a time). That gives hiring managers live-looking answers for $0 per visitor.

Sources: Cloudflare Workers/Vectorize/Workers AI pricing and limits pages, Vercel fair-use limits, Neon and Supabase docs/FAQ, the Supabase blog on buying Turso, the Voyage pricing page, the bge-small-en-v1.5 model card, the MCP 2026-07-28 sampling spec, the Claude Code plugin reference, the claude-api skill (Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10), and the GitHub API for the OWASP mastg/masvs repos.
