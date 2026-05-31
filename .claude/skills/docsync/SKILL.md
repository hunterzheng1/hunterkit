---
name: docsync
description: Use when synchronizing README.md, AGENTS.md, or CLAUDE.md with repository facts after project structure, command, dependency, CI, test, or agent-instruction changes.
when_to_use: Use for DocSync document initialization, sync, rule maintenance, or docs drift review.
argument-hint: "init | sync [--fast] [README.md|AGENTS.md|CLAUDE.md] | rules [show|<rule>]"
disable-model-invocation: true
user-invocable: true
allowed-tools: Read Grep Glob Edit Write Bash(git status *) Bash(git diff *) Bash(git ls-files *) Bash(npx --yes repomix *) Bash(npx --yes markdownlint-cli2 *)
model: inherit
effort: medium
paths:
  - "README.md"
  - "AGENTS.md"
  - "CLAUDE.md"
  - ".docsync/**"
---

# DocSync

## Goal

Synchronize README.md, AGENTS.md, and CLAUDE.md with minimal factual edits.

## Command Router

- `init`: verify workspace, create missing core docs, refresh context, report.
- `sync`: full sync by default.
- `sync --fast`: use git facts first; upgrade to full sync when facts are insufficient or high-risk.
- `sync <file...>`: only target README.md, AGENTS.md, or CLAUDE.md.
- `rules`: maintain `.docsync/rules/override.md`.
- `rules show`: print current override rules.

## Inputs To Inspect

- `.docsync/state/install.json`
- `.docsync/rules/default.md`
- `.docsync/rules/override.md`
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `package.json`
- `src/cli.mjs`
- `bin/docsync.mjs`
- `.github/workflows/**` if present
- git status and diff facts

## Procedure

1. Validate `.docsync/` with `scripts/validate-workspace.mjs`.
2. Collect repository facts with `scripts/collect-context.mjs` or equivalent manual reads.
3. Compare repository facts with core docs.
4. List drift before editing.
5. Apply minimal patches only to requested target docs.
6. Run markdownlint if available.
7. Return changed files, changed sections, facts used, commands run, TODO(review), and skipped checks.

## Safety

- Do not invent commands, ports, env vars, APIs, modules, credentials, or deployment steps.
- Do not read or output `.env`, tokens, credentials, key files, or secret files.
- Do not run `git commit`, `git push`, `npm publish`, `curl`, or `wget`.
- Mark uncertain facts as `TODO(review): ...`.
- Preserve existing non-DocSync content and marker blocks.
