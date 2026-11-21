# 6. Distribution and hosting

Date: 2026-11-21
Status: Accepted

## What is this
How Ward gets onto a user's machine, how Claude Code talks to it, where
the website lives, and where scheduled jobs run.

Background terms:
- An MCP **transport** is the channel between the AI app and the MCP
  server. **stdio** means the app starts the server as a child process
  and they talk over its input and output: local, no network.
- A Claude Code **marketplace** is a git repo that lists plugins users can
  install.

## Context
- ADR 0001: local plugin, no hosted backend, static website, $0 to run.
- The package contains code (MIT) and source data (CC BY-SA 4.0, ADR
  0003), and it bundles an embedding model plus the ONNX runtime (ADR
  0004).
- MASVS/MASTG release about 1–2 times a year (council estimate).

## Options

### Plugin packaging
- **A plugin in `plugin/`, listed by `.claude-plugin/marketplace.json` at
  the repo root.** Cost: $0.
  - Users add the repo as a marketplace via git, then install the plugin.
    The marketplace entry points to `./plugin` by relative path. Relative
    paths only work when the marketplace is added via git, not via a
    direct URL to marketplace.json.
  - The plugin's `.mcp.json` starts the MCP server. Its paths use
    `${CLAUDE_PLUGIN_ROOT}`.
- **An MCP server only, configured by hand:** works, but loses the skill
  that drives the run and the report format.

### How the plugin starts the server
- **`npx` with an exact pinned version of Ward's npm package.**
  - Pro: built files, the model and the ONNX runtime binaries stay out of
    git, and npm picks the right binaries for each platform.
  - Con: needs npm access on the first run, then it's cached.
- **Server bundled inside `plugin/`.**
  - Pro: no download when it starts.
  - Con: a git-installed plugin means committing built JS, the 34 MB model
    and platform-specific runtime binaries to the repo.

### MCP transport
- **stdio:** local, offline, no auth.
- **Streamable HTTP (remote):** deferred by ADR 0001.

### npm publishing
- A scoped package (name decided in plan 5), so Cursor and other MCP
  clients can also run it with `npx`.
- Published from GitHub Actions with npm trusted publishing (OIDC). No
  long-lived token, and provenance is attached automatically. The workflow
  needs npm 11.5.1+ and Node 22.14+.

### Static website
- **Cloudflare static assets (Workers or Pages).** Cost: $0. Requests for
  static files aren't billed.
  - Pro: custom response headers, so the site can send security headers
    (CSP and others). That matters for a security project.
  - Con: needs a Cloudflare account.
- **GitHub Pages.** Cost: $0, with a soft limit of 100 GB a month.
  - Pro: same repo, no new account.
  - Con: it can't set response headers, so CSP is possible only via a
    `<meta>` tag and other security headers not at all.
- **Vercel Hobby.** Cost: $0.
  - Con: non-commercial terms, and the council reports it pauses the whole
    project when a usage limit is hit.

### Scheduled source-update job
- **GitHub Actions on a weekly schedule.** Cost: $0 for public repos.
  - It checks for new MASVS/MASTG tags, rebuilds the index on the runner
    (local embeddings are free), runs the retrieval eval and opens a PR
    with the score change.
  - Gotcha: GitHub disables scheduled workflows in public repos after 60
    days without repository activity. They must be re-enabled or kept
    alive.

## Decision
- The plugin lives in `plugin/`, listed by `.claude-plugin/marketplace.json`,
  and talks to the MCP server over stdio.
- The plugin starts the server with `npx` and an exact pinned version.
  Plan 5 confirms this against the current plugin docs.
- npm package published with trusted publishing.
- Website on Cloudflare static assets, with security headers.
- Weekly source check in GitHub Actions.
- **The source-update PR is never auto-merged.** Upstream text reaches
  users' agents word for word, so Karlo reviews the diff before merging.

## Consequences
- No server runs anywhere, so running costs are $0 and there's nothing to
  abuse.
- New sources reach users only through a new release. The MCP server
  reports its corpus version and date, and the skill warns when it's old.
- The npm package carries both licences (`MIT AND CC-BY-SA-4.0`) and
  includes the NOTICE (ADR 0003).
- Needs a Cloudflare account and DNS for ward.rukavina.app at plan 9 (a
  "me" step). Where rukavina.app's DNS lives today decides the effort.
- Assumes this repo is public. Revisit if it isn't.

## Sources (checked 2026-11-21)
- Plugin manifest and `${CLAUDE_PLUGIN_ROOT}`: https://code.claude.com/docs/en/plugins-reference
- Marketplace relative paths: https://code.claude.com/docs/en/plugins/marketplace-reference
- npm trusted publishing: https://docs.npmjs.com/trusted-publishers
- GitHub scheduled workflow inactivity: https://docs.github.com/en/actions/reference/usage-limits-billing-and-administration
- Static hosting comparisons (third-party, verify at plan 9): https://flaviocopes.com/cloudflare-pages-vs-workers/,
  https://freetier.co/compare/cloudflare-pages-vs-github-pages
