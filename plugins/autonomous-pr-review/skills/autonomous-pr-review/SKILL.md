---
name: autonomous-pr-review
description: >-
  Generic, repo-agnostic PR review methodology — use this whenever reviewing a pull
  request in any repo, whether that's an autonomous @claude-mention review running
  unattended in GitHub Actions, or a manual /review or /code-review of a diff. Covers
  four things a generic bug-hunting pass tends to skip: (1) verification discipline —
  actually run the repo's own lint/typecheck/test commands rather than eyeballing the
  diff, (2) treating the repo's own CLAUDE.md/CONTRIBUTING/AGENTS.md as the review
  checklist for domain invariants, not just background reading, (3) a PR-description
  metadata hygiene check most reviewers skip because they're focused on the diff, (4)
  restraint — recognizing when a diff follows the repo's own documented anti-patterns
  correctly rather than nitpicking against them. Also covers posting discipline: every
  file:line finding must be an inline anchored comment, never prose citing "file:42" in
  the summary body, and the verdict must be mechanically derived from the findings, not
  decided separately. Consult this before writing review findings, not after. Pairs
  well with a repo-specific companion skill that encodes that repo's own domain
  invariants as concrete red flags (this skill deliberately carries none — that part
  is repo-specific and belongs in that repo's own `.claude/skills/`).
---

# Reviewing a PR

This skill supplements whatever prompt invoked the review (a CI mention-trigger, a
slash command, a direct ask) — it doesn't replace it. That prompt tells you the
mechanics of *how* to post; this tells you *what to actually look for*, and a couple of
habits that keep being skipped under time pressure, regardless of which repo you're in.

## 1. Verify, don't just read

A diff can look correct and still be wrong — a renamed field that broke a caller three
files away, a test that was weakened rather than fixed, a type error hiding behind a
stale build cache. If the tools are available in this run, actually run them before
finalizing findings, rather than reasoning about correctness from the diff alone:

- Discover the repo's own verification commands (`package.json` scripts, a `Makefile`,
  the CI config) and run them — lint, typecheck, and the test suite, scoped to the
  changed package/workspace where the repo supports that.
- If the diff changes a schema/migration-adjacent file, check whether this repo's own
  migration tooling expects a paired migration file to be committed alongside it (the
  convention varies by repo — Drizzle, Prisma, Alembic, Rails migrations, etc. — so look
  for how existing schema changes in this repo's history were structured, don't assume).
- If the diff touches a file with an obvious companion test file, check whether that
  companion was updated too, and whether it would still pass.

A finding backed by "I ran the test suite and it fails at X" is worth far more than
"this looks like it might break something." Prefer the former whenever you can produce
it.

## 2. Treat the repo's own contributor guide as the review checklist

If this repo has a CLAUDE.md, CONTRIBUTING.md, AGENTS.md, or similar, its documented
invariants (a "single source of truth" rule, a data-consistency boundary, a security/
scoping convention, an architectural decision with a stated reason) are exactly where
this repo's own silent-bug patterns are already known and named — but they're prose,
easy to have skimmed once and forgotten under review-turnaround pressure. Re-read the
relevant sections *while* looking at the diff, not just once at the start of the
session, and check the diff against each invariant that's actually implicated by the
files changed. If this repo also has its own companion review skill that restates these
invariants as concrete code-shape red flags, consult that too — it exists precisely to
make this step faster and less likely to be skipped.

## 3. PR-description hygiene

Read the PR's title and description themselves (e.g. `gh pr view <number>`), not just
the diff, and check them against whatever hygiene conventions this repo documents for
PR descriptions and commit messages — common ones are: no secrets or credentials, no
customer/personal-data specifics, no internal-only references that shouldn't be public
if the repo is public. This is a property of the PR *metadata*, not the code, so it's
easy to skip entirely when a review focuses on the diff. Don't assume a diff-focused
pass already covered it — check explicitly.

## 4. Restraint: recognize the repo's own anti-patterns

Many repos' contributor guides explicitly discourage certain patterns: defensive
error-handling for cases that can't happen, abstractions built for a single call site,
comments that restate *what* code does rather than explaining a non-obvious *why*, or
speculative flexibility for a feature that doesn't exist yet. When a diff is lean in
exactly the way its own repo asks contributors to be — three similar lines instead of a
premature helper, no defensive `if` for an impossible null — that's the PR following
house style correctly, not something to push back on. Reserve "Suggestions" for changes
that would fix a real bug, gap, or maintainability problem, not for reintroducing the
guards/abstractions/comments a repo's own conventions deliberately avoid. If you're not
sure whether a pattern is a deliberate house style or an oversight, the repo's
contributor guide (see §2) is usually explicit about it.

## 5. Posting: inline-anchor every file:line finding, derive the verdict mechanically

If your findings feed into a structured review body (Critical / Warnings / Suggestions
/ Looks Good sections, `gh api .../reviews`, or equivalent), any Critical or Warning
finding that names a specific file and line **must** be posted as a line-anchored
inline comment, not as prose citing `file.ts:42` inside the summary body. Reserve the
summary body for the verdict and genuinely cross-cutting feedback that doesn't anchor
to one line. Before submitting, check your own draft: a Critical or Warning bullet with
a file:line reference sitting only in the summary — with no matching inline comment —
means move it, not ship it as-is. Inline comments show up on the diff view and support
one-click `suggestion` blocks; prose citations don't.

The formal verdict (`REQUEST_CHANGES` / `COMMENT` / an approve-equivalent) should be
derived mechanically from what you just wrote, not decided separately: request changes
iff the Critical section has at least one real finding, a plain comment otherwise.
Don't approve unless the calling context explicitly asks you to and it's safe to do so
— that's not this skill's call to make by default. Keep the verdict and the Critical
section in sync; a `REQUEST_CHANGES` next to an empty Critical section (or vice versa)
means one of the two is wrong.
