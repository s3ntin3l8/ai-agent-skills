# Code-health audit: method

Evidence: commands and their output (dependency graphs, coverage, lint results),
kept local.

- **Structure**: module boundaries, circular imports, layering violations, files or
  functions that have outgrown one responsibility.
- **Dead and duplicated code**: unused exports, unreachable branches, copy-pasted
  logic that has already diverged.
- **Tests**: untested critical paths, tests that assert nothing, flaky or
  order-dependent tests, mocks that hide real behavior.
- **Error handling**: swallowed errors, catch-all fallbacks that mask failures.
- **Dependencies and tooling**: stale or unmaintained packages, version skew,
  missing lint/type checks.
- **Check the repo's own invariants** (AGENTS.md / CONTRIBUTING) as the checklist,
  and do not report what the repo deliberately does.
- **Severity (define it in the report)**: tie it to blast radius and how likely the
  next change is to break it.
- **Guardrails** to propose: a lint rule, an import-boundary check, a coverage floor
  on the touched paths.
