/**
 * Paths inside the checked app. Every path from the agent is relative to
 * the project root and must stay inside it, symlinks resolved.
 */
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

/** The real project root, or an error message. */
export async function resolveRoot(
  projectRoot: string,
): Promise<{ root: string } | { error: string }> {
  try {
    const root = await realpath(projectRoot);
    if (!(await lstat(root)).isDirectory()) throw new Error();
    return { root };
  } catch {
    return { error: "projectRoot is not a readable folder." };
  }
}

/** True when `file` (resolved) is strictly inside `root`. */
export function isInside(root: string, file: string): boolean {
  const rel = path.relative(root, file);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * An existing regular file under `root`, at most `maxBytes`, or an error
 * message. `name` is the input field, for the message.
 */
export async function resolveFile(
  root: string,
  rel: string,
  name: string,
  maxBytes: number,
): Promise<{ file: string } | { error: string }> {
  if (path.isAbsolute(rel) || rel.includes("\0")) {
    return { error: `${name} must be relative to projectRoot.` };
  }
  let file: string;
  try {
    file = await realpath(path.resolve(root, rel));
  } catch {
    return { error: `No file at ${name}.` };
  }
  if (!isInside(root, file)) {
    return { error: `${name} is outside projectRoot.` };
  }
  const info = await lstat(file);
  if (!info.isFile() || info.size > maxBytes) {
    return {
      error: `${name} is not a file under ${String(maxBytes)} bytes.`,
    };
  }
  return { file };
}
