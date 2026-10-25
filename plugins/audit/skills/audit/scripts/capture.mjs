#!/usr/bin/env node
// Generic visual-audit capture. Run from the repo root:
//
//   node <audit skill>/scripts/capture.mjs <slug> [--config docs/audit/capture.json]
//
// <slug> is the report's slug (YYYY-MM-<scope>-<topic>). PNGs (and optional axe JSON)
// are written to docs/audit/assets/<slug>/ and nowhere else; that folder is gitignored.
//
// docs/audit/capture.json:
//   {
//     "baseUrl": "http://127.0.0.1:3957",   // required; must be loopback (never a live instance)
//     "start": "make demo",                  // optional; started first, stopped at the end
//     "ready": "http://127.0.0.1:3957/",    // optional; polled until it answers (default: baseUrl)
//     "readyOutput": "demo is up",           // optional regex; wait for it in the start command's
//                                            //   output instead of polling. Use it when the server
//                                            //   answers before the demo is seeded.
//     "startTimeoutSec": 120,
//     "routes": ["/", "/{locale}/settings"], // required; "{locale}" is replaced by "locale"
//     "locale": "en",                        // optional; also sets the browser locale
//     "viewports": {                         // optional; these are the defaults
//       "phone":  { "width": 390,  "height": 844 },
//       "tablet": { "width": 820,  "height": 1180 }
//     },
//     "colorSchemes": ["light", "dark"],     // optional; emulates prefers-color-scheme and adds the
//                                            //   scheme to each file name. Omit it for apps that pick
//                                            //   their own theme.
//     "storageState": "path/to/state.json",  // optional; a logged-in Playwright state
//     "axe": false                           // optional; needs @axe-core/playwright in the repo
//   }
//
// Each route is captured as loaded; there is no way to click through to a state yet, so a
// single-page app whose interesting views need interaction shows only its landing state.
//
// Needs `playwright` installed in the repo (and its browsers: `npx playwright install chromium`).

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SLUG_RE = /^\d{4}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const DEFAULT_VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
};

// Throws rather than exiting, so main's finally still stops the demo process.
function fail(msg) {
  throw new Error(msg);
}

function parseArgs(argv) {
  const args = { slug: null, config: "docs/audit/capture.json" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") args.config = argv[++i] ?? fail("--config needs a path");
    else if (!args.slug) args.slug = argv[i];
    else fail(`unexpected argument: ${argv[i]}`);
  }
  if (!args.slug) fail("usage: capture.mjs <slug> [--config <path>]");
  if (!SLUG_RE.test(args.slug)) fail(`slug must look like YYYY-MM-<scope>-<topic>, got "${args.slug}"`);
  return args;
}

function loadConfig(file) {
  if (!existsSync(file)) fail(`${file} not found; see the header of this script for its shape`);
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    fail(`${file} is not valid JSON: ${err.message}`);
  }
  if (typeof cfg.baseUrl !== "string") fail("capture.json needs a baseUrl");
  if (!Array.isArray(cfg.routes) || cfg.routes.length === 0) fail("capture.json needs a non-empty routes array");
  const host = new URL(cfg.baseUrl).hostname;
  if (!LOOPBACK.has(host)) fail(`baseUrl host "${host}" is not loopback; audits capture from an isolated local demo, never a live instance`);
  if (cfg.ready && !LOOPBACK.has(new URL(cfg.ready).hostname)) fail("ready must also be a loopback URL");
  return cfg;
}

function resolveFromRepo(name) {
  try {
    return createRequire(path.join(process.cwd(), "package.json"))(name);
  } catch {
    return null;
  }
}

async function waitForOutput(matched, timeoutSec, child) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`start command output did not match readyOutput within ${timeoutSec}s`)), timeoutSec * 1000).unref(),
  );
  const exited = new Promise((_, reject) =>
    child.once("exit", (code) => reject(new Error(`demo command exited early (code ${code})`))),
  );
  await Promise.race([matched, timeout, exited]);
}

async function waitFor(url, timeoutSec, child) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) fail(`demo command exited early (code ${child.exitCode})`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(`${url} did not answer within ${timeoutSec}s`);
}

function stop(child) {
  if (!child || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM"); // the whole process group, not just the shell
  } catch {
    // already gone
  }
}

const routeSlug = (route) =>
  route.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "home";

async function main() {
  const { slug, config } = parseArgs(process.argv.slice(2));
  const cfg = loadConfig(config);

  const pw = resolveFromRepo("playwright");
  if (!pw) fail("playwright is not installed in this repo; run `npm i -D playwright && npx playwright install chromium`");
  const axeMod = cfg.axe ? resolveFromRepo("@axe-core/playwright") : null;
  if (cfg.axe && !axeMod) console.warn("capture: axe requested but @axe-core/playwright is not installed; skipping axe");

  const root = process.cwd();
  const assetsRoot = path.resolve(root, "docs/audit/assets");
  const outDir = path.resolve(assetsRoot, slug);
  if (path.relative(assetsRoot, outDir).startsWith("..")) fail("output directory escaped docs/audit/assets");
  mkdirSync(outDir, { recursive: true });

  let child = null;
  const cleanup = () => stop(child);
  process.on("SIGINT", () => (cleanup(), process.exit(130)));
  process.on("SIGTERM", () => (cleanup(), process.exit(143)));

  let browser;
  try {
    let matched = null;
    if (cfg.start) {
      const watchOutput = Boolean(cfg.readyOutput);
      child = spawn(cfg.start, { shell: true, detached: true, stdio: ["inherit", watchOutput ? "pipe" : "inherit", "inherit"] });
      if (watchOutput) {
        const re = new RegExp(cfg.readyOutput);
        let seen = "";
        matched = new Promise((resolve) =>
          child.stdout.on("data", (chunk) => {
            process.stdout.write(chunk); // still show the demo's output
            seen += chunk;
            if (re.test(seen)) resolve();
          }),
        );
      }
    } else if (cfg.readyOutput) {
      fail("readyOutput needs a start command to read from");
    }
    const timeoutSec = cfg.startTimeoutSec ?? 120;
    if (matched) await waitForOutput(matched, timeoutSec, child);
    else await waitFor(cfg.ready ?? cfg.baseUrl, timeoutSec, child);

    browser = await pw.chromium.launch();
    const viewports = cfg.viewports ?? DEFAULT_VIEWPORTS;
    const schemes = cfg.colorSchemes ?? [null];
    const axeResults = {};
    let shots = 0;

    for (const [vpName, viewport] of Object.entries(viewports)) {
      for (const scheme of schemes) {
        const context = await browser.newContext({
          viewport,
          colorScheme: scheme ?? undefined,
          locale: cfg.locale,
          storageState: cfg.storageState,
          deviceScaleFactor: vpName === "phone" ? 2 : 1,
        });
        const page = await context.newPage();
        for (const route of cfg.routes) {
          const resolved = route.replaceAll("{locale}", cfg.locale ?? "");
          const url = new URL(resolved, cfg.baseUrl).toString();
          await page.goto(url, { waitUntil: "networkidle" });
          const name = [routeSlug(resolved), vpName, scheme].filter(Boolean).join(".");
          await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
          shots++;
          if (axeMod) {
            const AxeBuilder = axeMod.default ?? axeMod.AxeBuilder ?? axeMod;
            axeResults[name] = (await new AxeBuilder({ page }).analyze()).violations;
          }
        }
        await context.close();
      }
    }

    if (axeMod) writeFileSync(path.join(outDir, "axe.json"), JSON.stringify(axeResults, null, 2));
    console.log(`capture: ${shots} screenshots -> ${path.relative(root, outDir)}/`);
  } finally {
    if (browser) await browser.close();
    cleanup();
  }
}

main().catch((err) => {
  console.error(`capture: ${err.message}`);
  process.exit(1);
});
