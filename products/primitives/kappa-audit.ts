#!/usr/bin/env bun
/**
 * kappa-audit.ts - Raw diagnostic for FreeInference & OpenInfra
 * Pure ASCII output. Zero truncation.
 */

const API_KEY = Bun.env.FREEINFERENCE_API_KEY;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

console.log("=== KAPPA AUDIT START ===");
console.log("[*] API KEY:", API_KEY ? "PRESENT" : "MISSING");
console.log("[*] User Agent:", UA);

async function auditTelemetry() {
  console.log("\n=== 1. TELEMETRY AUDIT ===");
  const url = "https://openinfra.freeinference.org/api/dashboard";
  console.log("[*] Fetching:", url);
  
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) });
    console.log("[+] Status:", res.status);
    console.log("[+] Headers:", JSON.stringify(Object.fromEntries(res.headers), null, 2));
    
    const text = await res.text();
    if (text.length > 0) {
      console.log("[+] Raw Body (first 500 chars):\n", text.slice(0, 500));
      // Attempt to parse to check shape
      try {
        const data = JSON.parse(text);
        console.log("[+] Parsed Keys:", Object.keys(data));
        console.log("[+] GPU length:", data.gpu?.length);
        console.log("[+] SGLang length:", data.sglang?.length);
      } catch (e) {
        console.log("[-] JSON Parse Error:", e);
      }
    } else {
      console.log("[-] Body is EMPTY");
    }
  } catch (err: any) {
    console.log("[X] TELEMETRY FETCH ERROR:");
    console.log(err.stack || err.message || err);
  }
}

async function auditInference() {
  console.log("\n=== 2. INFERENCE AUDIT ===");
  const url = "https://freeinference.org/v1/chat/completions";
  console.log("[*] Fetching:", url);
  
  const payload = {
    model: "glm-5.3-flash",
    messages: [{ role: "user", content: "Say exactly: Audit OK" }],
    max_tokens: 10
  };
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": UA
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });
    
    console.log("[+] Status:", res.status);
    console.log("[+] Headers:", JSON.stringify(Object.fromEntries(res.headers), null, 2));
    
    const text = await res.text();
    console.log("[+] Raw Body:\n", text);
    
  } catch (err: any) {
    console.log("[X] INFERENCE FETCH ERROR:");
    console.log(err.stack || err.message || err);
  }
}

async function main() {
  await auditTelemetry();
  await auditInference();
  console.log("\n=== KAPPA AUDIT END ===");
}

main();
