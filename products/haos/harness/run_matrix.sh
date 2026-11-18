#!/usr/bin/env bash
# run_matrix.sh — parallel orchestrator for the chaos strategy matrix.
#
# Reads chaos/strategy_matrix.json, launches every arm with its declared
# concurrency, keeps per-arm stdout/stderr separated under
# $CHAOS_LOG_DIR, and finishes with the recovery feedback loop.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/helpers/portable_tmp.sh"

cd "$ROOT" || exit 1

LOG_DIR="$CHAOS_LOG_DIR"
mkdir -p "$LOG_DIR"
MATRIX="chaos/strategy_matrix.json"

echo "[matrix] workspace=$LOCAL_WORKSPACE"
echo "[matrix] matrix=$MATRIX"

# Parse arms without a JSON dependency: use python3 (stdlib json) as the reader.
read_arms() {
  python3 - "$MATRIX" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
for a in m["parallel_arms"]:
    print("\t".join([
        a["id"], a["script"], a["type"],
        str(a["concurrency"]), str(a.get("barrier_sync", False)).lower(),
        str(a.get("loop_iterations", 1)),
    ]))
PY
}

launch_arm() {
  local id="$1" script="$2" type="$3" conc="$4" barrier="$5" iters="$6"
  local pids=() i rc

  echo "[arm] $id script=$script concurrency=$conc barrier=$barrier iters=$iters"

  for ((i = 1; i <= conc; i++)); do
    local out="$LOG_DIR/${id}.${i}.out"
    local err="$LOG_DIR/${id}.${i}.err"
    case "$type" in
      python)
        if [ "$barrier" = "true" ]; then
          python3 "$script" 127.0.0.1 0 "$iters" >"$out" 2>"$err" &
        else
          python3 "$script" >"$out" 2>"$err" &
        fi
        ;;
      shell)
        bash "$script" >"$out" 2>"$err" &
        ;;
    esac
    pids+=("$!")
  done

  rc=0
  for p in "${pids[@]}"; do
    wait "$p" || rc=1
  done
  echo "[arm] $id finished rc=$rc"
  return 0
}

while IFS=$'\t' read -r id script type conc barrier iters; do
  [ -z "${id:-}" ] && continue
  launch_arm "$id" "$script" "$type" "$conc" "$barrier" "$iters"
done < <(read_arms)

echo "[matrix] all arms complete — running recovery feedback loop"
bash "$SCRIPT_DIR/error_recovery.sh"

SUMMARY="$LOG_DIR/matrix_summary.txt"
{
  echo "matrix run: $(date -Is)"
  echo "workspace:  $LOCAL_WORKSPACE"
  echo "arms:"
  while IFS=$'\t' read -r id script type conc barrier iters; do
    [ -z "${id:-}" ] && continue
    lines="$(cat "$LOG_DIR/${id}".*.out 2>/dev/null | wc -l)"
    errs="$(cat "$LOG_DIR/${id}".*.err 2>/dev/null | wc -l)"
    printf '  %-18s out_lines=%-6s err_lines=%s\n' "$id" "$lines" "$errs"
  done < <(read_arms)
} > "$SUMMARY"

cat "$SUMMARY"
echo "[matrix] summary: $SUMMARY"
