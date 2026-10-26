# <Topic> audit — <scope>

**Scope.** What was audited, and what was explicitly out of scope.

**Status.** What was fixed and where it lives (branch / PR). Everything below the
fixed severities is tracked in the [Deferred backlog](#deferred-backlog).

---

## How the audit was run

| Layer | Method |
|---|---|
| | |

### What the code already does well

Checked and left alone. A fix here would be a regression.

---

## Severity model

- **P0**: <what it means in this repo>
- **P1**: <...>
- **P2 / P3**: <...>

---

## Findings

| # | Finding | Evidence | Where | What changed |
|---|---|---|---|---|

---

## Guardrails

The permanent checks that keep these findings fixed (test, lint rule, CI step).

---

## Evidence

How to regenerate it. A command, never a link to a file:

```bash
make screenshots-audit AUDIT=YYYY-MM-<scope>-<topic>   # visual-kit version: <tag in visual/Dockerfile>
```

---

## Deferred backlog

| Finding | Severity | Issue |
|---|---|---|
