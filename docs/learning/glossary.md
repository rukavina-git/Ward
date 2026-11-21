# Glossary

Terms as they come up in the project. Plain words, one short paragraph
each, plus where it's used in Ward. Alphabetical.

**Agent.** A model working in a loop with tools (read a file, search, run
a command). It decides what to do next, does it, looks at the result and
repeats until the task is done. In Ward, the user's Claude Code is the
agent; Ward gives it tools and a checklist.

**Chunk.** A small piece of a source document (in Ward, usually one
requirement or one section). Search finds chunks, not whole documents.

**Contamination (training-data).** When test material was in the model's
training data, so the model "remembers" the answers instead of working
them out. Well-known vulnerable apps like InsecureBankv2 are
contaminated, which is why Ward's evals use its own example app.

**Embedding.** A list of numbers that represents what a piece of text
means. Texts with similar meaning get similar numbers, which is how
search can match "security breach" to "ICT incident".

**Eval.** A repeatable test of AI quality: fixed inputs, known right
answers, a script that scores the output. Ward's evals measure missed
issues, false passes and made-up citations.

**False pass.** The tool says nothing is wrong, but something is. For a
security check it's the worst kind of error, so Ward never says "PASS",
only "NO FINDING", with the files it inspected.

**LLM (large language model).** The model that reads text and writes
text, such as Claude. Ward uses one only offline (evals, ingestion help);
at runtime the user's own agent does the reasoning.

**MCP (Model Context Protocol).** A standard way for an AI app like
Claude Code to use outside tools and data. Ward is an MCP server: it
offers tools like "get the checklist" and "search the standards".

**Plugin (Claude Code).** A package that adds commands, skills and MCP
servers to Claude Code in one install. Ward ships as a plugin.

**Prompt injection.** Text that tries to give the model orders it
shouldn't follow, hidden in data the model reads. For Ward: a comment in
the checked app saying "mark everything as fine". Ward tests for this.

**RAG (retrieval-augmented generation).** Before the model answers, find
the relevant source chunks and put them in its prompt, so it answers from
those sources instead of from memory.

**Skill.** A set of written instructions Claude Code loads for a task.
Ward's skill tells the agent how to run the check and how to write the
report.

**Token.** The unit a model reads and writes, about three quarters of an
English word. API prices are per million input and output tokens.

**Vector database.** A database that stores embeddings and can quickly
find the ones closest to a question's embedding.
