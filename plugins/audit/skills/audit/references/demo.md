# The demo instance contract

A visual audit captures from an **isolated demo instance**, never a live one. Four repos
(mullion, runway, branchdam, pocket-portfolio) already build one the same way. This file
writes down what they share so a new repo can follow it. It standardises the *contract*,
not the code: the servers, the seeding and the auth bypass differ too much to share.

## The contract

1. **One command** starts it and stays in the foreground: `make demo`.
2. **Scratch everything.** One temp directory holds the data, `HOME` and `TMPDIR`. The
   environment is built from an allowlist (`PATH`, `LANG`, `LC_ALL`, `TERM`, `TZ`), not
   inherited. It is deleted on exit.
3. **Refuse to start** rather than touch real state: any secret-looking variable, a
   path variable pointing outside the scratch directory, a `.env` or config file in the
   working directory, the real instance's port, a non-loopback bind, or a port already
   in use. Put the checks in one `env` module with a unit test.
4. **Loopback only.** Bind `127.0.0.1`. A fixed high port per repo is fine; it must be
   overridable.
5. **Seeded, fictional data** (`example.com`, `.invalid`, RFC 5737 addresses). Shapes are
   deterministic (a fixed RNG seed); dates relative to now are fine. Seed before the ready
   line, through the app's own code paths where they exist.
6. **No manual login.** Bypass by construction (loopback with no admin key, forward-auth
   headers, a minted session), never with a real credential.
7. **A ready line on stdout**, printed only after the instance is seeded and serving, so
   a caller can wait for it instead of polling a URL that answers early. The existing repos
   print a prose line (`[demo] Runway demo is up: <url>`); `capture.json`'s `readyOutput`
   matches whatever the repo prints. New repos should print `DEMO_READY url=<url>`.
8. **Clean teardown on SIGINT and SIGTERM**: signal the whole process group, TERM then
   KILL after a grace period, remove the scratch directory. Handle SIGTERM explicitly;
   the capture script stops the demo with it.
9. **A route list** in `docs/audit/capture.json`, and the viewports and themes in it.

## What stays per repo

Building and launching the server, the seeding, the auth mechanism, how a page is judged
"settled" (a skeleton class, a chart count, a fixed wait), the theme storage key, and the
env denylist patterns.

## Pitfalls seen in the wild

- A server answers before it is seeded. Wait for the ready line, not a URL. (Mullion's
  first capture showed a "server unreachable" banner this way.)
- A single-page app with no routes shows only its landing state. Capture needs steps.
- `networkidle` never settles on a page with an open SSE or WebSocket stream.
- A default that points at the real dev database or data directory. Always set it
  explicitly in the demo, and make the guard refuse the default.
- A server that hard-codes `0.0.0.0` cannot be made loopback-only from outside.
