#!/usr/bin/env bash
# kappa-race.sh — Autopoietic Multi-Routed Inference Router
# Replaces previous version. Safe for embedded shells.
set -euo pipefail

: "${FREEINFERENCE_API_KEY:?Set hyi- key}"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
BASE="https://freeinference.org"
TELEMETRY="https://openinfra.freeinference.org/api/dashboard"
OUT_DIR="/tmp/kappa-race"
STATE_FILE="/tmp/kappa-race-state.json"
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/*.json "$OUT_DIR"/*.txt 2>/dev/null || true

PROMPT="${1:-"ping"}"
MAX_TOKENS="${2:-50}"

echo "[*] Polling OpenInfra hardware state..."
curl -sS --max-time 5 --compressed -A "$UA" "$TELEMETRY" -o "$OUT_DIR/dash.json" 2>/dev/null || echo "{}" > "$OUT_DIR/dash.json"

RTX_TEMP=$(jq -r '.gpu[]? | select(.gpu_id=="rtx6000b:0") | .temperature_c // 0' "$OUT_DIR/dash.json" 2>/dev/null || echo "0")
H200_CACHE=$(jq -r '.sglang[]? | select(.server_id=="h200a-replica-a") | .cache_hit_rate // 0' "$OUT_DIR/dash.json" 2>/dev/null || echo "0")

echo "[!] rtx6000b Temp: ${RTX_TEMP}C | h200a Cache: ${H200_CACHE}"

# Dynamic Routing Matrix
MODELS=("glm-5.3-flash")

if awk -v t="$RTX_TEMP" 'BEGIN {exit !(t < 80.0)}'; then
  MODELS+=("qwen3.6-35b")
else
  echo "[!] THERMAL QUARANTINE: rtx6000b at ${RTX_TEMP}C. Dropping qwen3.6-35b."
fi

if awk -v c="$H200_CACHE" 'BEGIN {exit !(c > 0.5)}'; then
  MODELS+=("deepseek-v4-flash")
else
  echo "[!] CACHE COLLAPSE: h200a cache at ${H200_CACHE}. Dropping deepseek to avoid $0.10 prefill."
fi

if [ ${#MODELS[@]} -lt 2 ]; then
  MODELS+=("minimax-m3")
fi

echo "[*] Racing models: ${MODELS[*]}"

# Race Execution
PIDS=()
for MODEL in "${MODELS[@]}"; do
  (
    START=$(date +%s%3N)
    HTTP_CODE=$(curl -sS --max-time 20 --compressed -A "$UA" -X POST "${BASE}/v1/chat/completions" \
      -H "Authorization: Bearer ${FREEINFERENCE_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"model\":\"${MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"${PROMPT}\"}],\"max_tokens\":${MAX_TOKENS}}" \
      -o "$OUT_DIR/resp_${MODEL}.json" -w "%{http_code}" 2>/dev/null || echo "000")
    
    END=$(date +%s%3N)
    LATENCY=$((END - START))
    
    if [ "$HTTP_CODE" = "200" ]; then
      echo "$LATENCY" > "$OUT_DIR/lat_${MODEL}.txt"
    else
      echo "999999" > "$OUT_DIR/lat_${MODEL}.txt"
      echo "{\"error\":\"HTTP $HTTP_CODE\"}" > "$OUT_DIR/resp_${MODEL}.json"
    fi
  ) &
  PIDS+=($!)
done

for PID in "${PIDS[@]}"; do
  wait "$PID" 2>/dev/null || true
done

# Winner Selection
WINNER=""
BEST_LAT=999999
for MODEL in "${MODELS[@]}"; do
  if [ -f "$OUT_DIR/lat_${MODEL}.txt" ]; then
    LAT=$(cat "$OUT_DIR/lat_${MODEL}.txt")
    echo "    -> ${MODEL}: ${LAT}ms"
    if [ "$LAT" -lt "$BEST_LAT" ]; then
      BEST_LAT=$LAT
      WINNER="$MODEL"
    fi
  fi
done

if [ -z "$WINNER" ]; then
  echo "[X] RACE FAILED: All routes returned errors or timed out."
  exit 1
fi

echo "[+] WINNER: ${WINNER} (${BEST_LAT}ms)"

# State Update for Tau
ACTIVE_ROUTES=$(printf '"%s",' "${MODELS[@]}")
ACTIVE_ROUTES="[${ACTIVE_ROUTES%,}]"

cat > "$STATE_FILE" << JSONEOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "winner": "${WINNER}",
  "latency_ms": ${BEST_LAT},
  "telemetry": {
    "rtx6000b_temp": ${RTX_TEMP},
    "h200a_cache_hit": ${H200_CACHE}
  },
  "active_routes": ${ACTIVE_ROUTES}
}
JSONEOF

# Output result
jq -r '.choices[0].message.content // .error // "No content"' "$OUT_DIR/resp_${WINNER}.json" 2>/dev/null || cat "$OUT_DIR/resp_${WINNER}.json"
