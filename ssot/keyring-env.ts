#!/usr/bin/env bun
/**
 * keyring-env.ts — emit `KEY=value` shell lines from the D-Bus Secret Service.
 * TS/Bun port of keyring-env.py (Python banned). Same contract: daemon-lane
 * SSOT; secrets never touch a repo. Values printed shell-quoted.
 * Requires `busctl` (systemd) on PATH.
 */
import { spawnSync } from "node:child_process";

const DBUS = process.env.DBUS_SESSION_BUS_ADDRESS ?? "unix:path=/run/user/1000/bus";

function sh(cmd: string, timeoutMs = 15000): { out: string; code: number } {
  const r = spawnSync("bash", ["-c", cmd], {
    encoding: "utf8",
    timeout: timeoutMs,
    env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: DBUS },
  });
  return { out: String(r.stdout ?? "").trim(), code: r.status ?? 1 };
}

function quoteSh(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function defaultCollectionPath(): string | null {
  const { out, code } = sh(
    "busctl --user call org.freedesktop.secrets /org/freedesktop/secrets org.freedesktop.Secret.Service GetDefaultCollection",
  );
  if (code !== 0) return null;
  const m = out.match(/(\/org\/freedesktop\/secrets\/[\w/]+)$/);
  return m ? m[1] : null;
}

function itemPaths(collection: string): string[] {
  const { out, code } = sh(
    `busctl --user get-property org.freedesktop.secrets ${collection} org.freedesktop.Secret.Collection Items`,
  );
  if (code !== 0) return [];
  return out.split(/\s+/).filter(p => p.startsWith("/org/freedesktop/secrets/"));
}

function itemLabel(item: string): string {
  const { out } = sh(`busctl --user get-property org.freedesktop.secrets ${item} org.freedesktop.Secret.Item Label`);
  const m = out.match(/^s\s+"((?:[^"\\]|\\.)*)"/);
  return m ? m[1].replace(/\\(.)/g, "$1") : "";
}

function itemLocked(item: string): boolean {
  const { out } = sh(`busctl --user get-property org.freedesktop.secrets ${item} org.freedesktop.Secret.Item Locked`);
  return out.includes("true");
}

function openSession(): string | null {
  const { out, code } = sh(
    'busctl --user call org.freedesktop.secrets /org/freedesktop/secrets org.freedesktop.Secret.Service OpenSession ss "plain" ""',
  );
  if (code !== 0) return null;
  const paths = out.split(/\s+/).filter(p => p.startsWith("/org/freedesktop/secrets/"));
  return paths[paths.length - 1] ?? null;
}

function itemSecret(item: string, session: string): string | null {
  const { out, code } = sh(
    `busctl --user call org.freedesktop.secrets ${item} org.freedesktop.Secret.Item GetSecret ${session}`,
  );
  if (code !== 0) return null;
  // Output shape: `o /org/...` newline `ay N <bytes...>` newline `s ...`
  const bytesLine = out.split("\n").find(l => l.trim().startsWith("ay "));
  if (!bytesLine) return null;
  const parts = bytesLine.trim().split(/\s+/);
  const n = Number(parts[1]);
  const bytes = parts.slice(2, 2 + n).map(Number);
  return Buffer.from(bytes).toString("utf8").trim();
}

const only = new Set(process.argv.slice(2));

const collection = defaultCollectionPath();
if (!collection) {
  console.error("echo 'keyring-env: no default collection' >&2");
  process.exit(3);
}
const session = openSession();
for (const item of itemPaths(collection)) {
  const label = itemLabel(item);
  if (!label || !/^[A-Z_]+$/.test(label)) continue;
  if (only.size && !only.has(label)) continue;
  if (itemLocked(item)) continue;
  const secret = itemSecret(item, session ?? "");
  if (secret) console.log(`${label}=${quoteSh(secret)}`);
}
process.exit(0);
