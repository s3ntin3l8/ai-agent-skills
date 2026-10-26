---
name: audit
description: >-
  Use when asked to audit a repo (UI/UX, accessibility, security, performance, code
  health) or to write, update or migrate an audit report. Gives the one report
  structure, naming and evidence rules every repo shares. Visual evidence comes from
  the repo's own `make screenshots-audit` (visual-kit).
---
# Audit

**The report is committed; the evidence stays local.** A report is the durable record
of what was found, why it mattered, what changed and what was deferred. Captures and
raw output are regenerable, so they are gitignored and never linked.

## Layout (create it on the first audit; repos never audited get nothing)

```
docs/audit/
  README.md                     repo-specific: index, scope tokens, capture command
  YYYY-MM-<scope>-<topic>.md    one report per audit (committed)
  assets/<same slug>/           gitignored; captures and raw output
```

Add `docs/audit/assets/` to `.gitignore`, with a one-line comment saying why. Start
`docs/audit/README.md` from `templates/README.md`. It states no rules; it points here.

**Slug** = `YYYY-MM-<scope>-<topic>`. `<scope>` is the audited surface: the UI
directory name (`frontend`, `web`), or the product's surface name when that directory
is framework-generic (`app/`). `<topic>` is `ui-ux`, `security`, `performance`,
`code-health`. A re-audit of the same scope and topic gets the next month.

## Report: the same six parts everywhere

Start from `templates/report.md`.

1. **How the audit was run**: surfaces, method, and what was checked by reading the
   code, not only by running the app. Method varies by topic: read
   `references/<topic>.md` for the one you are doing, and only that one.
2. **Severity model**, written before the findings and defined for this repo, not
   borrowed.
3. **Findings**: a table of finding, evidence, where, and **what changed**. The last
   column records the fix, not only the defect.
4. **Guardrails**: the permanent checks that keep the fixes fixed. A fix that can
   silently regress is not fixed.
5. **Evidence**: how to regenerate it (the command), never a link to a file.
6. **Deferred backlog**: every item as a linked issue.

## Rules

- A report never links a file that is not in the repository. Give the command.
- Re-verify every finding against the source before writing it down. Parallel
  sub-audits are inputs, not verdicts.
- Fix P0/P1 in the same PR as the report. File everything else as an issue first,
  then link it. A deferred finding with no issue is one nobody will pick up.
- Record what was checked and found healthy, so nobody "fixes" it later.
- Capture from an isolated demo instance, never a live one.

## Visual evidence

A repo with a visual surface renders its audit evidence with its own `make screenshots-audit AUDIT=<slug>`
([visual-kit](https://github.com/s3ntin3l8/visual-kit): one pinned image against the repo's isolated demo, every
scene tagged `audit` in `visual/scenes.json`, desktop, tablet and phone, both themes). It writes
`docs/audit/assets/<slug>/`: one PNG per shot and `metrics.json` with axe violations, console errors, horizontal
overflow, controls cut off at the viewport edge and controls without an accessible name. A page that needs a click
to reach (a menu, a dialog) is a scene with `steps`. Record the visual-kit version from the repo's
`visual/Dockerfile` in the report's Evidence section, so the capture can be reproduced after the image moves.

A repo without it needs visual-kit set up first (the `visual-check` skill describes how; the demo contract is in
`references/demo.md`); code audits do not.
