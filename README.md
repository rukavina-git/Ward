# Ward

**Check your Android app before you publish it.**

Ward is a pre-publish check that runs inside your coding agent. Add it to Claude Code as a
plugin, ask "is this app ready to publish?", and your agent works through Ward's checklist:
security first, then privacy and GDPR. Every finding cites the rule it comes from.

> Status: early development.

## Install

In Claude Code (needs Node 26 on your PATH):

```
/plugin install ward --marketplace rukavina-git/Ward
```

On older Claude Code: `/plugin marketplace add rukavina-git/Ward`, then
`/plugin install ward@ward`. Restart Claude Code, open your Android project and run
`/ward:check`. Ward writes `.ward/report.json` and prints a one-screen summary. The only
network call is the OSV advisory download (osv-vulnerabilities.storage.googleapis.com),
cached for 24 hours.

## What it will do

- **Check what's easy to forget.** Security (OWASP MASVS/MASTG), then privacy and GDPR. Later: Play policy and licences.
- **Cite every finding.** Each one has a file and line, the exact rule it breaks, and a fix.
- **Say what it couldn't verify.** No "PASS" badges: items it can't check from code are marked for manual or dynamic testing.
- **Remember your decisions.** Triage the report in your browser (fix, accept, skip). Decisions are saved in your repo.
- **Stay on your machine.** Ward runs locally and makes no AI calls of its own; your agent does the work.
- **Publish its scores.** A public eval compares Claude Code with and without Ward, including where Ward fails.

## Sources (planned)

- OWASP MASVS and MASTG (mobile)
- Android developer documentation
- GDPR and EU guidance (privacy module)

Ward is an independent project and is not affiliated with or endorsed by the OWASP Foundation.
Its source material is used under each source's own licence.

## Architecture (planned)

1. **Knowledge:** sources split into chunks by requirement and test, embedded locally, shipped as an index file.
2. **Retrieval:** keyword + vector search, built by hand.
3. **MCP server:** local tools for the checklist, single checks and search.
4. **Analyzers:** plain code for facts with exact answers (merged manifest, network config, targetSdk, dependencies).
5. **Evals:** an example app with planted issues, scored automatically.

## Licence

Code: MIT. Source documents keep their original licences.
