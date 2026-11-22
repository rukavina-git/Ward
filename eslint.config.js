// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/dist/", "**/coverage/", "evals/.cache/"]),
  {
    files: ["**/*.{js,mjs,ts}"],
    extends: [js.configs.recommended],
  },
  {
    // Type-aware rules (floating promises, unsafe any) on TypeScript only.
    files: ["**/*.ts"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // stdio MCP server: stdout carries JSON-RPC, so log to stderr only.
    files: ["packages/mcp/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-console": ["error", { allow: ["error", "warn"] }],
    },
  },
);
