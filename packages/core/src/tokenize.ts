/**
 * Turns text into search tokens for BM25. Written by hand (plan 3
 * invariant): lower case, OWASP IDs kept whole, everything else split on
 * anything that isn't a letter or digit.
 */

export interface TokenizeOptions {
  /** Drop common English words ("the", "of"). Off by default. */
  stopwords?: boolean;
  /** Cut common endings ("keys" → "key"). Off by default. */
  stem?: boolean;
}

/** OWASP MAS IDs: MASVS-STORAGE-1, MASWE-0001, MASTG-TEST-0001, MASTG-DEMO-0001. */
export const idPattern = /\bMAS(?:VS|WE|TG)(?:-[A-Z]+)?-\d+\b/gi;

/** An ID, or a run of letters and digits. IDs win because they come first. */
const tokenPattern = /\bmas(?:vs|we|tg)(?:-[a-z]+)?-\d+\b|[\p{L}\p{N}]+/gu;
const idToken = /^mas(?:vs|we|tg)(?:-[a-z]+)?-\d+$/;

export function isIdToken(token: string): boolean {
  return idToken.test(token);
}

export function tokenize(
  text: string,
  options: TokenizeOptions = {},
): string[] {
  const out: string[] = [];
  for (const match of text.toLowerCase().matchAll(tokenPattern)) {
    let token = match[0];
    if (token.length < 2) continue;
    if (isIdToken(token)) {
      out.push(token);
      continue;
    }
    if (options.stopwords && stopwords.has(token)) continue;
    if (options.stem) token = stem(token);
    out.push(token);
  }
  return out;
}

/**
 * A light suffix stemmer, not Porter: plurals, "-ing", "-ed", "-ly". It
 * only needs to be consistent, since queries and chunks go through the same
 * function.
 */
export function stem(token: string): string {
  if (/\d/.test(token)) return token;
  if (token.length > 4 && token.endsWith("ies"))
    return token.slice(0, -3) + "y";
  if (token.endsWith("sses")) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("ly")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !/(?:ss|us|is)$/.test(token)) {
    return token.slice(0, -1);
  }
  return token;
}

/** Common English words that carry little meaning for search. */
const stopwords = new Set(
  `a about above after again against all am an and any are as at be because
  been before being below between both but by can could did do does doing
  down during each few for from further had has have having he her here hers
  him his how if in into is it its itself just me more most my no nor not now
  of off on once only or other our ours out over own same she should so some
  such than that the their them then there these they this those through to
  too under until up very was we were what when where which while who whom
  why will with would you your yours`.split(/\s+/),
);
