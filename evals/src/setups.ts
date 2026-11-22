/** Where an arm's plugin comes from. */
export type PluginSource =
  /** A folder in this repo, relative to its root. */
  | { kind: "local"; path: string }
  /** A public git repo at a pinned tag; the commit guards against a moved tag. */
  | { kind: "git"; url: string; tag: string; commit: string; subdir: string };

/** One arm of the eval. Arms differ only in their plugin (and extra flags). */
export interface Setup {
  description: string;
  /** Flags added to the common ones in run.ts. */
  flags: string[];
  /** The plugin this arm adds. `name` is the one in its plugin.json. */
  plugin?: { name: string; source: PluginSource };
}

export const setups: Record<string, Setup> = {
  alone: {
    description:
      "Claude Code alone: no CLAUDE.md, user settings, user plugins, MCP servers, hooks or auto memory.",
    flags: [],
  },
  checklist: {
    description:
      "Claude Code + a plain checklist skill: the 24 MASVS v2.1.0 control statements, nothing else.",
    flags: [],
    plugin: {
      name: "masvs-checklist",
      source: { kind: "local", path: "prompts/eval-checklist-plugin" },
    },
  },
  owasp: {
    description:
      "Claude Code + OWASP Secure Agent Playbook's code-security-skills plugin v0.2.11 (CC BY 4.0), as published.",
    flags: [],
    plugin: {
      name: "code-security-skills",
      source: {
        kind: "git",
        url: "https://github.com/OWASP/secure-agent-playbook",
        tag: "v0.2.11",
        commit: "65d4efd2cd0b081d52101e9708792b944e4ddebb",
        subdir: "plugins/code-security-skills",
      },
    },
  },
};
