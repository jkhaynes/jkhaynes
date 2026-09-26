// Refreshes the live parts of the profile README. Run by
// .github/workflows/update-profile.yml; no dependencies beyond Node 20+.
//
//   1. "Recently shipped": the latest merged pull requests across public repos,
//      written between the recently-shipped markers in README.md.
//   2. badges/loot-specs.json: a shields.io endpoint badge counting
//      loot-singles-fulfillment features whose tasks.md is fully checked off.
//
// Usage: GITHUB_TOKEN=... node scripts/update-profile.mjs [--dry-run]

import { readFile, writeFile, mkdir } from "node:fs/promises";

const USER = "jkhaynes";
const SHIP_COUNT = 5;
const SKIP_REPOS = new Set([`${USER}/${USER}`]); // the profile repo itself
const LOOT = { repo: `${USER}/loot-singles-fulfillment`, branch: "main" };
const README = "README.md";
const START = "<!-- recently-shipped:start -->";
const END = "<!-- recently-shipped:end -->";
const dryRun = process.argv.includes("--dry-run");

async function gh(path) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function raw(repo, branch, path) {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${path}`);
  if (!res.ok) throw new Error(`raw ${repo}/${path}: ${res.status}`);
  return res.text();
}

// Markdown and HTML both treat these as syntax; a PR title is plain text.
const escape = (s) => s.replace(/[\\`*_[\]<>|]/g, (c) => `\\${c}`);

const month = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export async function recentlyShipped() {
  // Search cannot sort by merge date, so fetch a page and sort here.
  const q = encodeURIComponent(`author:${USER} is:pr is:merged is:public`);
  const { items } = await gh(`/search/issues?q=${q}&sort=updated&order=desc&per_page=50`);
  const prs = items
    .map((it) => ({
      repo: it.repository_url.replace("https://api.github.com/repos/", ""),
      number: it.number,
      title: it.title.trim(),
      url: it.html_url,
      merged: it.pull_request?.merged_at,
    }))
    .filter((pr) => pr.merged && !SKIP_REPOS.has(pr.repo))
    .sort((a, b) => b.merged.localeCompare(a.merged))
    .slice(0, SHIP_COUNT);
  if (prs.length === 0) return "_Nothing merged recently._";
  return prs
    .map((pr) => {
      const name = pr.repo.split("/")[1];
      return `- **${name}** · [${escape(pr.title)}](${pr.url}) · ${month(pr.merged)}`;
    })
    .join("\n");
}

export function spliceSection(readme, body) {
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a < 0 || b < a) throw new Error(`README is missing the ${START} / ${END} markers`);
  return `${readme.slice(0, a + START.length)}\n${body}\n${readme.slice(b)}`;
}

// A checklist line in a spec-kit tasks.md: "- [ ] T001 ..." or "- [x] T001 ...".
export function taskCounts(markdown) {
  const boxes = [...markdown.matchAll(/^\s*[-*] \[([ xX])\]/gm)];
  return { done: boxes.filter((m) => m[1] !== " ").length, total: boxes.length };
}

export async function lootSpecBadge() {
  const tree = await gh(`/repos/${LOOT.repo}/git/trees/${LOOT.branch}?recursive=1`);
  const files = tree.tree.map((t) => t.path).filter((p) => /^specs\/[^/]+\/tasks\.md$/.test(p));
  let complete = 0;
  for (const path of files) {
    const { done, total } = taskCounts(await raw(LOOT.repo, LOOT.branch, path));
    if (total > 0 && done === total) complete++;
  }
  return {
    schemaVersion: 1,
    label: "specs",
    message: `${complete}/${files.length} features complete`,
    color: "F5E0DC",
    labelColor: "45475A",
  };
}

async function main() {
  const readme = await readFile(README, "utf8");
  const next = spliceSection(readme, await recentlyShipped());
  const badge = JSON.stringify(await lootSpecBadge(), null, 2) + "\n";
  if (dryRun) {
    console.log(next.slice(next.indexOf(START), next.indexOf(END) + END.length));
    console.log(badge);
    return;
  }
  await writeFile(README, next);
  await mkdir("badges", { recursive: true });
  await writeFile("badges/loot-specs.json", badge);
  console.log("updated README.md and badges/loot-specs.json");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
