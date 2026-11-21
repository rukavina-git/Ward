import { hello } from "@ward/core";
import type { CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

/**
 * The `hello` tool: a placeholder that proves the MCP wiring works end to
 * end. The model picks a tool by reading its name, description and input
 * schema, so those are written for the model, not for us.
 */
export const helloInput = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .describe("The name of the person to greet, e.g. 'Karlo'."),
});

export type HelloInput = z.infer<typeof helloInput>;

export const helloTool = {
  name: "hello",
  config: {
    title: "Say hello from Ward",
    description:
      "Greets a person by name and reports whether Ward, the Android pre-publish checker, is built yet. Use it when the user asks Ward to say hello or asks whether Ward is working.",
    inputSchema: helloInput,
  },
  handler: ({ name }: HelloInput): CallToolResult => ({
    content: [{ type: "text", text: hello(name) }],
  }),
};
