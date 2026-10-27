#!/usr/bin/env node
/**
 * kappahindsight — Kappa hindsight feature.
 *
 * Kappa-native recall / retrospective across past estate + Kappa work, modeled
 * on the kilo hindsight-plugin (mirrors the tau/kilo hindsight pattern). Durable
 * beyond a single session: this is a first-class Kappa command.
 *
 * Reads, when present:
 *   - the Kappa session store  (~/.local/share/kappa/kappa-main.db)
 *       recent sessions, goals (titles), todo state (blockers / in-progress)
 *   - the Squawk oracle ledger (ranch/squawk/oracle/ledger/ledger.jsonl)
 *       settled / slashed tasks, prior blockers, activity tally
 *   - the fleet directives     (ranch/hatch/kite/agents/ember/directives.md)
 *       standing directives / INBOX notes
 *
 * Zero runtime dependencies. Requires Node >= 22.5 (node:sqlite).
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const STORE = join(HOME, ".local/share/kappa/kappa-main.db");
const ORACLE_LEDGER =
  "/home/toxic/estate/ranch/squawk/oracle/ledger/ledger.jsonl";
const DIRECTIVES =
  "/home/toxic/estate/ranch/hatch/kite/agents/ember/directives.md";
const SQUAWK_URL = process.env.SQUAWK_URL || "http://127.0.0.1:25120";
const SQUAWK_TOKEN = (() => {
  try {
    return readFileSync(join(HOME, ".config/estate-chat-token"), "utf8").trim();
  } catch {
    return "";
  }
})();

function log(...a) {
  console.log(...a);
}

function openStore(path) {
  if (!existsSync(path)) return null;
  const db = new DatabaseSync(path, { readOnly: true });
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);
  if (!tables.includes("session")) return null;
  return db;
}

function recentSessions(db, n = 8) {
  if (!db) return [];
  return db
    .prepare(
      `SELECT id, title, agent, model, datetime(time_updated/1000,'unixepoch') AS ts,
              summary_additions AS a, summary_deletions AS d, summary_files AS files
       FROM session
       ORDER BY time_updated DESC LIMIT ?`,
    )
    .all(n);
}

function activeTodos(db) {
  if (!db) return [];
  return db
    .prepare(
      `SELECT s.title AS session_title, t.content, t.status
       FROM todo t JOIN session s ON s.id = t.session_id
       WHERE t.status IN ('in_progress','pending')
       ORDER BY t.time_updated DESC LIMIT 12`,
    )
    .all();
}

function oracleStats(path) {
  if (!existsSync(path)) return null;
  const events = {};
  let settled = 0;
  let slashed = 0;
  let last = null;
  const fd = readFileSync(path, "utf8");
  for (const line of fd.split("\n")) {
    if (!line.trim()) continue;
    let rec: { event?: string; task_id?: string } | null = null;
    try {
      rec = JSON.parse(line) as { event?: string; task_id?: string };
    } catch {
      continue;
    }
    const ev = rec.event || "unknown";
    events[ev] = (events[ev] || 0) + 1;
    if (ev === "settled") settled++;
    if (ev === "slashed") slashed++;
    last = rec;
  }
  return { events, settled, slashed, last };
}

function latestDirectives(path, maxLen = 2000) {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n").filter(Boolean);
  return lines.slice(0, 40).join("\n").slice(0, maxLen);
}

async function fleetBus(maxMsgs = 8) {
  if (!SQUAWK_TOKEN) return null;
  const headers = { Authorization: `Bearer ${SQUAWK_TOKEN}` };
  try {
    const [stateRes, msgsRes, agentsRes] = await Promise.all([
      fetch(`${SQUAWK_URL}/v1/state`, { headers }),
      fetch(`${SQUAWK_URL}/v1/rooms/fleet/messages`, { headers }),
      fetch(`${SQUAWK_URL}/v1/agents`, { headers }),
    ]);
    const state = await stateRes.json().catch(() => null);
    const rosterRes = await agentsRes.json().catch(() => null);
    const roster = (rosterRes && rosterRes.agents) || [];
    const agentsList =
      roster.length > 0 ? roster : state && state.agents ? state.agents : [];
    const agents = agentsList.map((a) => a.name || a.agent_id);
    const pool = await msgsRes.json().catch(() => null);
    const messages = ((pool && pool.messages) || []).slice(-maxMsgs);
    return {
      agents,
      messages: messages.map((m) => {
        const ts = m.ts ? m.ts.slice(11, 16) : "-";
        return `  [${ts}] ${m.from_agent}${m.kind && m.kind !== "chat" ? `/${m.kind}` : ""}: ${String(
          m.body,
        ).slice(0, 160)}`;
      }),
    };
  } catch {
    return null;
  }
}

function modelId(m) {
  if (!m) return "";
  try {
    const j = JSON.parse(m);
    return j.id ?? "";
  } catch {
    return String(m);
  }
}

function fmtSessions(rows) {
  return rows
    .map(
      (r) =>
        `  [${r.ts}] ${r.title}  (${r.agent || "?"}${modelId(r.model) ? `, ${modelId(r.model)}` : ""}${
          typeof r.files === "number" && r.files
            ? `, +${r.a}/-${r.d} ${r.files}f`
            : ""
        })`,
    )
    .join("\n");
}

function fmtTodos(rows) {
  return rows
    .map((r) => `  [${r.status}] (${r.session_title || "?"}) ${r.content}`)
    .join("\n");
}

function fmtOracle(o) {
  if (!o) return "  (oracle ledger not found)";
  return [
    `  settled tasks: ${o.settled}`,
    `  slashed tasks: ${o.slashed}`,
    `  last event: ${o.last ? o.last.event : "-"}${o.last && o.last.task_id ? ` (${o.last.task_id})` : ""}`,
    `  event tally: ${Object.entries(o.events)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    log(
      `kappahindsight — Kappa estate recall feature (modeled on kilo hindsight)
Usage: kappa-hindsight [goals|changed|blockers|all]

  goals    recent session goals (default)
  changed  recent sessions + diff stats (what changed)
  blockers in-progress / pending todos + oracle slashed
  all      everything above`,
    );
    return;
  }
  const mode = args[0] || "goals";
  const db = openStore(STORE);

  if (!db) log(`# store not found: ${STORE}`);
  if (mode === "all") {
    log("## KAPPA HINDSIGHT — recent goals");
    log(fmtSessions(recentSessions(db)));
    log("\n## KAPPA HINDSIGHT — what changed (todos/open work)");
    log(fmtTodos(activeTodos(db)));
    log("\n## KAPPA HINDSIGHT — prior blockers / activity (oracle)");
    log(fmtOracle(oracleStats(ORACLE_LEDGER)));
    log("\n## KAPPA HINDSIGHT — fleet directives (head)");
    log(latestDirectives(DIRECTIVES) || "  (none)");
    const bus = await fleetBus();
    if (bus) {
      log("\n## KAPPA HINDSIGHT — squawk fleet bus (live :25120)");
      log(`  roster: ${bus.agents.length ? bus.agents.join(", ") : "(none)"}`);
      if (bus.messages.length)
        log("  recent fleet:\n" + bus.messages.join("\n"));
      else log("  (no recent fleet messages)");
    } else {
      log("\n## KAPPA HINDSIGHT — squawk fleet bus (live :25120)");
      log("  (bus unreachable / no token)");
    }
  } else if (mode === "changed") {
    if (db) {
      log("## KAPPA HINDSIGHT — what changed (recent sessions)");
      log(fmtSessions(recentSessions(db, 10)));
    } else {
      log("(no session store)");
    }
  } else if (mode === "blockers") {
    log("## KAPPA HINDSIGHT — prior blockers / open work");
    log(fmtTodos(activeTodos(db)));
    log("\nOracle activity:");
    log(fmtOracle(oracleStats(ORACLE_LEDGER)));
  } else {
    log("## KAPPA HINDSIGHT — recent goals (sessions)");
    log(fmtSessions(recentSessions(db)));
  }
}

main().catch((e) => {
  console.log("(hindsight error: " + String(e?.message ?? e) + ")");
  process.exit(1);
});
