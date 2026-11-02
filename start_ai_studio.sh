#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export COC_AI_MANAGED=1
AI_PID=""
PID_FILE="$ROOT_DIR/.ai_server.pid"

if ss -tln 2>/dev/null | grep -qE ':8000\b'; then
  echo "PyTorch GPU AI Server already listening on http://localhost:8000"
else
  echo "Starting PyTorch GPU AI Server on http://localhost:8000 ..."
  "$ROOT_DIR/.venv/bin/python" "$ROOT_DIR/python/ai_server.py" &
  AI_PID=$!
  echo "$AI_PID" > "$PID_FILE"
fi

cleanup() {
  curl -s -X POST --max-time 2 http://127.0.0.1:8000/api/ai/train/stop >/dev/null 2>&1 || true
  if [[ -n "$AI_PID" ]] && kill -0 "$AI_PID" 2>/dev/null; then
    kill -TERM "$AI_PID" 2>/dev/null || true
    for _ in {1..15}; do
      if ! kill -0 "$AI_PID" 2>/dev/null; then
        break
      fi
      sleep 0.1
    done
    kill -9 "$AI_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" 2>/dev/null || true
}
trap cleanup EXIT INT TERM HUP

echo "Starting Vite Web UI on http://localhost:3000 ..."
cd "$ROOT_DIR/web"
npm run dev
