# Glossary

Terms as they come up in the project. Plain words, one short paragraph
each, plus where it's used in Ward. Alphabetical.

**Ablation.** Testing a system with one part removed or swapped, to see
what that part adds. Ward runs retrieval with and without vectors, and the
eval with only the plain-code analyzers, so each part has to earn its
place.

**Agent.** A model working in a loop with tools (read a file, search, run
a command). It decides what to do next, does it, looks at the result and
repeats until the task is done. In Ward, the user's Claude Code is the
agent; Ward gives it tools and a checklist.

**Analyzer.** Plain code (no model) that reads an app's files and
returns exact facts with file:line, such as "this provider is exported
with no permission". Same input, same answer, every run. Ward's agent
gets these facts through MCP tools instead of guessing them.

**Build type.** A Gradle setting group such as `debug` or `release` that
changes how the app is built, e.g. `isDebuggable` or minification. A
build variant is a build type plus product flavors (`prodRelease`).
Only the `debug` build type is debuggable by default.

**Answer key (ground truth).** The list of right answers for a test,
written before anything is measured. Ward's answer key lists every issue
planted in the example app, where it is and how the clean twin fixes it.
The scoring script compares an agent's findings with it.

**Approximate index (e.g. HNSW).** A structure vector databases build so
they don't have to compare a query with every vector. It finds almost
the closest ones, much faster, at huge scale. Ward doesn't need one yet;
brute force is fast enough for its corpus.

**Baseline.** The score to beat, measured before the thing you're
building exists. Ward's baseline is what Claude Code finds in the example
app on its own, with a plain checklist and with OWASP's plugin. If Ward
can't beat it clearly, Ward isn't worth installing.

**BM25.** The classic formula for keyword search. A chunk scores higher
when it contains the query's words, especially rare words, and isn't
padded with lots of other text. Ward starts with BM25 plus exact ID
lookup, because IDs like "MASVS-NETWORK-1" are matched better by keywords
than by meaning. Vector search joins only if it beats BM25 (ADR 0009).

**Bootstrap (confidence interval).** A way to see how much a score
could move by chance, using only the data you have. Draw the test queries
again at random, with repeats allowed, thousands of times, and compute
the score each time; the middle 95% of those results is the interval.
Ward uses a paired bootstrap on the MRR difference between two
retrievers: a win counts only if the whole interval sits above 0.

**Brute-force search.** Compare the query with every stored vector and
keep the closest ones. It's exact and simple; it only gets slow with
millions of vectors. Ward has about 2,500, so it takes about a
millisecond.

**Chunk.** A small piece of a source document (in Ward, usually one
requirement or one section). Search finds chunks, not whole documents.

**Chunk size.** How long a chunk may get. Too long and a match on one
sentence drags in pages of unrelated text, and an embedding model cuts
off what it can't read (bge-small stops at 512 tokens). Too short and
the chunk loses its context. Ward's limit is 1,500 characters, about
375 tokens.

**Chunking.** Splitting documents into chunks before search. Ward splits
by structure: one chunk per `##` section, long sections at blank lines,
one chunk per demo code file. The common alternative, fixed-size windows
with overlap, cuts through sentences and loses the section a piece
belongs to.

**Citation fields.** The fields every chunk carries so a citation can be
built from data instead of generated: source URL at the pinned tag (with
a heading anchor), version and licence. A model can't make up a link it
only copies.

**Citation checker.** Plain code that checks what a model cited after it
answers: every ID is in the pinned index, every file:line exists, every
quote is really in the file. The model can still be wrong about a
verdict, but it can't invent evidence that gets shown. Ward's is the
`check_report` tool (plan 5 step 03).

**Clean twin.** A copy of the test app with every planted issue fixed
and nothing else changed. Anything an agent flags in it is a false
alarm (or a real issue nobody planted). It measures precision the way
the planted app measures recall.

**Contamination (training-data).** When test material was in the model's
training data, so the model "remembers" the answers instead of working
them out. Well-known vulnerable apps like InsecureBankv2 are
contaminated, which is why Ward's evals use its own example app.

**Corpus.** All the source text Ward can search: for v1, OWASP MASVS
and MASTG, split into about 2,500 chunks. "The library of documents."

**Cosine similarity.** How Ward measures whether two embeddings are
close. It compares the direction of the two lists of numbers; higher
means closer in meaning. The scale depends on the model: with bge models
even unrelated texts score fairly high, so Ward's "nothing relevant"
cut-off has to be measured, not guessed.

**CVE.** A public ID for one known vulnerability, like CVE-2022-25647
(a Gson bug). Advisory databases list which versions of which library
each CVE affects. Ward's dependency check names the CVE next to the
advisory ID so you can look it up.

**Decoy.** Code in a test app that looks risky but is fine, like MD5
used only for cache file names. An agent that flags it raises a false
alarm. Decoys and the clean twin keep an agent that flags everything from
looking perfect.

**Defensible finding.** A flag that's a fair question but not a defect,
like "backup is on, is that intended?" when backup rules exist. Ward's
scorer counts it as neither a false alarm nor a hit (ADR 0009).

**Dev/test split.** Dividing an eval's queries into two fixed sets. You
look at and tune on dev; test is only run to report, so its score shows
how search does on questions it wasn't tuned for. Ward keeps each
answer key item's queries on one side, so dev can't teach test's words.

**Dimensions (of an embedding).** How many numbers are in one embedding,
e.g. 384. More dimensions can capture more nuance but take more space.
All embeddings in one index must have the same dimensions.

**Embedding.** A list of numbers that represents what a piece of text
means. Texts with similar meaning get similar numbers, which is how
search can match "security breach" to "ICT incident".

**Embedding space.** The "coordinate system" a model's embeddings live
in. Embeddings are only comparable inside one space, usually meaning one
model. Some families (like Voyage 4) share one space across several
model sizes.

**Eval.** A repeatable test of AI quality: fixed inputs, known right
answers, a script that scores the output. Ward's evals measure missed
issues, false passes and made-up citations.

**Eval arm.** One setup in a comparison, run on the same tasks as the
others. Arms should differ in one thing only, so a difference in scores
has one cause. Ward's arms share the model, prompt, tools and app copy;
only the plugin changes (none, a checklist, OWASP's, later Ward).

**Eval harness.** The test rig around an AI system: it gives the system
the same input every time, runs it, collects what it returns and scores
that against the answer key, all in code. Ward's harness (`evals/`)
copies Penny Jar to a temp folder, runs `claude -p` on it and scores the
findings. Only the setup changes between arms.

**False pass.** The tool says nothing is wrong, but something is. For a
security check it's the worst kind of error, so Ward never says "PASS",
only "NO FINDING", with the files it inspected.

**Fix commit / parent commit.** On GitHub, the commit where a developer
fixed a security problem, and the commit just before it. The parent still
has the problem, so it's a real "broken app"; the fix is its clean twin.
Ward's held-out set stores both hashes, never the code.

**Fixture.** Fixed test input kept in the repo so every run starts from
the same thing. Ward's fixtures are the two Penny Jar apps in
`fixtures/`. Their answer key lives in `evals/`, so an agent given a
fixture never sees the answers.

**Freezing (an eval set).** Fixing a test set's contents and committing
its hash before anything is run or built against it, so the git history
proves the answers weren't changed to fit a result.

**Front matter.** A block of YAML fields at the top of a markdown file,
between `---` lines: ID, title, status, links. MASWE and MASTG files
carry their IDs and mappings there. Ward's ingest reads it as data and
keeps the rest of the file as the body.

**Gate (go/no-go).** A cheap test placed before expensive work, with
its pass/fail rule written first. Ward's gate (plan 4, step 02) ran
Claude alone on 10 real fixes before any analyzer was built: if Claude
had aced it, Ward would have stopped.

**Hallucinated citation.** A reference the model made up: a file or line
that doesn't exist, or an ID that isn't in the standard. Ward's scorer
counts citations to missing files and lines past the end; checking IDs
comes with plan 3's index.

**Hand grading.** A person deciding the cases code can't match safely,
such as a finding in the right file but about something else. In Ward,
the scorer writes these to `grades.json` with a suggestion, and Karlo
labels each one. A score with ungraded findings is marked provisional.

**Headless mode (`claude -p`).** Running Claude Code from a script
instead of the chat window: you pass a prompt, it does the work and
prints the result, optionally as JSON with token use and an estimated
cost. It runs on your Claude plan, no API key. Ward's eval runs use it
(ADR 0007).

**Held-out set.** Test cases kept apart from everything you build or
tune on, so a good score can't come from knowing the answers. Ward's are
real security fixes from open-source apps, frozen before any check is
written.

**Hook (Claude Code).** A script Claude Code runs on its own at a set
moment, such as before a shell command or after a file edit. The agent
can't skip it, and its output goes back to the agent. Ward's repo uses
one to block risky commands and one to typecheck and lint after every
edit, so the agent fixes errors right away.

**Hybrid search.** Running keyword search (BM25) and vector search
together and merging their results. Each catches what the other misses:
exact IDs and terms vs. meaning.

**Hyperparameter tuning.** Trying different settings of a method (not
its data) and keeping the ones that score best. Done on the dev split only,
then the test split is scored once, so the result isn't flattered by the
tuning. Ward tuned BM25's k1, b, stemming and code weight this way.

**IDF (inverse document frequency).** How rare a word is across the
corpus. Rare words ("webview") get a high IDF and count a lot in BM25;
common words ("app") count little. Ward computes it from the 2,000-odd
chunks when the search index is built.

**Index file.** Ward's whole searchable knowledge base in one file
(`packages/core/data/index.json`): records, their links, and the chunks
with their text. It ships with the code and is read into memory, so
search needs no database and no network (ADR 0003).

**Ingestion.** Turning outside documents into data a system can search:
download, parse, clean, link, check. Ward's ingest clones MASVS, MASWE
and MASTG at pinned versions and writes one record per ID.

**Inverted index.** A map from each word to the chunks that contain it
and how often, like the index at the back of a book. A search only looks
at the chunks listed under its own words. Ward builds one in memory from
the index file when the first search runs.

**JSON-RPC.** A simple message format for "call this method with these
arguments" and "here is the result", one JSON object per message. An `id`
pairs each reply with its request; a message without an `id` is a
notification that gets no reply. MCP uses it. Over stdio, every line on
stdout must be one of these messages, which is why Ward's server logs
only to stderr.

**JSON Schema.** A standard way to describe what a JSON document must
look like: which fields, which types, which values are allowed. Ward
writes its report schema in zod (TypeScript) and generates the JSON
Schema from it, so other tools can check a report too.

**Knowledge graph.** Records joined by typed links instead of loose text.
Ward's graph is control → weakness (MASWE) → test → demo, stored both
ways, so a control can list its tests and a cited test can name its
control.

**L2 normalisation.** Scaling a vector so its length is 1, keeping its
direction. Then the cosine similarity of two vectors is just their dot
product. Ward normalises every embedding once, when it's made.

**Leakage.** When the answer to a test reaches the system under test, so
the score measures lookup, not skill. MASTG demos can't be Ward's held-out
cases: they're in Ward's own index.

**Length normalisation (b).** BM25's setting for how much a long chunk
is penalised, since long text matches many words by chance. 0 ignores
length, 1 penalises fully; 0.75 is the usual default, and Ward kept it.

**LLM (large language model).** The model that reads text and writes
text, such as Claude. Ward never calls one itself (ADR 0007): the user's
agent does the reasoning, and Karlo's offline work runs in Claude Code on
his plan.

**Marketplace (Claude Code).** A git repo that lists plugins, so users can
add it once and install plugins from it. Ward's repo is its own
marketplace.

**MCP (Model Context Protocol).** A standard way for an AI app like
Claude Code to use outside tools and data. Ward is an MCP server: it
offers tools like "get the checklist" and "search the standards".

**Matched terms.** For one search result, the words of the query that
actually appear in it; "unmatched terms" are query words found nowhere in
the index. BM25 always returns something, even for nonsense, so these
lists are the agent's honest clue: a hit that matched only "in" and "the"
is probably unrelated. Ward's `search` tool returns both, with no cutoff.

**Merged manifest.** The one AndroidManifest.xml that Gradle builds from
the app's manifests, every library's manifest and build-type values
(such as `isDebuggable`). It's what ships, so Ward prefers it. It exists
only after a build, under `build/intermediates/`.

**Network security config (NSC).** An XML file an Android app points to
from its manifest. It says, per domain, whether cleartext HTTP is
allowed, which certificate authorities to trust (system, user-installed)
and which certificates to pin. Debug-only settings go in
`debug-overrides`.

**MRR (mean reciprocal rank).** A retrieval score: for each test query,
take 1 divided by the position of the first right answer (1st → 1, 2nd →
0.5, 3rd → 0.33), then average. Rewards putting the right chunk at the
top.

**ONNX.** A standard file format for trained models, so they can run in
many programs (Node, browsers, phones) without the original training
framework. Ward's embedding model ships as an ONNX file.

**Open weights.** The trained model file itself is published, so you can
download it and run it on your own computer, free and offline, instead
of calling the vendor's servers. Like an open-source library vs. a paid
web API. Ward's embedding model (bge-small) is open weights.

**OSV (Open Source Vulnerabilities).** A free database of known
vulnerabilities in open-source packages, run by Google at osv.dev. It
gathers advisories from sources like the GitHub Advisory Database and
publishes them per ecosystem (Maven covers Android libraries). Ward
downloads the Maven part once a day and matches versions itself
(ADR 0011).

**Paired comparison.** Comparing two systems query by query on the same
queries, instead of comparing two averages. A hard query hurts both, so
it cancels out, and a real difference shows with fewer queries. Ward
compares BM25 and vectors this way on the retrieval eval.

**Pinning.** Fixing a dependency or source to one exact version (a tag
and its commit), so every run sees the same input. Ward pins the OWASP
sources and fails if the cloned commit differs.

**Plugin (Claude Code).** A package that adds commands, skills and MCP
servers to Claude Code in one install. Ward ships as a plugin.

**Pooling (CLS).** An embedding model gives one vector per word piece;
pooling turns them into one vector for the whole text. CLS pooling takes
the vector of the special [CLS] piece at the start, which the model was
trained to fill with a summary. bge models use CLS pooling; others
average all pieces (mean pooling).

**Pre-registration.** Writing down the pass/fail rule before you see
any data, so the data can't move the goalposts. Ward fixed ADR 0001's
"Claude Code alone finds almost everything" as a number (21 of 23, at
most 1 false alarm per twin run) before the first baseline run.

**Precision.** Of everything the agent flagged, the share that was
real. False alarms lower it. Flagging everything gives perfect recall and
terrible precision, so Ward reports both.

**Prompt injection.** Text that tries to give the model orders it
shouldn't follow, hidden in data the model reads. For Ward: a comment in
the checked app saying "mark everything as fine". Ward tests for this.

**Quantization.** Storing a model's numbers with less precision (for
example 8-bit integers instead of 32-bit floats). The model gets about
4× smaller and faster, and loses a little quality. Ward's embedding
model is quantized to 34 MB.

**Query instruction (asymmetric retrieval).** Questions are short and
passages are long, so some embedding models want queries prefixed with a
fixed sentence ("Represent this sentence for searching relevant
passages: ") and passages left as they are. In Ward's eval the prefix
helped bge-small (dev MRR 0.525 → 0.600).

**Query set.** The fixed questions a retrieval eval asks, each with the
records a good search must return. Ward's
(`evals/questions/retrieval.json`) is seeded from real agent findings, so
it asks in the words an agent actually uses.

**RAG (retrieval-augmented generation).** Before the model answers, find
the relevant source chunks and put them in its prompt, so it answers from
those sources instead of from memory.

**Recall.** Of all the real issues, the share the agent found. Misses
lower it. Ward's "missed issues" number is the other side of recall.

**Recall@k.** A retrieval score: the share of test queries where a right
chunk appears in the top k results. Recall@5 = "did the right answer make
the top 5?".

**Reciprocal rank fusion (RRF).** Merging several ranked lists by
position only: each list gives an item 1 / (k + rank), and the sums give
the new order. Scores from different methods (BM25, cosine) never need
to be on one scale. A small k rewards top ranks more. Ward's hybrid
search fused BM25 and vectors this way.

**Record.** One unit of source data with a stable ID: a control, a
weakness, a test or a demo. It keeps its text, its links and where it
came from (URL at the tag, version, commit, licence), so citations are
built from fields, never generated.

**Refusal.** When a model's safety system declines a request. Security
text can trigger this, so Ward's evals count an agent refusing a check
separately from a missed issue.

**Relevance labels (qrels).** For each query in a query set, the list of
results that count as right. Short for "query relevance judgments".
Ward's are record IDs, taken from the answer key, not from what the
agent cited.

**Report skeleton.** Ward's report handed to the agent half filled: every
control and test in scope, IDs and titles copied from the index, and the
analyzers' verdicts already in place. The agent fills the empty verdicts
instead of writing a report from memory, so it can't skip a control or
invent an ID unnoticed.

**Retriever.** Anything that takes a query and returns a ranked list of
results. Ward's first is exact ID lookup; BM25 and vector search come
next. All are scored by the same eval, so they can be compared fairly.

**Rollup.** Deriving a parent's verdict from its children by a fixed
rule. Ward's is strict and in code: the worst test verdict becomes the
control's, so a control is never NO FINDING while one of its tests is
MANUAL, NEEDS DYNAMIC or not yet checked.

**Skill.** A set of written instructions Claude Code loads for a task.
Ward's skill tells the agent how to run the check and how to write the
report.

**Skill triggering.** Whether an agent decides on its own to use a
skill it was given. A skill only helps if its description makes the
agent reach for it. The eval records which skills each run invoked,
because Ward's own skill will face the same test.

**Spread.** How much results vary between trials of the same arm,
shown as the lowest and highest score next to the average. A model gives
different answers each run, so one trial can be lucky; a gap between arms
smaller than their spread isn't a real difference.

**Standard error.** The noise in an average: how far the average would
move if you swapped in a different set of similar queries. It shrinks
with the square root of the count, so 4× the queries halves it. For MRR
it's roughly 0.35 / √n: ±0.09 at 17 queries, ±0.045 at 60.

**stdio transport.** One way an AI app talks to an MCP server: the app
starts the server as a child process and they exchange messages over its
standard input and output. Local only, no network. Ward uses it.

**Stemming.** Cutting word endings so forms of a word match: "keys" and
"key", "logged" and "logging". Ward uses a small hand-written stemmer
(plurals, -ing, -ed, -ly), on in the tuned search; IDs are never stemmed.

**Stopwords.** Very common words ("the", "of", "is") that a search may
drop. BM25's IDF already gives them little weight. In Ward's tuning,
dropping them didn't help, so the tuned search keeps them.

**Structured output.** Making the model answer in JSON that fits a schema
you give it, instead of free text. Code can then read the answer without
guessing. Ward's eval passes its findings schema to `claude -p
--json-schema` and validates the answer again with the same file. In MCP,
a tool can do the same: it returns `structuredContent` (JSON with fixed
fields) next to the usual text, so the agent can copy IDs and citation
URLs exactly. Ward's tools send both.

**Term frequency saturation (k1).** BM25's setting for how much a word
repeated in one chunk adds: the first match counts most, later ones less
and less. Lower k1 saturates faster. Ward's tuned search uses 0.9 (the
default is 1.2).

**Token.** The unit a model reads and writes, about three quarters of an
English word. API prices are per million input and output tokens.

**Tokenizer.** The code that cuts text into tokens. For BM25 in Ward a
token is a lower-case word, or a whole OWASP ID like `maswe-0067`, so an
ID is never split into "maswe" and "0067". (A model's tokenizer is a
different thing: it cuts text into sub-word pieces.)

**Tool call.** When the model, instead of replying with text, asks the
app to run a tool: "call `hello` with `{name: "Karlo"}`". The app runs it
(for MCP tools, by sending a JSON-RPC request to the server), puts the
result back into the conversation, and the model continues from there.
The user's agent will get Ward's checklist this way.

**Tool schema.** A tool's name, description and the shape of its input
(as JSON Schema). It is all the model knows about a tool; it never sees
the code. So the description works like a small prompt: it decides
whether the model picks the tool. Claude Code first shows the model only
MCP tool names and loads a full schema when needed, so the name matters
too. Ward's schemas also cap inputs (a query is at most 500 characters):
the server rejects a bad call before any Ward code runs. Tool
annotations add hints such as "read-only".

**Transcript (trace).** The full record of one agent run, message by
message: what the model said, each tool call with its input, and each
result. It shows how an answer came about, not just the answer. Ward's
eval runs keep it as `transcript.jsonl` (local, unedited; its hash goes
in meta.json) and pull the Ward calls and search queries out of it.

**Training cutoff.** The date a model's training data ends. A fix made
after it can't be in what the model learned, so it tests reasoning, not
memory. Sonnet 5.5 and Opus 5.5: June 2026.

**Transitive dependency.** A library your app gets because another
library needs it, not because you declared it. Gson pulled in by a
networking library is transitive. Seeing them takes Gradle's resolver;
Ward reads only what the build files declare, so it lists that as a limit.

**Tree export (git archive).** Writing out the files of one commit
without the `.git` folder, so there is no history. Held-out runs use it:
the history holds the fix, and the agent must not see the answer.

**Trial.** One run of one setup on one input. Models are random, so the
same setup can find 15 issues once and 18 the next time. Ward runs at
least 3 trials per setup and reports the spread, not just one number.

**True positive, false positive, false negative.** The three ways a
finding can line up with the answer key. True positive: a real issue,
flagged. False positive (false alarm): flagged, but not a real issue.
False negative (miss): a real issue nobody flagged. For a check before
publishing, a miss is a false pass.

**Truncation (token limit).** A model reads at most a fixed number of
word pieces (512 for bge-small); anything after that is cut and never
seen. In Ward, 123 of 2,132 chunks were longer than that, mostly demo
code.

**Vector database.** A database that stores embeddings and can quickly
find the ones closest to a question's embedding. Ward doesn't need one
(ADR 0003): its index is a file searched in memory.

**Version range.** How an advisory says which versions are affected:
"introduced in 0, fixed in 2.8.9" means everything before 2.8.9. Checking
a version against it needs the ecosystem's version order (in Maven,
1.0-rc1 comes before 1.0, and 1.10 after 1.9), which Ward codes by hand.

**XXE (XML external entity).** An attack hidden in an XML file: a
DOCTYPE declares an "entity" that points at a local file or URL, and a
careless parser pastes that file's content into the document. Ward's
parser rejects any DOCTYPE and never expands entities.
