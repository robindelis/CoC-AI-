#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Starting PyTorch GPU AI Server on http://localhost:8000 ..."
"$ROOT_DIR/.venv/bin/python" "$ROOT_DIR/python/ai_server.py" &
AI_PID=$!

cleanup() {
  kill "$AI_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting Vite Web UI on http://localhost:5173 ..."
cd "$ROOT_DIR/web"
npm run dev
