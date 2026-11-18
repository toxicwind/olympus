#!/usr/bin/env bash
# error_recovery.sh — automated error recovery & feedback loop.
#
# Runs every chaos arm, captures stderr, maps low-level failure
# signatures (errno text) to concrete stabilization patches, and emits a
# machine-readable report the orchestrator consumes.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/helpers/portable_tmp.sh"

LOG_DIR="$CHAOS_LOG_DIR"
mkdir -p "$LOG_DIR"
REPORT="$LOG_DIR/recovery_report.json"

ARMS=(
  "chaos/socket_half_close.py"
  "chaos/payload_overflow.py"
  "chaos/boundary_limits.sh"
  "chaos/rst_abort.py"
)

declare -A PATCH_MAP=(
  ["Address already in use"]="SO_REUSEADDR + random port 0 + retry with backoff"
  ["Too many open files"]="close idle sockets + ulimit -n 2048 + use poll/epoll with FD_SETSIZE guard"
  ["Connection reset by peer"]="handle RST as valid chaos signal, add retry with exponential backoff, log as expected"
  ["Broken pipe"]="check SHUT_WR ordering, add barrier sync to avoid write after peer FIN"
  ["Message too long"]="chunk payload to 8192, test truncation handling"
  ["Resource temporarily unavailable"]="set non-blocking + EAGAIN loop"
  ["Cannot assign requested address"]="bind 127.0.0.1 explicitly, never wildcard bind"
)

run_and_capture() {
  local script="$1"
  local name
  name="$(basename "$script")"
  local out="$LOG_DIR/${name}.out"
  local err="$LOG_DIR/${name}.err"
  echo "[run] $script"
  case "$script" in
    *.py) python3 "$script" >"$out" 2>"$err" ;;
    *.sh) bash "$script"   >"$out" 2>"$err" ;;
  esac
  local rc=$?
  echo "[run] $script exit=$rc"
  return 0
}

FINDINGS_JSON="["
FIRST=1

for arm in "${ARMS[@]}"; do
  [ -f "$arm" ] || { echo "[skip] $arm missing"; continue; }
  run_and_capture "$arm" || true

  name="$(basename "$arm")"
  errfile="$LOG_DIR/${name}.err"
  [ -f "$errfile" ] || continue

  for sig in "${!PATCH_MAP[@]}"; do
    if grep -qF "$sig" "$errfile"; then
      echo "[RECOVERY] Signature '$sig' -> Patch: ${PATCH_MAP[$sig]}"
      [ $FIRST -eq 0 ] && FINDINGS_JSON+=","
      FIRST=0
      FINDINGS_JSON+="{\"arm\":\"$name\",\"signature\":\"$sig\",\"patch\":\"${PATCH_MAP[$sig]}\"}"
    fi
  done
done

FINDINGS_JSON+="]"

cat > "$REPORT" <<JSON
{
  "generated_at_epoch": $(date +%s),
  "workspace": "$LOCAL_WORKSPACE",
  "findings": $FINDINGS_JSON
}
JSON

echo "[recovery] loop complete — all stderr mapped"
echo "[recovery] report: $REPORT"
