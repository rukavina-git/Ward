# Glossary

Terms as they come up in the project. Plain words, one short paragraph
each, plus where it's used in Ward. Alphabetical.

**Agent.** A model working in a loop with tools (read a file, search, run
a command). It decides what to do next, does it, looks at the result and
repeats until the task is done. In Ward, the user's Claude Code is the
agent; Ward gives it tools and a checklist.

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
padded with lots of other text. Ward pairs it with vector search, because
exact IDs like "MASVS-NETWORK-1" are matched better by keywords than by
meaning.

**Brute-force search.** Compare the query with every stored vector and
keep the closest ones. It's exact and simple; it only gets slow with
millions of vectors. Ward has about 2,500, so it takes about a
millisecond.

**Chunk.** A small piece of a source document (in Ward, usually one
requirement or one section). Search finds chunks, not whole documents.

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

**Decoy.** Code in a test app that looks risky but is fine, like MD5
used only for cache file names. An agent that flags it raises a false
alarm. Decoys and the clean twin keep an agent that flags everything from
looking perfect.

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

**Fixture.** Fixed test input kept in the repo so every run starts from
the same thing. Ward's fixtures are the two Penny Jar apps in
`fixtures/`. Their answer key lives in `evals/`, so an agent given a
fixture never sees the answers.

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

**Hook (Claude Code).** A script Claude Code runs on its own at a set
moment, such as before a shell command or after a file edit. The agent
can't skip it, and its output goes back to the agent. Ward's repo uses
one to block risky commands and one to typecheck and lint after every
edit, so the agent fixes errors right away.

**Hybrid search.** Running keyword search (BM25) and vector search
together and merging their results. Each catches what the other misses:
exact IDs and terms vs. meaning.

**JSON-RPC.** A simple message format for "call this method with these
arguments" and "here is the result", one JSON object per message. An `id`
pairs each reply with its request; a message without an `id` is a
notification that gets no reply. MCP uses it. Over stdio, every line on
stdout must be one of these messages, which is why Ward's server logs
only to stderr.

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

**Plugin (Claude Code).** A package that adds commands, skills and MCP
servers to Claude Code in one install. Ward ships as a plugin.

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

**RAG (retrieval-augmented generation).** Before the model answers, find
the relevant source chunks and put them in its prompt, so it answers from
those sources instead of from memory.

**Recall.** Of all the real issues, the share the agent found. Misses
lower it. Ward's "missed issues" number is the other side of recall.

**Recall@k.** A retrieval score: the share of test queries where a right
chunk appears in the top k results. Recall@5 = "did the right answer make
the top 5?".

**Refusal.** When a model's safety system declines a request. Security
text can trigger this, so Ward's evals count an agent refusing a check
separately from a missed issue.

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

**stdio transport.** One way an AI app talks to an MCP server: the app
starts the server as a child process and they exchange messages over its
standard input and output. Local only, no network. Ward uses it.

**Structured output.** Making the model answer in JSON that fits a schema
you give it, instead of free text. Code can then read the answer without
guessing. Ward's eval passes its findings schema to `claude -p
--json-schema` and validates the answer again with the same file.

**Token.** The unit a model reads and writes, about three quarters of an
English word. API prices are per million input and output tokens.

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
too.

**Trial.** One run of one setup on one input. Models are random, so the
same setup can find 15 issues once and 18 the next time. Ward runs at
least 3 trials per setup and reports the spread, not just one number.

**True positive, false positive, false negative.** The three ways a
finding can line up with the answer key. True positive: a real issue,
flagged. False positive (false alarm): flagged, but not a real issue.
False negative (miss): a real issue nobody flagged. For a check before
publishing, a miss is a false pass.

**Vector database.** A database that stores embeddings and can quickly
find the ones closest to a question's embedding. Ward doesn't need one
(ADR 0003): its index is a file searched in memory.
