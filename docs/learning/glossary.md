# Glossary

Terms as they come up in the project. Plain words, one short paragraph
each, plus where it's used in Ward. Alphabetical.

**Agent.** A model working in a loop with tools (read a file, search, run
a command). It decides what to do next, does it, looks at the result and
repeats until the task is done. In Ward, the user's Claude Code is the
agent; Ward gives it tools and a checklist.

**Approximate index (e.g. HNSW).** A structure vector databases build so
they don't have to compare a query with every vector. It finds almost
the closest ones, much faster, at huge scale. Ward doesn't need one yet;
brute force is fast enough for its corpus.

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

**False pass.** The tool says nothing is wrong, but something is. For a
security check it's the worst kind of error, so Ward never says "PASS",
only "NO FINDING", with the files it inspected.

**Headless mode (`claude -p`).** Running Claude Code from a script
instead of the chat window: you pass a prompt, it does the work and
prints the result, optionally as JSON with token use and an estimated
cost. It runs on your Claude plan, no API key. Ward's eval runs use it
(ADR 0007).

**Hybrid search.** Running keyword search (BM25) and vector search
together and merging their results. Each catches what the other misses:
exact IDs and terms vs. meaning.

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

**Recall@k.** A retrieval score: the share of test queries where a right
chunk appears in the top k results. Recall@5 = "did the right answer make
the top 5?".

**Refusal.** When a model's safety system declines a request. Security
text can trigger this, so Ward's evals count an agent refusing a check
separately from a missed issue.

**Skill.** A set of written instructions Claude Code loads for a task.
Ward's skill tells the agent how to run the check and how to write the
report.

**stdio transport.** One way an AI app talks to an MCP server: the app
starts the server as a child process and they exchange messages over its
standard input and output. Local only, no network. Ward uses it.

**Token.** The unit a model reads and writes, about three quarters of an
English word. API prices are per million input and output tokens.

**Vector database.** A database that stores embeddings and can quickly
find the ones closest to a question's embedding. Ward doesn't need one
(ADR 0003): its index is a file searched in memory.
