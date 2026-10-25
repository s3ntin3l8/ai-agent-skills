#!/usr/bin/env node
// Checks that every plugin's manifests agree, and optionally that a changed plugin was
// version-bumped. Run from the repo root; no dependencies.
//
//   node scripts/check-manifests.mjs                 # consistency only
//   node scripts/check-manifests.mjs --base origin/main   # also: changed plugin => new version
//
// Claude Code and Codex update an installed plugin only when its `version` changes, so a
// content change without a bump never reaches an existing install.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MANIFESTS = [".claude-plugin", ".codex-plugin", ".antigravity-plugin"].map((d) => `${d}/plugin.json`);
const CLAUDE_MARKETPLACE = ".claude-plugin/marketplace.json";
const CODEX_MARKETPLACE = ".agents/plugins/marketplace.json";

const errors = [];
const err = (msg) => errors.push(msg);

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    err(`${file}: ${e.code === "ENOENT" ? "missing" : `not valid JSON (${e.message})`}`);
    return null;
  }
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const baseIdx = process.argv.indexOf("--base");
const base = baseIdx === -1 ? null : (process.argv[baseIdx + 1] ?? err("--base needs a ref"));

const plugins = existsSync("plugins")
  ? readdirSync("plugins", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
if (plugins.length === 0) err("no plugins/ directories found; run from the repo root");

const claudeMarket = readJson(CLAUDE_MARKETPLACE);
const codexMarket = readJson(CODEX_MARKETPLACE);

for (const name of plugins) {
  const dir = `plugins/${name}`;
  const parsed = MANIFESTS.map((m) => [m, readJson(`${dir}/${m}`)]);

  for (const [m, json] of parsed) {
    if (!json) continue;
    if (json.name !== name) err(`${dir}/${m}: name "${json.name}" does not match the folder "${name}"`);
    if (typeof json.version !== "string") err(`${dir}/${m}: no version`);
  }
  const versions = new Set(parsed.filter(([, j]) => j && typeof j.version === "string").map(([, j]) => j.version));
  if (versions.size > 1) {
    err(`${dir}: manifests disagree on version (${parsed.map(([m, j]) => `${m.split("/")[0]}=${j?.version}`).join(", ")})`);
  }

  const codex = parsed.find(([m]) => m.startsWith(".codex-plugin"))[1];
  if (codex?.skills && !existsSync(path.join(dir, codex.skills))) err(`${dir}: skills path "${codex.skills}" does not exist`);

  const inClaude = claudeMarket?.plugins?.find((p) => p.name === name);
  if (claudeMarket && !inClaude) err(`${CLAUDE_MARKETPLACE}: no entry for "${name}"`);
  if (inClaude && !existsSync(path.join(inClaude.source ?? "", "."))) err(`${CLAUDE_MARKETPLACE}: source "${inClaude.source}" for "${name}" does not exist`);
  const inCodex = codexMarket?.plugins?.find((p) => p.name === name);
  if (codexMarket && !inCodex) err(`${CODEX_MARKETPLACE}: no entry for "${name}"`);
  if (inCodex && !existsSync(path.join(inCodex.source?.path ?? "", "."))) err(`${CODEX_MARKETPLACE}: path "${inCodex.source?.path}" for "${name}" does not exist`);

  if (base && versions.size === 1) {
    const [version] = versions;
    let baseVersion = null;
    try {
      baseVersion = JSON.parse(git("show", `${base}:${dir}/${MANIFESTS[0]}`)).version;
    } catch {
      // a plugin that is new relative to base needs no bump
    }
    if (baseVersion !== null) {
      const changed = git("diff", "--name-only", `${base}...HEAD`, "--", dir).split("\n").filter(Boolean);
      if (changed.length > 0 && version === baseVersion) {
        err(`${dir}: ${changed.length} file(s) changed since ${base} but the version is still ${version}; bump it in all three manifests`);
      }
    }
  }
}

for (const entry of [...(claudeMarket?.plugins ?? []).map((p) => [CLAUDE_MARKETPLACE, p.name]), ...(codexMarket?.plugins ?? []).map((p) => [CODEX_MARKETPLACE, p.name])]) {
  if (!plugins.includes(entry[1])) err(`${entry[0]}: lists "${entry[1]}" but plugins/${entry[1]}/ does not exist`);
}

if (errors.length) {
  console.error(`check-manifests: ${errors.length} problem(s)\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}
console.log(`check-manifests: ${plugins.length} plugin(s) consistent${base ? ` (version bump checked against ${base})` : ""}`);
