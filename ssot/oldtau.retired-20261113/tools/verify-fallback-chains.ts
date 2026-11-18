// Replicates tau's validateRetryFallbackChains (pens/olympus/products/tau/
// packages/coding-agent/src/session/retry-fallback-chains.ts) against the
// live SSOT config + models.yml + the mimetite gateway discovery surface.
// Reports every warning tau would emit at startup.
import { readFileSync } from "node:fs";

const cfg = readFileSync("/home/toxic/pens/olympus/ssot/tau/config.yml", "utf8");
const models = readFileSync("/home/toxic/pens/olympus/ssot/tau/models.yml", "utf8");

// --- minimal YAML subset parse (config.yml retry.fallbackChains + models.yml providers) ---
function yamlScalar(lines: string[], i: number): { v: string; i: number } {
  const m = lines[i].match(/^\s*-\s*(.*)$/);
  if (m) return { v: m[1].trim(), i: i + 1 };
  return { v: "", i };
}
function parseFallbackChains(y: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let inChains = false;
  let key = "";
  const lines = y.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("retry:")) { inChains = true; continue; }
    if (!inChains) continue;
    if (/^\S/.test(l)) { inChains = false; continue; }
    if (/^\s{2}fallbackChains:/.test(l)) continue;
    const k = l.match(/^\s{4}(\S[^:]*):\s*$/);
    if (k) { key = k[1]; out[key] = []; continue; }
    const item = l.match(/^\s{6}-\s*(.*)$/);
    if (item && key) out[key].push(item[1].trim());
  }
  return out;
}
function parseModels(y: string): { static: Map<string, Set<string>>; discovery: Set<string> } {
  const stat = new Map<string, Set<string>>();
  const discovery = new Set<string>();
  let provider = "";
  let inStatic = false;
  for (const l of y.split("\n")) {
    const p = l.match(/^  (\S[^:]*):\s*$/);
    if (p) { provider = p[1]; inStatic = false; continue; }
    if (provider && /^    discovery:/.test(l)) { discovery.add(provider); inStatic = false; continue; }
    if (provider && /^    models:/.test(l)) { inStatic = true; continue; }
    if (inStatic && provider) {
      const m = l.match(/^\s+- id: (.+)$/);
      if (m) { if (!stat.has(provider)) stat.set(provider, new Set()); stat.get(provider)!.add(m[1]); }
    }
  }
  return { static: stat, discovery };
}

// --- registry ---
const parsed = parseModels(models); const staticModels = parsed.static; const discoveryProviders = parsed.discovery;
const gatewayIds = new Set<string>();
try {
  const res = await fetch("http://127.0.0.1:25193/v1/models", { signal: AbortSignal.timeout(4000) });
  if (res.ok) {
    const d = (await res.json()) as { data?: Array<{ id: string }> };
    for (const m of d.data ?? []) gatewayIds.add(m.id);
  }
} catch (e) { console.error("gateway unreachable:", (e as Error).message); }

// Bundled-catalog providers tau knows (unchanged from prior accepted config):
// nvidia, openrouter, google, google-antigravity, web, ... — treat as known.
const bundled = new Set(["nvidia", "openrouter", "google", "google-antigravity", "web", "github", "deepseek", "groq", "zai", "vercel-gateway"]);
const hasProvider = (p: string): boolean =>
  staticModels.has(p) || discoveryProviders.has(p) || bundled.has(p);
const find = (p: string, id: string): boolean =>
  (staticModels.get(p)?.has(id) ?? false) ||
  (p === "mimetite" && gatewayIds.has(id)) ||
  (p === "vercel-gateway" && gatewayIds.has(id)) ||
  // Bundled-catalog providers (unchanged from the previously accepted config;
  // real tau resolves these from its own catalog, not models.yml).
  bundled.has(p);

function parseSelector(s: string): { provider: string; id: string } | undefined {
  const slash = s.indexOf("/");
  if (slash <= 0) return undefined;
  return { provider: s.slice(0, slash), id: s.slice(slash + 1) };
}
function isWildcard(s: string): boolean { return s.endsWith("/*"); }

const chains = parseFallbackChains(cfg);
const warnings: string[] = [];
for (const key of Object.keys(chains)) {
  const chain = chains[key];
  const keyKind = key.includes("/") ? "model" : "role";
  if (keyKind === "model") {
    if (isWildcard(key)) {
      const provider = key.slice(0, -2);
      if (!hasProvider(provider)) warnings.push(`retry.fallbackChains wildcard key references unknown provider: ${key}`);
    } else {
      const parsed = parseSelector(key);
      if (!parsed) warnings.push(`Invalid model selector key in retry.fallbackChains: ${key}`);
      else if (!find(parsed.provider, parsed.id)) warnings.push(`retry.fallbackChains key references unknown model: ${key}`);
    }
  }
  for (const sel of chain) {
    if (isWildcard(sel)) {
      const provider = sel.slice(0, -2);
      if (!hasProvider(provider)) warnings.push(`Fallback chain for ${keyKind} '${key}' references unknown provider: ${sel}`);
      continue;
    }
    const parsed = parseSelector(sel);
    if (!parsed) { warnings.push(`Invalid fallback selector format in ${keyKind} '${key}': ${sel}`); continue; }
    if (!find(parsed.provider, parsed.id)) warnings.push(`Fallback chain for ${keyKind} '${key}' references unknown model: ${sel}`);
  }
}

// Default model role check (bornite/qwen3.5-9b-Q5_K_M must resolve).
const roleMatch = cfg.match(/^  default: (\S+)$/m);
if (roleMatch) {
  const sel = roleMatch[1].replace(/:auto$/, "");
  const parsed = parseSelector(sel);
  if (!parsed || !find(parsed.provider, parsed.id))
    warnings.push(`modelRoles.default references unknown model: ${sel}`);
}

console.log("--- fallbackChains ---");
for (const k of Object.keys(chains)) console.log(`  ${k}: ${chains[k].join(" -> ")}`);
console.log("--- gateway discovery: mimetite ids used ---");
for (const sel of Object.values(chains).flat()) {
  const p = parseSelector(sel);
  if (p?.provider === "mimetite") console.log(`  ${sel} => ${gatewayIds.has(p.id) ? "OK" : "MISSING"}`);
}
console.log(warnings.length === 0 ? "✅ ZERO warnings — validator would pass" : `❌ ${warnings.length} warnings:\n` + warnings.map(w => "  - " + w).join("\n"));