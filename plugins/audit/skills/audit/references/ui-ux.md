# UI/UX audit: method

Evidence: captures in `assets/<slug>/` plus findings checked against the source.

- **Read the code against WCAG 2.2 AA**, not just the running app: names and roles
  on every control, dialog semantics and focus handling, focus order and visible
  focus, keyboard reachability, contrast computed from the real token values (both
  themes), target size, `prefers-reduced-motion`.
- **Capture** every page on desktop, tablet and phone (`make screenshots-audit`), in each theme
  the product ships, and read `metrics.json` next to the images. Look for overflow, clipped or
  colliding content, safe-area insets, unreadable density.
- **Interaction states**: loading, empty, error, disabled, long content, destructive
  actions confirmed, double submit guarded, failures surfaced instead of swallowed.
- **Information architecture**: can a first-time user reach each task; do labels
  match the product's own vocabulary; is state in the URL where a link should
  reproduce the view.
- **Severity (define it in the report)**: typically P0 = a supported configuration
  renders the surface broken; P1 = serious defect with no workaround for the
  affected user; P2/P3 = polish.
- **Guardrails** to propose: the per-change visual check in CI (`visual-check.yml`; it reports axe and
  cut-off controls on every UI PR), a contrast test over the tokens, a lint rule for unlabeled controls, a
  test per fixed defect.
