#!/usr/bin/env bun
/** gh-focus-context-recon.ts — GH global code search for the runtime-harness
 * markers (system-notice / focus_context / goal_context), pull matching CODE
 * files into one /tmp folder. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "/tmp/kappa/harness-markers";
mkdirSync(OUT, { recursive: true });

const QUERIES = ["system-notice", "focus_context", "goal_context"];
const seen = new Map<string, { repo: string; path: string; sha: string }>();

for (const q of QUERIES) {
  const r = Bun.spawnSync(
    [
      "gh",
      "search",
      "code",
      q,
      "--limit",
      "30",
      "--json",
      "path,repository,sha",
    ],
    {
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
      },
      timeout: 60_000,
    },
  );
  const out = (r.stdout?.toString() ?? "").trim();
  if (!out) {
    console.log(`[${q}] no results (exit ${r.exitCode})`);
    continue;
  }
  try {
    const rows = JSON.parse(out) as Array<{
      path: string;
      repository: { nameWithOwner: string };
      sha: string;
    }>;
    for (const row of rows) {
      // code only: ts/js/py/go/rs
      if (!/\.(ts|tsx|js|mjs|py|go|rs)$/.test(row.path)) continue;
      const k = `${row.repository.nameWithOwner}#${row.path}`;
      if (!seen.has(k))
        seen.set(k, {
          repo: row.repository.nameWithOwner,
          path: row.path,
          sha: row.sha,
        });
    }
    console.log(`[${q}] ${rows.length} rows, code files so far: ${seen.size}`);
  } catch (e) {
    console.log(`[${q}] parse fail: ${e} raw: ${out.slice(0, 120)}`);
  }
}

let pulled = 0;
for (const [k, v] of seen) {
  let url = `https://raw.githubusercontent.com/${v.repo}/HEAD/${v.path}`;
  let resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) {
    // HEAD may have moved since indexing — fetch the exact sha via the API.
    const api = `https://api.github.com/repos/${v.repo}/contents/${v.path}?ref=${v.sha}`;
    resp = await fetch(api, { headers: { Accept: "application/vnd.github.raw" }, signal: AbortSignal.timeout(15_000) });
  }
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) {
    console.log(`MISS ${k}: ${r.status}`);
    continue;
  }
  const text = await r.text();
  const name = k.replace(/[#/]/g, "__");
  writeFileSync(join(OUT, name), text);
  pulled++;
  console.log(`PULLED ${k} (${text.length}b)`);
}
writeFileSync(join(OUT, "INDEX.md"), [...seen.keys()].join("\n"));
console.log(`DONE: ${pulled}/${seen.size} files -> ${OUT}`);
