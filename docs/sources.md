# Sources

Every outside document Ward quotes, ships or runs, with its version,
link and licence. Citations keep the attribution and the link.

| Source | Version | Licence | Where Ward uses it |
| --- | --- | --- | --- |
| [OWASP MASVS](https://github.com/OWASP/masvs/tree/v2.1.0) | v2.1.0 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | The 24 control statements, quoted without changes in the eval's checklist skill (`prompts/eval-checklist-plugin/skills/masvs-checklist/SKILL.md`, which carries the attribution and the same licence). IDs in the answer key. |
| [OWASP MASWE](https://github.com/OWASP/maswe/releases/tag/v1.0.0) | v1.0.0 | CC BY-SA 4.0 | IDs only, in the answer key. |
| [OWASP MASTG](https://github.com/OWASP/mastg/releases/tag/v2.0.0) | v2.0.0 | CC BY-SA 4.0 | IDs only, in the answer key. |
| [OWASP Secure Agent Playbook](https://github.com/OWASP/secure-agent-playbook/tree/v0.2.11), plugin `code-security-skills` | v0.2.11, commit 65d4efd | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | An eval arm (plan 2, step 04). Cloned at the pinned tag into the gitignored `evals/.cache/` and run as published; not copied into this repo or redistributed. |

Notes:
- CC BY-SA text sits in its own files, marked with its licence. Ward's
  code stays MIT.
- Versions and licences of the MASVS, MASWE and MASTG IDs in the answer
  key are also in its `sources` header (`evals/answer-keys/`).
