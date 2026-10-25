#!/usr/bin/env node
// Generic visual-audit capture. Run from the repo root:
//
//   node <audit skill>/scripts/capture.mjs <slug> [--config <path>]
//
// Config: docs/audit/capture.<slug>.json when it exists (an audit whose routes or ports
// differ from the repo's usual ones), otherwise docs/audit/capture.json.
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
//     "routes": [                            // required; "{locale}" is replaced by "locale"
//       "/",                                 //   a path: captured as loaded
//       { "name": "certificates",            //   or an object, for a view that needs interaction:
//         "path": "/",                       //   path (default "/")
//         "localStorage": { "tab": "certs" },//   keys set before the page loads
//         "steps": [                         //   run in order after load, then the shot is taken
//           { "click": "text=Certificates" },
//           { "waitFor": ".cert-table" }
//         ],
//         "settle": ".cert-table tr" }       //   a selector (or ms) to wait for before the shot
//     ],
//     "locale": "en",                        // optional; also sets the browser locale
//     "viewports": {                         // optional; these are the defaults
//       "phone":  { "width": 390,  "height": 844 },
//       "tablet": { "width": 820,  "height": 1180 }
//     },
//     "colorSchemes": ["light", "dark"],     // optional; emulates prefers-color-scheme and adds the
//                                            //   scheme to each file name. Omit it for apps that pick
//                                            //   their own theme.
//     "storageState": "path/to/state.json",  // optional; a logged-in Playwright state
//     "axe": false,                          // optional; needs @axe-core/playwright in the repo
//     "nodeDir": "frontend"                  // optional; resolve playwright (and axe) from this
//                                            //   subfolder first, then the repo root. For repos whose
//                                            //   Node tooling is not at the root (e.g. a Python backend)
//   }
//
// Steps are declarative, one action each: {"click": sel}, {"hover": sel}, {"fill": sel,
// "value": text}, {"press": key}, {"waitFor": sel}, {"wait": ms (max 5000)}. Selectors are
// Playwright selectors ("text=Save", "[data-testid=x]"). There is no arbitrary code in the config.
// An object route needs a unique "name" (it names the PNG). Every route gets a fresh browser
// context, so one route's clicks and storage never leak into the next.
//
// Needs `playwright` installed in the repo or in `nodeDir` (and its browsers:
// `npx playwright install chromium`).

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
  const args = { slug: null, config: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") args.config = argv[++i] ?? fail("--config needs a path");
    else if (!args.slug) args.slug = argv[i];
    else fail(`unexpected argument: ${argv[i]}`);
  }
  if (!args.slug) fail("usage: capture.mjs <slug> [--config <path>]");
  if (!SLUG_RE.test(args.slug)) fail(`slug must look like YYYY-MM-<scope>-<topic>, got "${args.slug}"`);
  args.config ??= existsSync(`docs/audit/capture.${args.slug}.json`)
    ? `docs/audit/capture.${args.slug}.json`
    : "docs/audit/capture.json";
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

// Resolve a package from `nodeDir` first (a subfolder that holds the repo's Node tooling,
// e.g. "frontend"), then from the repo root.
function resolveFromRepo(name, nodeDir) {
  const dirs = [nodeDir && path.resolve(process.cwd(), nodeDir), process.cwd()].filter(Boolean);
  for (const dir of dirs) {
    try {
      return createRequire(path.join(dir, "package.json"))(name);
    } catch {
      // try the next directory
    }
  }
  return null;
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

const STEP_ACTIONS = ["click", "hover", "fill", "press", "waitFor", "wait"];
const MAX_WAIT_MS = 5000;
const STEP_TIMEOUT_MS = 10_000;

// Turns each config route (string or object) into { name, path, steps, localStorage, settle },
// failing on a malformed entry before anything is started.
function normalizeRoutes(cfg) {
  const seen = new Set();
  return cfg.routes.map((route, i) => {
    const where = `routes[${i}]`;
    const obj = typeof route === "string" ? { path: route } : route;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) fail(`${where} must be a path string or an object`);
    const resolve = (v) => v.replaceAll("{locale}", cfg.locale ?? "");
    const routePath = resolve(obj.path ?? "/");
    const interactive = Boolean(obj.steps?.length || obj.localStorage || obj.settle !== undefined);
    if (interactive && !obj.name) fail(`${where} (${routePath}) has steps, localStorage or settle, so it needs a "name"`);
    const name = obj.name ? routeSlug(obj.name) : routeSlug(routePath);
    if (seen.has(name)) fail(`${where}: the name "${name}" is used twice; give each route a unique name`);
    seen.add(name);
    const steps = obj.steps ?? [];
    if (!Array.isArray(steps)) fail(`${where}.steps must be an array`);
    steps.forEach((step, j) => {
      const actions = STEP_ACTIONS.filter((a) => a in (step ?? {}));
      if (actions.length !== 1) fail(`${where}.steps[${j}] needs exactly one of ${STEP_ACTIONS.join(", ")}`);
      const [action] = actions;
      if (action === "wait" && !(step.wait >= 0 && step.wait <= MAX_WAIT_MS)) fail(`${where}.steps[${j}]: wait must be 0-${MAX_WAIT_MS} ms`);
      if (action === "fill" && typeof step.value !== "string") fail(`${where}.steps[${j}]: fill needs a string "value"`);
      if (action !== "wait" && typeof step[action] !== "string") fail(`${where}.steps[${j}]: ${action} needs a string`);
    });
    if (obj.localStorage && (typeof obj.localStorage !== "object" || Object.values(obj.localStorage).some((v) => typeof v !== "string"))) {
      fail(`${where}.localStorage must map keys to string values`);
    }
    return { name, path: routePath, steps, localStorage: obj.localStorage, settle: obj.settle };
  });
}

async function runStep(page, step) {
  if ("click" in step) await page.click(step.click);
  else if ("hover" in step) await page.hover(step.hover);
  else if ("fill" in step) await page.fill(step.fill, step.value);
  else if ("press" in step) await page.keyboard.press(step.press);
  else if ("waitFor" in step) await page.waitForSelector(step.waitFor, { state: "visible" });
  else await page.waitForTimeout(step.wait);
}

async function main() {
  const { slug, config } = parseArgs(process.argv.slice(2));
  const cfg = loadConfig(config);

  const pw = resolveFromRepo("playwright", cfg.nodeDir);
  if (!pw) fail(`playwright is not installed in ${cfg.nodeDir ? `${cfg.nodeDir}/ or the repo root` : "this repo"}; run \`npm i -D playwright && npx playwright install chromium\` in ${cfg.nodeDir ? `${cfg.nodeDir}/` : "the repo root"}, or set "nodeDir" in capture.json to where it is installed`);
  const axeMod = cfg.axe ? resolveFromRepo("@axe-core/playwright", cfg.nodeDir) : null;
  if (cfg.axe && !axeMod) console.warn("capture: axe requested but @axe-core/playwright is not installed; skipping axe");

  const routes = normalizeRoutes(cfg);

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
        for (const route of routes) {
          // A fresh context per route: clicks and storage from one route never reach the next.
          const context = await browser.newContext({
            viewport,
            colorScheme: scheme ?? undefined,
            locale: cfg.locale,
            storageState: cfg.storageState,
            deviceScaleFactor: vpName === "phone" ? 2 : 1,
          });
          const page = await context.newPage();
          page.setDefaultTimeout(STEP_TIMEOUT_MS);
          const name = [route.name, vpName, scheme].filter(Boolean).join(".");
          try {
            if (route.localStorage) {
              await page.addInitScript((items) => {
                for (const [k, v] of Object.entries(items)) window.localStorage.setItem(k, v);
              }, route.localStorage);
            }
            await page.goto(new URL(route.path, cfg.baseUrl).toString(), { waitUntil: "networkidle" });
            for (const step of route.steps) await runStep(page, step);
            if (typeof route.settle === "number") await page.waitForTimeout(Math.min(route.settle, MAX_WAIT_MS));
            else if (route.settle) await page.waitForSelector(route.settle, { state: "visible" });
            await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
            shots++;
            if (axeMod) {
              const AxeBuilder = axeMod.default ?? axeMod.AxeBuilder ?? axeMod;
              axeResults[name] = (await new AxeBuilder({ page }).analyze()).violations;
            }
          } catch (e) {
            fail(`route "${route.name}" (${vpName}${scheme ? `, ${scheme}` : ""}): ${e.message.split("\n")[0]}`);
          } finally {
            await context.close();
          }
        }
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
