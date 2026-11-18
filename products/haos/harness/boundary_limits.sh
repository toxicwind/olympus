#!/usr/bin/env bash
# boundary_limits.sh — shell wrapper that sources the portable tmp helper
# and delegates the real probing to boundary_limits.py (select FD_SETSIZE,
# RLIMIT_NOFILE/EMFILE, EAGAIN backlog, port 0, listen backlog).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/helpers/portable_tmp.sh"

echo "[boundary] RLIMIT_NOFILE soft=$(ulimit -n) hard=$(ulimit -Hn)"

python3 "$SCRIPT_DIR/boundary_limits.py" 2>&1 | tee "$CHAOS_LOG_DIR/boundary.log"

echo "[boundary] done"
