import { describe, expect, it } from "vitest";
import { hello } from "./index.js";

describe("hello", () => {
  it("greets by name", () => {
    expect(hello("Karlo")).toBe("Hello, Karlo. Ward is not built yet.");
  });
});
