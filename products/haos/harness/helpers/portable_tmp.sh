#!/usr/bin/env bash
# portable_tmp.sh — isolated workspace helper that ignores the
# workspace file-limit death spiral. All writes go under LOCAL_WORKSPACE
# in /tmp; nothing touches the Pens or global paths.
set -euo pipefail

export LOCAL_WORKSPACE="${LOCAL_WORKSPACE:-/tmp/chaos_ws_$(date +%s)}"
export TMPDIR="${LOCAL_WORKSPACE}/tmp"
export CHAOS_LOG_DIR="${LOCAL_WORKSPACE}/chaos/logs"
export CHAOS_LIB_DIR="${LOCAL_WORKSPACE}/libs"

mkdir -p "$LOCAL_WORKSPACE" "$TMPDIR" "$CHAOS_LOG_DIR" "$CHAOS_LIB_DIR"

# Stale-file sweep inside our own namespace only.
find "$TMPDIR" -type f -mtime +1 -delete 2>/dev/null || true

echo "[portable_tmp] LOCAL_WORKSPACE=$LOCAL_WORKSPACE"
echo "[portable_tmp] TMPDIR=$TMPDIR"
echo "[portable_tmp] CHAOS_LOG_DIR=$CHAOS_LOG_DIR"
echo "[portable_tmp] CHAOS_LIB_DIR=$CHAOS_LIB_DIR"