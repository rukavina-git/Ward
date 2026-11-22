import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listFiles } from "./walk.js";

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("listFiles", () => {
  it("lists regular files sorted and skips symlinks to files and folders", () => {
    const outside = mkdtempSync(join(tmpdir(), "ward-outside-"));
    const root = mkdtempSync(join(tmpdir(), "ward-walk-"));
    temps.push(outside, root);
    writeFileSync(join(outside, "secret.md"), "not yours");
    mkdirSync(join(root, "b"));
    writeFileSync(join(root, "b", "two.md"), "2");
    writeFileSync(join(root, "a.md"), "1");
    symlinkSync(join(outside, "secret.md"), join(root, "link.md"));
    symlinkSync(outside, join(root, "linked-dir"));

    expect(listFiles(root)).toEqual(["a.md", "b/two.md"]);
  });
});
