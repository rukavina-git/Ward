/** One arm of the eval. Step 04 adds rows here, not code. */
export interface Setup {
  description: string;
  /** Flags added to the common ones in run.ts. */
  flags: string[];
}

export const setups: Record<string, Setup> = {
  alone: {
    description:
      "Claude Code alone: no CLAUDE.md, skills, plugins, MCP servers, hooks or auto memory.",
    flags: [
      "--safe-mode",
      "--strict-mcp-config",
      "--settings",
      JSON.stringify({ autoMemoryEnabled: false }),
    ],
  },
};
