---
name: audit
description: >-
  Use when asked to audit a repo (UI/UX, accessibility, security, performance, code
  health) or to write, update or migrate an audit report. Gives the one report
  structure, naming and evidence rules every repo shares, plus a generic screenshot
  capture script for visual audits.
---
# Audit

**The report is committed; the evidence stays local.** A report is the durable record
of what was found, why it mattered, what changed and what was deferred. Captures and
raw output are regenerable, so they are gitignored and never linked.

## Layout (create it on the first audit; repos never audited get nothing)

```
docs/audit/
  README.md                     repo-specific: index, scope tokens, capture command
  capture.json                  visual audits only; see scripts/capture.mjs
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

## Visual capture

`node <this skill>/scripts/capture.mjs <slug>` reads `docs/audit/capture.json`, starts
the repo's demo, captures every route at phone and tablet, and writes only into
`docs/audit/assets/<slug>/`. The config shape and options are in the script's header.
A repo with no isolated demo instance needs one before a visual audit; code audits
do not. The demo contract is in `references/demo.md`.
