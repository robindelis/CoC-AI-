#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export COC_AI_MANAGED=1
AI_PID=""

if ss -tln 2>/dev/null | grep -qE ':8000\b'; then
  echo "PyTorch GPU AI Server already listening on http://localhost:8000"
else
  echo "Starting PyTorch GPU AI Server on http://localhost:8000 ..."
  "$ROOT_DIR/.venv/bin/python" "$ROOT_DIR/python/ai_server.py" &
  AI_PID=$!
fi

cleanup() {
  if [[ -n "$AI_PID" ]]; then
    kill "$AI_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting Vite Web UI on http://localhost:3000 ..."
cd "$ROOT_DIR/web"
npm run dev
