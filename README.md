# ai-agent-skills

My personal collection of reusable [Claude Code](https://claude.com/claude-code)
skills, packaged as a plugin marketplace so they can be installed the same way — locally
or in CI — across any repo, instead of copy-pasted and drifting.

## Install

```
/plugin marketplace add https://github.com/s3ntin3l8/ai-agent-skills.git
/plugin install autonomous-pr-review@ai-agent-skills
```

or non-interactively:

```
claude plugin marketplace add https://github.com/s3ntin3l8/ai-agent-skills.git
claude plugin install autonomous-pr-review@ai-agent-skills
```

In a GitHub Actions run using `anthropics/claude-code-action`, pass the same two things
as action inputs instead:

```yaml
with:
  plugin_marketplaces: https://github.com/s3ntin3l8/ai-agent-skills.git
  plugins: autonomous-pr-review@ai-agent-skills
```

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

## License

Copyright (C) 2026 Björn Hansen

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version. See [LICENSE](LICENSE).
