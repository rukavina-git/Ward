import { describe, expect, it } from "vitest";
import { helloInput, helloTool } from "./hello-tool.js";

describe("hello tool", () => {
  it("returns the core greeting as one text block", () => {
    expect(helloTool.handler({ name: "Karlo" })).toEqual({
      content: [{ type: "text", text: "Hello, Karlo. Ward is not built yet." }],
    });
  });

  it("rejects a missing or empty name", () => {
    expect(helloInput.safeParse({}).success).toBe(false);
    expect(helloInput.safeParse({ name: "" }).success).toBe(false);
  });
});
