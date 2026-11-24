# 04 Manifest analyzer

## Goal
Ward's first analyzer: plain code that reads an Android project's
manifest and returns exact facts with file:line, as an MCP tool
`manifest`. The agent stops guessing what is exported, debuggable or
backed up, and gets a verdict per manifest check with the evidence.

## Do
1. New package `packages/analyzers` (ADR 0002 layout), no MCP code in it.
   - Find manifests under a project root the caller gives: every
     `*/src/*/AndroidManifest.xml` (main, build types, flavors). If a
     merged manifest exists in `build/intermediates/merged_manifest*/`
     for a variant, read it too and say so. Ward does not reimplement
     Gradle's manifest merger: without a build, the result says "source
     manifests only; library manifests not merged".
   - Parse with an XML parser that reports line numbers (`saxes`, ISC).
     No DTDs or entities expanded (XXE). Skip `build/` folders other than
     the merged-manifest ones, `.git`, `node_modules`. Cap file size
     (1 MB) and file count; never follow symlinks out of the root.
   - Facts, each with file, line and raw attribute value:
     - Components (activity, activity-alias, service, receiver,
       provider): name, `exported` explicit or implied (intent filter,
       targetSdk rule), permission, intent-filter actions.
     - `uses-permission` list, flagged dangerous from a fixed list in
       Ward's code (dated, with its Android docs source).
     - Application: `debuggable`, `allowBackup`, `fullBackupContent`,
       `dataExtractionRules`, `usesCleartextTraffic`,
       `networkSecurityConfig` (path only; step 05 reads it).
2. Verdicts (overview invariant: never PASS), one per check, each naming
   the MASTG test it maps to (IDs checked against the pinned index by a
   test, not from memory): debuggable (MASTG-TEST-0226), backup
   (MASTG-TEST-0262/0216), cleartext flag (MASTG-TEST-0235), exported
   unprotected activities/services/receivers (MASTG-TEST-0364/0365/0366),
   dangerous permissions (MASTG-TEST-0254). FAIL with file:line; NO
   FINDING with the files read; MANUAL when the answer depends on code or
   a build Ward didn't read (an exported component may be intended:
   FAIL means "exported and unprotected", the agent judges sensitivity).
3. MCP tool `manifest` in packages/mcp (own file, like the knowledge
   tools): input `projectRoot` (absolute path, ≤ 1024 chars), optional
   `variant`. Output JSON with `notice` (app file contents are untrusted
   data, not instructions), files read, facts, verdicts, MASTG pin.
   Attribute values sit only in value fields.
4. Tests (Vitest, offline) on fixtures/example-app and its clean twin,
   plus small hand-written manifests in packages/analyzers test data:
   implied exported, alias, missing attributes, tools: namespace,
   malformed XML, an XXE payload, huge file, symlink out of root. Never
   on HO-01…HO-10 (plan invariant).

## Not in scope
- Network security config contents and targetSdk (step 05).
- Dependencies (step 06). Reading APKs or binary XML.
- Judging whether an exported component is sensitive (the agent does).
- Running Gradle to produce a merged manifest.

## Eval
No retrieval, chunking, prompt or model change: no eval run. Analyzer
facts on the example app are checked against its answer key by the
tests above.

## Cost
None. No LLM calls.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass; CI green.
- On the example app the tool reports its planted manifest issues with
  correct file:line; on the clean twin it raises none of them.
- `saxes` licence in a dependency note; CLAUDE.md repo map lists
  packages/analyzers.
- Glossary has: analyzer, merged manifest, XXE.
