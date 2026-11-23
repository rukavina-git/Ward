# Sources

Every outside document Ward quotes, ships or runs, with its version,
link and licence. Citations keep the attribution and the link.

| Source | Version | Licence | Where Ward uses it |
| --- | --- | --- | --- |
| [OWASP MASVS](https://github.com/OWASP/masvs/tree/v2.1.0) | v2.1.0, commit 8e133d0 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Ingested into the knowledge base (plan 3): `controls/`. The 24 control statements, quoted without changes in the eval's checklist skill (`prompts/eval-checklist-plugin/skills/masvs-checklist/SKILL.md`, which carries the attribution and the same licence). IDs in the answer key. |
| [OWASP MASWE](https://github.com/OWASP/maswe/releases/tag/v1.0.0) | v1.0.0, commit 308b82b | CC BY-SA 4.0 | Ingested into the knowledge base (plan 3): `weaknesses/`, Android only. IDs in the answer key. |
| [OWASP MASTG](https://github.com/OWASP/mastg/releases/tag/v2.0.0) | v2.0.0, commit 990472d | CC BY-SA 4.0 | Ingested into the knowledge base (plan 3): `tests-beta/android`, `tests/android` (deprecated, kept for redirects), `demos/android`. IDs in the answer key. |
| [bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) (BAAI), ONNX export [Xenova/bge-small-en-v1.5](https://huggingface.co/Xenova/bge-small-en-v1.5/tree/ea104dacec62c0de699686887e3f920caeb4f3e3) | commit ea104da, `onnx/model_quantized.onnx` sha256 6c9c6101… (full hashes in `packages/ingest/src/model.ts`) | MIT | Embedding model for the vector comparison (plan 3 step 06, ADR 0010). Downloaded at the pinned commit into the gitignored `packages/ingest/.cache/`; not shipped, since vectors lost to BM25. |
| [Android `Manifest.permission` reference](https://developer.android.com/reference/android/Manifest.permission) | read 2026-11-23 | Android docs: CC BY 4.0 text, Apache 2.0 code samples (footer not re-checked) | Names of the permissions with protection level "dangerous", listed in `packages/analyzers/src/permissions.ts` (plan 4 step 04). Names only (API identifiers), no text. |
| [OWASP Secure Agent Playbook](https://github.com/OWASP/secure-agent-playbook/tree/v0.2.11), plugin `code-security-skills` | v0.2.11, commit 65d4efd | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | An eval arm (plan 2, step 04). Cloned at the pinned tag into the gitignored `evals/.cache/` and run as published; not copied into this repo or redistributed. |

Notes:
- CC BY-SA text sits in its own files, marked with its licence. Ward's
  code stays MIT.
- Versions and licences of the MASVS, MASWE and MASTG IDs in the answer
  key are also in its `sources` header (`evals/answer-keys/`).
- The knowledge base ships as `packages/core/data/index.json`, chunked
  from the three MAS sources above, under CC BY-SA 4.0 with its own
  `LICENSE` (OWASP's licence file, copied verbatim) and `NOTICE`
  (attribution, pinned commits, what was changed). `@ward/core` declares
  `MIT AND CC-BY-SA-4.0`.

Code dependencies with native or model parts (plan 3 step 06), dev-time
only, in `packages/ingest`; none ships in `@ward/core`:
- `onnxruntime-node` 1.30.0 (MIT), with `onnxruntime-common` (MIT),
  `adm-zip` (MIT), `global-agent` (BSD-3-Clause). The CPU binaries ship
  in the package. Locally npm skipped its install script (not approved
  under allowScripts); whether CI's `npm ci` runs it isn't verified.
- `@huggingface/tokenizers` 0.2.0 (Apache-2.0), no dependencies.
- Rejected: `@huggingface/transformers` (Apache-2.0), because it pulls in
  `sharp`, whose `@img/sharp-libvips-*` binaries are LGPL-3.0-or-later.

Code dependencies of the analyzers (plan 4 step 04), shipped in
`@ward/analyzers`:
- `saxes` 6.0.0 (ISC), XML parser with line numbers, with `xmlchars`
  (MIT).
