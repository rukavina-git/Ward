import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Regular files under `dir`, as sorted paths relative to it with "/"
 * separators. Symlinks are skipped, files and folders alike: downloaded
 * repos are untrusted, and a link could point at any file on this disk.
 * Sorted, so the output never depends on the order the disk returns.
 */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const visit = (rel: string): void => {
    const entries = readdirSync(join(dir, rel), { withFileTypes: true });
    for (const entry of entries) {
      const path = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) out.push(path);
    }
  };
  visit("");
  return out.sort();
}
