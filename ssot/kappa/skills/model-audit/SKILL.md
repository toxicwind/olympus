---
name: model-audit
description: Probe-driven audit of the estate's model lanes and tau session telemetry — live-probe every provider surface (names drift, resolve via the estate ports SSOT), race models for real latency/quality, and dataframe-audit tau's agent.db. Use when picking models, diagnosing 429/401 storms, or auditing what models actually honor (reasoning_effort, max_reasoning, thinking).
---

# model-audit — probe-driven model/lane audit

Scripts (bun):

- `scripts/usable-models-audit.ts` — probes every live lane (rhodochrosite
  router with JWT, bornite local, chalcopyrite guard with keyring client key,
  freeinference, openrouter), diffs vs tau's bundled 5650-model catalog, emits
  KDL `exclude-models` (models-only — never disable providers) to
  `/tmp/kappa/exclude-models.kdl` + full report JSON.
- `scripts/tau-session-audit.ts [session-dir...]` — dataframe audit of tau
  sessions: model distribution, 429 taxonomy (insufficient-balance,
  concurrency-limit, free-per-min, guardrail), flail loops, tool fails.

## Probed truths (2026-10-26)

- **secretsmith env emits `KEY='value'` shell exports** — any consumer that
  doesn't strip the matching quote pair sends `Bearer sk-...'` → 401 "Missing
  Authentication header" (keypool mass-down, fixed via parseEnvLine).
- **openrouter `/api/v1/key` is a probe trap** (401 on ANY Bearer key); the
  real key-validation endpoint is **`/api/v1/auth/key`**.
- **429 taxonomy**: `insufficient balance (type=1113)` = terminal, never
  retry; `concurrency_limit_exceeded (limit:2)` = freeinference global lane;
  `free-models-per-min` = openrouter free tier per-minute window.
- **Guardrail blocks = HTTP 404** with `metadata.failed_routing_step` +
  `ineligibility_reasons[]` — blocked ids: meta/muse-spark-1.3-contributor,
  meta/muse-spark-1.2-contributor, liquid/lfm-2.5-2.6b,
  sakana/sakana-namazu (657 eligible vs 463 public as of 22:15Z).
- **NVIDIA NIM**: fastest stable lane (nemotron-3.5-lightning 333ms,
  super-vl 353ms, super-120b 90t/s); retired ids 410; never probe with an
  empty Authorization header.
- **qwen3.6-35b ignores reasoning_effort** (catalog lie #2); glm-5.3-flash
  always-thinks and barely scales; deepseek-v4-flash honors effort 4-6×.
