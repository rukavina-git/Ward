/**
 * Agent text is untrusted. Before printing it to a terminal, replace control
 * characters (escape sequences could rewrite the screen) and cut it short.
 */
export function clean(text: string, max = 100): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 0x20 || (code >= 0x7f && code <= 0x9f) ? " " : ch;
  }
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}
