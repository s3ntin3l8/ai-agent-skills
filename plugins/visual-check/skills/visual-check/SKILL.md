---
name: visual-check
description: >-
  Use for any change that alters what a page looks like (UI, CSS, a component, an API shape the UI renders,
  the demo's seed data) in a repo with a `visual/` folder or a `make visual-check` target: render the touched
  routes before and after, read the report, and write the PR's "Visual check" section. Also use to add the
  visual check to a repo that lacks it, and to regenerate README or landing-page screenshots.
---
# Visual check

Tests prove behaviour; they do not show that a screen still looks right. The visual check renders the routes
you touched **on the merge base and on your working tree**, in one pinned image against the repo's own isolated
demo, and diffs them. You read the result before you call the change done.

The tool is [visual-kit](https://github.com/s3ntin3l8/visual-kit) (Docker image `ghcr.io/s3ntin3l8/visual-kit`,
pinned in the repo's `visual/Dockerfile`). Its `CONTRACT.md` is the spec; this skill is the habit.

## When

- **Run it** after any change that can alter a rendered page: components, CSS and tokens, copy, a route, an API
  response the UI renders, the demo's seed data.
- **Skip it** for changes that cannot reach a screen (backend internals with no response change, tests, docs,
  CI), and say so in one line in the PR.

## Run

```bash
make visual-check ROUTES=/triage,/cases     # scene names or paths; a path matches everything below it
make visual-check BASE=origin/release       # compare against another base
```

Needs Docker. The first run boots two demos (the merge base in a temporary worktree, then your tree) and takes a
few minutes; the base is cached by merge-base, so the next run on the same base is faster. Leave `ROUTES` out only
when you changed something global (a token, the shell). Pick the routes you touched **plus** the pages that share
the component you changed.

Output: `visual/.out/check/report/` with `index.html` (base | head | diff side by side), `summary.md` and
`summary.json`; the raw shots are in `…/check/base` and `…/check/head`. The same check runs on UI pull requests in
CI (advisory) and comments the summary.

## Read it

1. **Look at the images yourself.** Open the changed and the new shots (the image viewer or the Read tool on the
   PNGs): desktop and phone, both themes. A pixel diff finds that something changed, not whether it looks right.
2. **Classify every difference:** *intended* (it is the change), *regression* (fix it), or *flake* (two runs on an
   unchanged tree differ: fix the demo's determinism, a fixed clock or a mask; never raise the threshold).
3. **Read the deltas** under each shot, which a screenshot cannot show: axe violations (rule, impact, nodes),
   console errors, an HTTP error status, horizontal overflow, controls cut off at the viewport edge, controls
   without an accessible name. New findings are yours to fix or to file; only increases against the base are
   reported.
4. **A new route or state** has no base: it shows as *new* and its findings are the whole story. Add a scene for it
   to `visual/scenes.json` (tags `check`, `audit`, and `presentation` if it belongs in the README).
5. **Warnings that mean the comparison is empty:** "every shot is new: the base rendered nothing" (the base demo is
   broken or no scene matched), or scenes that failed on the base (they show as *new*, which is expected for UI the
   base does not have yet). A scene that fails on your tree fails the run: fix the scene or the page.

## The PR section

Every UI pull request gets this, written after you looked:

```markdown
## Visual check
`make visual-check ROUTES=/triage` against origin/main: 6 shots compared, 2 changed, 0 new, 0 removed, 4 identical.
- `triage` desktop/phone: the case cell now shows the title under the id (intended).
- `triage-filter`: the Proceeding menu lists the AZ first (intended).
- axe: no new findings. Console, overflow, unnamed controls: unchanged.
```

If the check found a problem you did not fix, say so and link the issue.

## Presentation (README, landing page)

The same image renders the committed screenshots, so they never go stale by hand:

```bash
make screenshots                  # README set -> docs/screenshots (FORCE=1 the first time over hand-made files)
make screenshots-landing OUT=dir  # the landing-page set (dark; 1600x1000 @2x and 390x844 @3x; loops)
```

Regenerate them when a screen they show changes, and commit the result with the change.
personal-landing pulls the landing set itself (`npm run assets:sync <app>`).

## A repo without it

Do not improvise a capture script. Follow visual-kit's `CONTRACT.md`
(https://github.com/s3ntin3l8/visual-kit/blob/main/CONTRACT.md): a demo that prints `DEMO_READY` and takes
`DEMO_NOW` (the demo contract is also in the `audit` skill's `references/demo.md`), `visual/Dockerfile` (one
`FROM ghcr.io/s3ntin3l8/visual-kit:<version>` line), `visual/scenes.json`, four make targets, the `.gitignore`
entries, and a rule in the repo's agent file that UI changes run `make visual-check`. For CI, a caller workflow
(`.github/workflows/visual.yml`) uses `s3ntin3l8/.github/.github/workflows/visual-check.yml@main` with
`permissions: contents: read, pull-requests: write` and the repo's `python-version` / `node-version`, plus a
`.github/visual-setup.sh` that installs what the demo needs. Copy a repo that already has it: `sanctuary` is the
reference (its `Makefile`, `visual/` and `.github/workflows/visual.yml`).

## Failure modes

- **Docker or the image pull fails:** the pinned tag must exist (`docker pull` it); never fall back to a host
  Chromium, the pixels would differ from everyone else's.
- **"… was not written by visual-kit":** an output folder holds files the tool did not write, and it refuses to
  use or replace it silently: look, then rerun with `FORCE=1`.
- **Two runs on an unchanged tree differ:** that is a bug in the demo or the scene, not in the check. Find the
  volatile part (a relative date, an avatar, an animation, a late-loading font) and fix or mask it.
