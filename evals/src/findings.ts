import { readFileSync } from "node:fs";
import { z } from "zod";
import { findingsSchemaPath } from "./paths.js";

// The schema file in prompts/ is the single source: Claude Code gets it with
// --json-schema, and the same file validates the output here. These types
// mirror it by hand; findings.test.ts keeps the two in step.

export interface FindingLocation {
  file: string;
  line: number;
  endLine?: number;
}

export interface Finding {
  title: string;
  category: "security" | "privacy" | "play";
  severity: "high" | "medium" | "low";
  verdict: "FAIL" | "NEEDS DYNAMIC" | "MANUAL";
  masvs: string[];
  maswe: string[];
  locations: FindingLocation[];
  explanation: string;
}

export interface Findings {
  findings: Finding[];
  inspected: string[];
}

export type Validation =
  { ok: true; value: Findings } | { ok: false; errors: string[] };

export function readSchemaText(path = findingsSchemaPath): string {
  return readFileSync(path, "utf8");
}

let validator: z.ZodType | undefined;

function getValidator(): z.ZodType {
  validator ??= z.fromJSONSchema(
    JSON.parse(readSchemaText()) as z.core.JSONSchema.JSONSchema,
  );
  return validator;
}

/** Agent output is untrusted: check its shape before anything reads it. */
export function validateFindings(raw: unknown): Validation {
  const parsed = getValidator().safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  const value = parsed.data as Findings;
  // Checks the schema leaves out, so Claude Code's structured output accepts it.
  const errors: string[] = [];
  value.findings.forEach((f, i) => {
    f.locations.forEach((loc, j) => {
      const at = `findings.${String(i)}.locations.${String(j)}`;
      if (loc.line < 1) errors.push(`${at}.line: must be 1 or more`);
      if (loc.endLine !== undefined && loc.endLine < loc.line) {
        errors.push(`${at}.endLine: before line`);
      }
    });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}
