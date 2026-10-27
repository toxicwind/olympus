#!/usr/bin/env bun
/**
 * usable-models-audit.ts — probe-driven usable-model audit for the tau catalog.
 *
 * Names drift (bornite=ex-herd, rhodochrosite=ex-NIM, chalcopyrite=ex-atlas,
 * thresher=ex-mcpproxy), so NOTHING is hardcoded: ports resolve from the
 * estate SSOT (estate/config/ports.env), provider surfaces are probed live
 * (DECLARED ≠ OBSERVED), and the diff vs tau's bundled models.json becomes a
 * KDL `exclude-models` block — models-only, never provider disablement.
 *
 * Effort oddity audit: per live model, report reasoning_effort /
 * max_reasoning / thinking support from supported_sampling_parameters so
 * modelRoles with dead effort suffixes surface in the same audit.
 *
 * Output: /tmp/kappa/usable-audit.json + /tmp/kappa/exclude-models.kdl
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ESTATE = join(homedir(), "estate");

// ---- name-agnostic SSOT resolution ----
function portEnv(): Map<string, string> {
  const m = new Map<string, string>();
  try {
    for (const line of readFileSync(
      join(ESTATE, "config/ports.env"),
      "utf8",
    ).split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i > 0)
        m.set(
          t.slice(0, i).trim(),
          t
            .slice(i + 1)
            .trim()
            .replace(/\s+#.*$/, "")
            .trim(),
        );
    }
  } catch {}
  return m;
}

const PORTS = portEnv();
function pickPort(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = PORTS.get(k);
    if (v) return v;
  }
  return undefined;
}

type Surface = { name: string; base: string; key?: string };
function surfaces(): Surface[] {
  const out: Surface[] = [];
  // rhodochrosite is AUTHORITATIVE: the estate router every lane fronts
  // (tau's openai-compatible lane points here with the corral JWT). Its
  // roster IS the usable model coordinate space.
  const rhodo = pickPort("RHODOCHROSITE_PORT", "NIM_PROXY_PORT", "ROUTER_PORT");
  if (rhodo)
    out.push({
      name: "rhodochrosite-router",
      base: `http://127.0.0.1:${rhodo}/v1`,
      key: process.env.RHODOCHROSITE_TOKEN ?? process.env.CORRAL_JWT,
    });
  const born = pickPort("BORNITE_PORT", "HERD_PORT", "LLAMA_SWAP_PORT");
  if (born)
    out.push({ name: "bornite-local", base: `http://127.0.0.1:${born}/v1` });
  const chal = pickPort("CHALCOPYRITE_PORT", "ATLAS_GATEWAY_PORT");
  if (chal)
    out.push({
      name: "chalcopyrite-guard",
      base: `http://127.0.0.1:${chal}/v1`,
    });
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey)
    out.push({
      name: "openrouter",
      base: "https://openrouter.ai/api/v1",
      key: orKey,
    });
  return out;
}

// ---- live probe: GET /models per surface ----
type LiveModel = {
  id: string;
  owner?: string;
  ctx?: number;
  params?: string[];
};
async function probe(
  s: Surface,
): Promise<{ surface: Surface; models: LiveModel[]; error?: string }> {
  try {
    const r = await fetch(`${s.base}/models`, {
      headers: s.key ? { Authorization: `Bearer ${s.key}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { surface: s, models: [], error: `HTTP ${r.status}` };
    const raw = await r.text();
    const json = JSON.parse(raw.slice(raw.indexOf("{")));
    const models = (json.data ?? []).map((m: Record<string, unknown>) => ({
      id: String(m.id),
      owner: m.owned_by && String(m.owned_by),
      ctx: (m.context_length as number) ?? undefined,
      params: m.supported_sampling_parameters as string[] | undefined,
    }));
    return { surface: s, models };
  } catch (err) {
    return {
      surface: s,
      models: [],
      error: String((err as Error).message).slice(0, 120),
    };
  }
}

// ---- tau catalog (bundled, declared) ----
function catalogIds(): string[] {
  try {
    const cat = JSON.parse(
      readFileSync(
        join(
          homedir(),
          "pens/olympus/products/tau/packages/catalog/src/models.json",
        ),
        "utf8",
      ),
    ) as Record<string, Record<string, unknown>>;
    const ids: string[] = [];
    for (const [prov, models] of Object.entries(cat)) {
      if (models && typeof models === "object")
        for (const mid of Object.keys(models)) ids.push(`${prov}/${mid}`);
    }
    return ids;
  } catch {
    return [];
  }
}

// ---- main ----
const probes = await Promise.all(surfaces().map(probe));
const catalog = catalogIds();

const usable = new Map<string, LiveModel & { surface: string }>();
const surfaceReport = probes.map(({ surface, models, error }) => {
  for (const m of models)
    usable.set(`${surface.name}/${m.id}`, { ...m, surface: surface.name });
  return {
    surface: surface.name,
    base: surface.base,
    count: models.length,
    error: error ?? null,
  };
});

// Usable surface set (surfaces with a live, non-empty contract)
const liveSurfaces = new Set(
  probes.filter((p) => p.models.length > 0).map((p) => p.surface.name),
);
// Everything in the catalog NOT on a live surface's roster is unusable.
const unusable = catalog.filter((id) => {
  const prov = id.split("/")[0];
  // Local/dynamic providers are not bundled at all — nothing to exclude.
  if (prov === "bornite" || prov === "rhodochrosite" || prov === "chalcopyrite")
    return false;
  if (!liveSurfaces.has(prov)) return true;
  return !usable.has(id);
});

// KDL emit: one rule per dead provider (glob all its models), plus per-model
// excludes for live providers whose individual ids are missing.
const byProvider = new Map<string, string[]>();
for (const id of unusable) {
  const [prov, ...rest] = id.split("/");
  if (!byProvider.has(prov)) byProvider.set(prov, []);
  byProvider.get(prov)!.push(rest.join("/"));
}
const kdlLines: string[] = [
  "// GENERATED by usable-models-audit.ts — models-only exclusions (providers stay enabled).",
  "// Contract: models without a live, probed provider surface are not routable.",
];
for (const [prov, mids] of [...byProvider].sort()) {
  if (!liveSurfaces.has(prov)) {
    kdlLines.push(`exclude-models provider="${prov}" glob="*"`);
  } else {
    for (const mid of mids.slice(0, 50))
      kdlLines.push(`exclude-models provider="${prov}" exact="${mid}"`);
    if (mids.length > 50)
      kdlLines.push(`exclude-models provider="${prov}" glob="*"`);
  }
}

// effort oddity: roles with dead suffixes
const effortRows = [...usable.entries()]
  .filter(([id]) => /freeinference|openrouter/.test(id))
  .map(([id, m]) => ({
    model: id,
    reasoning_effort: !!m.params?.includes("reasoning_effort"),
    max_reasoning: !!m.params?.some((p) => /reasoning|thinking/.test(p)),
    thinking: !!m.params?.includes("thinking"),
    tool_stream: !!m.params?.includes("tool_stream"),
  }));

const report = {
  at: new Date().toISOString(),
  surfaces: surfaceReport,
  usableCount: usable.size,
  catalogCount: catalog.length,
  unusableCount: unusable.length,
  effortRows,
};
writeFileSync("/tmp/kappa/usable-audit.json", JSON.stringify(report, null, 2));
writeFileSync("/tmp/kappa/exclude-models.kdl", kdlLines.join("\n") + "\n");
console.log(
  JSON.stringify(
    {
      surfaces: surfaceReport,
      usable: usable.size,
      catalog: catalog.length,
      unusable: unusable.length,
      kdlRules: kdlLines.length,
    },
    null,
    1,
  ),
);
