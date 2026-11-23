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
  /** An MCP server this arm adds: the only one, and all its tools allowed. */
  mcp?: McpServer;
  /** Built-in tools added to the common ones (run.ts TOOLS). */
  extraTools?: string[];
  /**
   * The task. Default: the shared eval prompt with the findings schema.
   * `command`: a slash command whose report Ward's code writes in the
   * copy; the runner converts that report to findings.
   */
  task?: { kind: "command"; prompt: string };
}

/** A stdio MCP server built in this repo. */
export interface McpServer {
  /** The server's name in the MCP config: tools are `mcp__<name>__<tool>`. */
  name: string;
  /** The entry file, relative to the repo root. Run with node. */
  entry: string;
  tools: string[];
}

/** The full names Claude Code gives an MCP server's tools. */
export function mcpToolNames(mcp: McpServer): string[] {
  return mcp.tools.map((t) => `mcp__${mcp.name}__${t}`);
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
  ward: {
    description:
      "Claude Code + Ward's MCP server (knowledge tools and analyzers), no skill: the agent finds it through the tools' descriptions.",
    flags: [],
    mcp: {
      name: "ward",
      entry: "packages/mcp/dist/index.js",
      tools: [
        "checklist",
        "get_check",
        "search",
        "manifest",
        "network",
        "build_config",
        "dependencies",
      ],
    },
  },
  "ward-check": {
    description:
      "Claude Code + Ward's plugin (skill /ward:check) and MCP server, plus Write for .ward/ only. Prompt /ward:check; Ward's report is turned into findings in code.",
    flags: [],
    extraTools: ["Write"],
    plugin: { name: "ward", source: { kind: "local", path: "plugin" } },
    mcp: {
      name: "ward",
      entry: "packages/mcp/dist/index.js",
      tools: [
        "checklist",
        "get_check",
        "search",
        "manifest",
        "network",
        "build_config",
        "dependencies",
        "report_skeleton",
        "check_report",
        "write_report",
      ],
    },
    task: { kind: "command", prompt: "/ward:check\n" },
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
