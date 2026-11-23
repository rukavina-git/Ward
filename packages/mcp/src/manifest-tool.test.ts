import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MASTG } from "@ward/analyzers";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterAll, describe, expect, it } from "vitest";
import { knowledgeBase } from "./knowledge.js";
import { APP_NOTICE, manifestInput, manifestTool } from "./manifest-tool.js";

type Json = Record<string, unknown>;
const data = (r: CallToolResult): Json => {
  const text = r.content[0]?.type === "text" ? r.content[0].text : "";
  const out = r.structuredContent as Json;
  expect(JSON.parse(text)).toEqual(out);
  expect(out.notice).toBe(APP_NOTICE);
  return out;
};

// The fixture without build/ (gitignored, absent in CI).
const fixture = fileURLToPath(
  new URL("../../../fixtures/example-app", import.meta.url),
);
const root = mkdtempSync(path.join(tmpdir(), "ward-tool-"));
cpSync(fixture, root, {
  recursive: true,
  filter: (s) => !/[/\\]build([/\\]|$)/.test(s),
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("manifest tool", () => {
  it("returns verdicts with the MASTG pin and only exported components", async () => {
    const out = data(await manifestTool.handler({ projectRoot: root }));
    expect(out).toMatchObject({
      analyzer: "manifest",
      variant: "release",
      mode: "source",
      mastgPin: { version: "v2.0.0" },
    });
    const facts = out.facts as {
      components: { exported: string }[];
      notExportedCount: number;
    };
    expect(facts.components.every((c) => c.exported !== "no")).toBe(true);
    expect(facts.notExportedCount).toBe(1);
    const verdicts = out.verdicts as { check: string; verdict: string }[];
    expect(verdicts.find((v) => v.check === "backup")?.verdict).toBe("FAIL");
  });

  it("maps every check to active Android MASTG tests in the pinned index", () => {
    const kb = knowledgeBase();
    for (const ids of Object.values(MASTG)) {
      for (const id of ids) {
        const r = kb.get(id)?.record;
        expect(r, id).toBeDefined();
        expect(r?.status, id).toBe("active");
        expect(r?.fields.platform, id).toBe("android");
      }
    }
  });

  it("rejects relative paths and odd variants in the schema", () => {
    expect(manifestInput.safeParse({ projectRoot: "fixtures/x" }).success).toBe(
      false,
    );
    expect(
      manifestInput.safeParse({ projectRoot: "/x".repeat(600) }).success,
    ).toBe(false);
    expect(
      manifestInput.safeParse({ projectRoot: root, variant: "../../etc" })
        .success,
    ).toBe(false);
  });

  it("a missing folder is a tool error, not a crash", async () => {
    const r = await manifestTool.handler({
      projectRoot: path.join(root, "nope"),
    });
    expect(r.isError).toBe(true);
    expect(data(r).error).toMatch(/does not exist/);
  });
});
