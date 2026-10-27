#!/usr/bin/env bun
/**
 * tau-session-audit.ts — full dataframe-style audit of tau session jsonl files.
 * Taxonomy: model distribution, error classes (429 subtypes, guardrail, tool
 * failures), flail loops (repeated tool calls), retry burns, token economy.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SESS_DIR = join(homedir(), ".tau/agent/sessions/-tmp");
const args = process.argv.slice(2);
const targets = args.length
  ? args
  : readdirSync(SESS_DIR)
      .filter((f) => f.includes("01a17919") || f.includes("01a17943"))
      .map((f) => join(SESS_DIR, f));

type Row = Record<string, unknown>;
const count = (m: Map<string, number>, k: string) =>
  m.set(k, (m.get(k) ?? 0) + 1);

for (const file of targets) {
  const sid = file.split("/").pop() ?? file;
  let jsonlPath = file;
  if (statSync(file).isDirectory()) {
    const entries = readdirSync(file);
    const inner = entries.find((e) => e.endsWith(".jsonl"));
    if (!inner) {
      console.log(
        `${sid}: no jsonl (entries: ${entries.slice(0, 5).join(",")})`,
      );
      continue;
    }
    jsonlPath = join(file, inner);
  }
  const report: Record<string, unknown> = { session: sid };
  const lines = readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean);
  const rows: Row[] = [];
  for (const l of lines) {
    try {
      rows.push(JSON.parse(l));
    } catch {}
  }
  report.records = rows.length;

  // model distribution
  const models = new Map<string, number>();
  const errors = new Map<string, number>();
  const tools = new Map<string, { calls: number; fails: number }>();
  const userMsgs: string[] = [];
  let retries = 0,
    guardrail = 0,
    balanceDead = 0,
    concLimit = 0,
    freePerMin = 0;

  for (const r of rows) {
    const type = r.type as string;
    if (type === "assistant") {
      const m = (r.message as Row)?.model as string | undefined;
      if (m) count(models, m);
      const parts = ((r.message as Row)?.content ?? []) as Row[];
      for (const p of parts) {
        if (p.type === "tool-call" || p.type === "tool_use") {
          const name = (p.name ?? p.toolName ?? "?") as string;
          const t = tools.get(name) ?? { calls: 0, fails: 0 };
          t.calls++;
          tools.set(name, t);
        }
      }
    }
    if (type === "tool") {
      const name = (r.toolName ??
        (r.message as Row)?.toolName ??
        "?") as string;
      const t = tools.get(name) ?? { calls: 0, fails: 0 };
      const res = JSON.stringify(r).toLowerCase();
      if (res.includes("error") || res.includes("failed")) t.fails++;
      tools.set(name, t);
    }
    if (type === "user") {
      const c = (r.message as Row)?.content;
      const txt = typeof c === "string" ? c : JSON.stringify(c ?? "");
      userMsgs.push(txt.slice(0, 160));
    }
    const raw = JSON.stringify(r);
    if (/retry/i.test(raw)) retries++;
    if (/settings\/privacy|guardrail/i.test(raw)) guardrail++;
    if (/insufficient balance|recharge/i.test(raw)) balanceDead++;
    if (/concurrency_limit_exceeded/i.test(raw)) concLimit++;
    if (/free-models-per-min/i.test(raw)) freePerMin++;
  }

  // flail: same tool called 3+ times consecutively
  let flail = 0,
    run = 0,
    last = "";
  for (const r of rows) {
    if (r.type !== "assistant") {
      run = 0;
      last = "";
      continue;
    }
    const parts = ((r.message as Row)?.content ?? []) as Row[];
    const call = parts.find(
      (p) => p.type === "tool-call" || p.type === "tool_use",
    );
    const name = call
      ? String((call as Row).name ?? (call as Row).toolName)
      : "";
    if (name && name === last) {
      run++;
      if (run >= 2) flail++;
    } else run = 0;
    last = name;
  }

  const errRaw = rows.flatMap((r) => {
    const m = r.message as Row | undefined;
    return m && (m as Row).error
      ? [JSON.stringify((m as Row).error).slice(0, 200)]
      : [];
  });

  report.modelDistribution = Object.fromEntries(
    [...models].sort((a, b) => b[1] - a[1]),
  );
  report.signals = {
    retries,
    guardrailMentions: guardrail,
    insufficientBalance: balanceDead,
    concurrencyLimit: concLimit,
    freePerMin,
  };
  report.flailRuns = flail;
  report.tools = Object.fromEntries(
    [...tools].sort((a, b) => b[1].calls - a[1].calls).slice(0, 12),
  );
  report.userTurns = userMsgs.length;
  report.firstUserTurn = userMsgs[0] ?? null;
  report.lastUserTurn = userMsgs[userMsgs.length - 1] ?? null;
  report.errorSamples = [...new Set(errRaw)].slice(0, 8);

  writeFileSync(
    `/tmp/kappa/audit-${sid.slice(0, 24)}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(`=== ${sid.slice(0, 40)} ===`);
  console.log(
    "records:",
    report.records,
    "| models:",
    JSON.stringify(report.modelDistribution),
  );
  console.log(
    "signals:",
    JSON.stringify(report.signals),
    "| flailRuns:",
    flail,
  );
  console.log("first:", (report.firstUserTurn as string)?.slice(0, 110));
  console.log("last:", (report.lastUserTurn as string)?.slice(0, 110));
}
