# Performance audit: method

Evidence: commands, environment and numbers, kept local. A claim without a
measurement is not a finding.

- **State the budget** (latency, bundle size, memory, startup) before measuring.
- **Measure, then read the code**: profile or trace the real hot path. Record
  hardware, data size, build mode and the exact command, so the run is repeatable.
- **Typical areas**: N+1 queries and missing indexes, unbounded lists and payloads,
  main-thread work and re-render storms, bundle weight and code splitting,
  polling vs push, memory growth (retained listeners, caches without bounds).
- **Before/after**: every fix records the measured delta in the "what changed"
  column.
- **Severity (define it in the report)**: tie it to a budget breach and how often
  users hit it.
- **Guardrails** to propose: a benchmark or size-limit check in CI, a query-count
  assertion in tests.
