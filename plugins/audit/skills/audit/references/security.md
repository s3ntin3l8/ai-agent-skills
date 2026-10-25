# Security audit: method

Evidence: reproducible commands and their output, kept local. Never commit secrets
or live data into a report.

- **Threat model first**: assets, trust boundaries, who can reach what. Say what is
  out of scope.
- **Authn/authz**: every route and RPC, who may call it, and whether the check is
  server-side. Look for IDOR and missing ownership checks.
- **Input handling**: injection (SQL, command, path, template), SSRF, deserialization,
  unsafe HTML/markdown rendering, file upload.
- **Secrets and config**: hardcoded or logged credentials, default tokens, CORS
  (credentials with wildcard/reflected origins), cookie flags, CSP.
- **Dependencies**: known-vulnerable packages (`npm audit`, `pip-audit`, etc.) and
  how updates arrive.
- **Verify before reporting**: a finding needs a path from attacker input to impact,
  checked in the source. Mark what you could not confirm as unconfirmed.
- **Severity (define it in the report)**: tie it to impact and reachability, not to
  the scanner's label.
- **Guardrails** to propose: a regression test per finding, a CI scanner step, a
  lint/AST rule for the anti-pattern.
