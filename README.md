# ai-agent-skills

My personal collection of reusable agent skills, packaged as plugins for
[Claude Code](https://claude.com/claude-code), Codex, Antigravity (`agy`), opencode and mcode,
so they can be installed the same way — locally or in CI — across any repo, instead of
copy-pasted and drifting.

## Install

Installation differs by CLI. Each section installs every plugin in this repo; swap in a
single plugin name to install only that one. The plugin formats each CLI reads are listed
in `.claude-plugin/`, `.agents/plugins/` (Codex), and each plugin's `.claude-plugin/`,
`.codex-plugin/` and `.antigravity-plugin/` folders.

### Claude Code

```bash
claude plugin marketplace add s3ntin3l8/ai-agent-skills
claude plugin install audit@ai-agent-skills
claude plugin install autonomous-pr-review@ai-agent-skills
claude plugin marketplace update ai-agent-skills   # to update later
```

In a GitHub Actions run using `anthropics/claude-code-action`, pass the same two things as
action inputs instead:

```yaml
with:
  plugin_marketplaces: https://github.com/s3ntin3l8/ai-agent-skills.git
  plugins: audit@ai-agent-skills
```

### Codex

```bash
codex plugin marketplace add s3ntin3l8/ai-agent-skills
codex plugin add audit@ai-agent-skills
codex plugin add autonomous-pr-review@ai-agent-skills
codex plugin marketplace upgrade                   # to update later
```

### Antigravity (`agy`)

`agy` installs from a directory, so clone the repo first:

```bash
git clone https://github.com/s3ntin3l8/ai-agent-skills.git
agy plugin install ./ai-agent-skills/plugins/audit
agy plugin install ./ai-agent-skills/plugins/autonomous-pr-review
```

Pull and run the same commands again to update (`agy plugin install` copies the plugin, it
does not link it).

### opencode

opencode reads skills from `~/.config/opencode/skills`. Copy the skill folders in (a plain
copy; do not symlink):

```bash
cp -r ai-agent-skills/plugins/*/skills/* ~/.config/opencode/skills/
```

Re-copy to update.

### mcode (MiniMax Code)

mcode discovers plugins that are present in its local marketplace folder,
`~/.minimax/plugins`. Copy the plugin directories there (a plain copy: a symlinked plugin
directory is not found, and `mcode plugin add` is not supported for local plugins):

```bash
cp -r ai-agent-skills/plugins/audit ai-agent-skills/plugins/autonomous-pr-review ~/.minimax/plugins/
mcode plugin list   # audit@local, autonomous-pr-review@local
```

Re-copy to update.

### Keeping several machines in sync

The author's machines install all of the above from an Ansible role rather than by hand, so
the plugins are re-converged persistently.

## Plugins

- **autonomous-pr-review** — generic, repo-agnostic PR review methodology: verification
  discipline, treating a repo's own CLAUDE.md/CONTRIBUTING as the review checklist,
  PR-description hygiene, restraint around a repo's own documented anti-patterns, and
  posting discipline (mandatory inline anchoring, a mechanically-derived verdict).
  Deliberately carries no repo-specific domain knowledge — pair it with a companion
  skill in each repo's own `.claude/skills/` for that repo's domain invariants.

- **audit** — one structure for every audit (UI/UX, security, performance, code health):
  a six-part report committed under `docs/audit/`, evidence kept local and gitignored,
  per-topic method references, and a generic Playwright capture script
  (`scripts/capture.mjs`, driven by a repo's `docs/audit/capture.json`) for visual
  audits. Costs one description line of context until an audit is actually run.

## Contributing: bump the version

Claude Code and Codex update an installed plugin only when its `version` changes, so a
content change without a bump never reaches an existing install. When you change anything
under `plugins/<name>/`, bump `version` in all three of its manifests
(`.claude-plugin`, `.codex-plugin`, `.antigravity-plugin`). CI runs
`node scripts/check-manifests.mjs --base origin/BRANCH` on every pull request (`BRANCH` is the pull request's base branch) and fails when
the manifests disagree, a plugin is missing from a marketplace, or a changed plugin kept its
old version. Run it without `--base` to check consistency only.

## License

Copyright (C) 2026 Björn Hansen

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version. See [LICENSE](LICENSE).
