// Builds the installable plugin (step 07 of plan 5): bundles Ward's MCP
// server into plugin/server/index.mjs, copies the pinned index into
// plugin/data/, lists bundled third-party packages and their licences,
// and syncs the skill. A marketplace install copies plugin/ only, so
// everything the server needs at run time must be inside it.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import process from "node:process";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = path.join(repo, "plugin");
const serverDir = path.join(plugin, "server");
const dataDir = path.join(plugin, "data");

/** Licences a bundled package may have (CLAUDE.md: permissive only). */
const PERMISSIVE = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
]);

mkdirSync(serverDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });

const result = await build({
  absWorkingDir: repo,
  entryPoints: [path.join(repo, "packages/mcp/src/index.ts")],
  outfile: path.join(serverDir, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node26",
  // Some bundled CommonJS code calls require() for Node built-ins.
  banner: {
    js: 'import { createRequire as __wardRequire } from "node:module"; const require = __wardRequire(import.meta.url);',
  },
  legalComments: "none",
  metafile: true,
  logLevel: "warning",
});

// Every package esbuild pulled from node_modules, with its licence.
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input);
  if (!match) continue;
  const name = match[1];
  if (packages.has(name)) continue;
  const dir = input.slice(0, match.index + match[0].length);
  const pkg = JSON.parse(
    readFileSync(path.join(repo, dir, "package.json"), "utf8"),
  );
  const licenceFile = readdirSync(path.join(repo, dir)).find((f) =>
    /^(licen[cs]e|copying)/i.test(f),
  );
  packages.set(name, {
    version: pkg.version,
    license: pkg.license,
    author: typeof pkg.author === "string" ? pkg.author : pkg.author?.name,
    text: licenceFile
      ? readFileSync(path.join(repo, dir, licenceFile), "utf8").trim()
      : undefined,
  });
}

// Packages vendored inside a bundled package's own dist (the MCP SDK
// ships ajv and others pre-bundled). Its build left `#region
// .../node_modules/.pnpm/<name>@<version>.../node_modules/<name>/` markers;
// their licence texts were fetched once from npm into
// scripts/vendored-licences.json. A new vendored version fails the build
// until it is added there.
const vendoredLicences = JSON.parse(
  readFileSync(path.join(repo, "scripts/vendored-licences.json"), "utf8"),
);
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes("node_modules/")) continue;
  const source = readFileSync(path.join(repo, input), "utf8");
  for (const m of source.matchAll(
    /node_modules\/\.pnpm\/[^/\s]+\/node_modules\/((?:@[^/\s]+\/)?[^/\s]+)\//g,
  )) {
    const name = m[1];
    const version = new RegExp(
      `\\.pnpm/${name.replace("/", "\\+")}@([^/_\\s]+)`,
    ).exec(m[0])?.[1];
    const key = `${name}@${String(version)}`;
    if (packages.has(name)) continue;
    const known = vendoredLicences[key];
    if (!known) {
      throw new Error(
        `${input} vendors ${key}: add it to scripts/vendored-licences.json`,
      );
    }
    packages.set(name, { version, license: known.license, text: known.text });
  }
}

const bad = [...packages].filter(([, p]) => !PERMISSIVE.has(p.license));
if (bad.length > 0) {
  throw new Error(
    `Non-permissive or unknown licence: ${bad.map(([n, p]) => `${n} (${String(p.license)})`).join(", ")}`,
  );
}
const rows = [...packages]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, p]) => `| ${name} | ${p.version} | ${p.license} |`);
writeFileSync(
  path.join(serverDir, "THIRD_PARTY.md"),
  [
    "# Third-party code in index.mjs",
    "",
    "Written by scripts/build-plugin.mjs from the packages esbuild bundled.",
    "",
    "| Package | Version | Licence |",
    "| --- | --- | --- |",
    ...rows,
    "",
    ...[...packages]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([name, p]) => [
        `## ${name} ${p.version}`,
        "",
        p.text ??
          `${p.license}, per its package.json (the package ships no licence file). Author: ${String(p.author)}.`,
        "",
      ]),
  ].join("\n"),
);

// The OWASP-derived index (CC BY-SA 4.0) with its licence and notice.
for (const file of ["index.json", "LICENSE", "NOTICE"]) {
  copyFileSync(
    path.join(repo, "packages/core/data", file),
    path.join(dataDir, file),
  );
}
copyFileSync(path.join(repo, "LICENSE"), path.join(plugin, "LICENSE"));

execFileSync("npm", ["run", "-s", "prompts:sync"], {
  cwd: repo,
  stdio: "inherit",
});

process.stderr.write(
  `plugin/server/index.mjs built; ${String(packages.size)} bundled packages\n`,
);
