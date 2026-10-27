#!/usr/bin/env bun
/** pane-dump.ts — maximal helper: drive a tau pane's /debug menu to
 * "Report: dump session" and capture the bundle path. One round-trip.
 * Usage: bun pane-dump.ts <pane_id> [downs=3]
 */
import { spawnSync } from "node:child_process";

const THRESHER = "/home/toxic/pens/ranch/thresher/bin/thresher";
const CFG = "/home/toxic/estate/ranch/thresher/mcp_config.json";

function call(name: string, args: unknown, read: boolean): string {
  const r = spawnSync(
    THRESHER,
    ["--config", CFG, "call", read ? "tool-read" : "tool-write",
     "--tool-name", name, "--json_args", JSON.stringify(args),
     "--timeout", "55s", "-o", "json"],
    { encoding: "utf8", timeout: 60_000 },
  );
  const all = (r.stdout || "") + (r.stderr || "");
  if (r.status !== 0) throw new Error(`${name} exit ${r.status}: ${all.slice(0, 300)}`);
  return all;
}

const paneId = Number(process.argv[2]);
const downs = Number(process.argv[3] ?? 3);

call("wezterm:wez_send_text_submit", { pane_id: paneId, text: "/debug" }, false);
for (let i = 0; i < downs; i++)
  call("wezterm:wez_send_key", { pane_id: paneId, key: "Down" }, false);
call("wezterm:wez_send_key", { pane_id: paneId, key: "Enter" }, false);
const out = call("wezterm:wez_read_all", { lines: 40 }, true);
console.log(out.split("\n").filter((l) => /dump|bundle|report|session/i.test(l)).join("\n"));
