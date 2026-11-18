#!/usr/bin/env bun
/**
 * kappa-race.ts — Autopoietic Multi-Routed Inference Router
 * Runtime: Bun
 * Role: Kappa primitive exposed to Tau
 */

const API_KEY = Bun.env.FREEINFERENCE_API_KEY;
if (!API_KEY) {
  console.error("[X] ERROR: FREEINFERENCE_API_KEY not set.");
  process.exit(1);
}

const BASE = "https://freeinference.org";
const TELEMETRY_URL = "https://openinfra.freeinference.org/api/dashboard";
const STATE_FILE = "/tmp/kappa-race-state.json";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const prompt = process.argv[2] || "ping";
const maxTokens = parseInt(process.argv[3] || "50", 10);

interface Telemetry {
  rtxTemp: number;
  h200Cache: number;
}

interface RaceResult {
  model: string;
  latencyMs: number;
  content: string;
  success: boolean;
}

async function fetchTelemetry(): Promise<Telemetry> {
  console.log("[*] Polling OpenInfra hardware state...");
  try {
    const res = await fetch(TELEMETRY_URL, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    
    const rtxGpu = data.gpu?.find((g: any) => g.gpu_id === "rtx6000b:0");
    const h200Srv = data.sglang?.find((s: any) => s.server_id === "h200a-replica-a");
    
    return {
      rtxTemp: rtxGpu?.temperature_c ?? 0,
      h200Cache: h200Srv?.cache_hit_rate ?? 0,
    };
  } catch (err) {
    console.error(`[!] Telemetry fetch failed: ${err}`);
    return { rtxTemp: 0, h200Cache: 0 };
  }
}

function buildRoutes(telemetry: Telemetry): string[] {
  const routes = ["glm-5.3-flash"];
  
  if (telemetry.rtxTemp < 80.0) {
    routes.push("qwen3.6-35b");
  } else {
    console.log(`[!] THERMAL QUARANTINE: rtx6000b at ${telemetry.rtxTemp}C. Dropping qwen3.6-35b.`);
  }
  
  if (telemetry.h200Cache > 0.5) {
    routes.push("deepseek-v4-flash");
  } else {
    console.log(`[!] CACHE COLLAPSE: h200a cache at ${telemetry.h200Cache}. Dropping deepseek to avoid $0.10 prefill.`);
  }
  
  if (routes.length < 2) {
    routes.push("minimax-m3");
  }
  
  return routes;
}

async function requestModel(model: string): Promise<RaceResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const latencyMs = Math.round(performance.now() - start);
    const data = await res.json();

    if (!res.ok) {
      return { model, latencyMs: 999999, content: JSON.stringify(data.error || "HTTP Error"), success: false };
    }

    return {
      model,
      latencyMs,
      content: data.choices?.[0]?.message?.content || "",
      success: true,
    };
  } catch (err: any) {
    return { model, latencyMs: 999999, content: err.message, success: false };
  }
}

async function main() {
  const telemetry = await fetchTelemetry();
  console.log(`[!] rtx6000b Temp: ${telemetry.rtxTemp}C | h200a Cache: ${telemetry.h200Cache}`);
  
  const routes = buildRoutes(telemetry);
  console.log(`[*] Racing models: ${routes.join(" ")}`);

  // Race natively using Promise.any, but we need to log all latencies.
  // So we use Promise.all to wait for all (they run concurrently).
  const results = await Promise.all(routes.map(requestModel));
  
  let winner: RaceResult | null = null;
  
  for (const res of results) {
    console.log(`    -> ${res.model}: ${res.latencyMs}ms ${res.success ? "✓" : "✗"}`);
    if (res.success && (!winner || res.latencyMs < winner.latencyMs)) {
      winner = res;
    }
  }

  if (!winner) {
    console.error("[X] RACE FAILED: All routes returned errors or timed out.");
    process.exit(1);
  }

  console.log(`[+] WINNER: ${winner.model} (${winner.latencyMs}ms)`);

  // Update state for Tau to ingest
  const state = {
    timestamp: new Date().toISOString(),
    winner: winner.model,
    latency_ms: winner.latencyMs,
    telemetry: {
      rtx6000b_temp: telemetry.rtxTemp,
      h200a_cache_hit: telemetry.h200Cache,
    },
    active_routes: routes,
  };

  await Bun.write(STATE_FILE, JSON.stringify(state, null, 2));

  // Output final content to stdout for Tau
  console.log(winner.content);
}

main().catch(console.error);
