# Glossary

Terms as they come up in the project. Plain words, one short paragraph
each, plus where it's used in Ward. Alphabetical.

**Chunk.** A small piece of a source document (in Ward, usually one
requirement or one section). Search finds chunks, not whole documents.

**Embedding.** A list of numbers that represents what a piece of text
means. Texts with similar meaning get similar numbers, which is how
search can match "security breach" to "ICT incident".

**RAG (retrieval-augmented generation).** Before the model answers, find
the relevant source chunks and put them in its prompt, so it answers from
those sources instead of from memory.

**Vector database.** A database that stores embeddings and can quickly
find the ones closest to a question's embedding.
