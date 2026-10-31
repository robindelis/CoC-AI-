#!/usr/bin/env bash
# scripts/post_task_background.sh
# Asynchronous Background Post-Task Synchronization for CoC TH18 Simulator & Deep RL.
# Runs model-visualizer and vault-updater in the background so the user can continue prompting immediately.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/.logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/post_task_sync.log"

# Single-instance lock to prevent concurrent sync races
LOCK_FILE="/tmp/coc_post_task_sync.lock"
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] Another background sync is already in progress. Skipping." >> "$LOG_FILE"
    exit 0
fi

echo "================================================================================" >> "$LOG_FILE"
echo "🚀 [$(date -u +"%Y-%m-%d %H:%M:%SZ")] Starting Asynchronous Post-Task Background Sync" >> "$LOG_FILE"
echo "================================================================================" >> "$LOG_FILE"

# 1. Check if model or visualization files changed
MODEL_DIFF=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git status --porcelain)
if echo "$MODEL_DIFF" | grep -E -q "networks\.py|visualize\.py|visualize_model\.py|rl_labs|bootcamp"; then
    echo "🎨 Model/visualization changes detected. Running model-visualizer..." >> "$LOG_FILE"
    if command -v agy >/dev/null 2>&1; then
        agy --agent model-visualizer --model gemini-3.8-flash-medium --dangerously-skip-permissions -p "Reconcile model architecture visualizations and manifest with latest codebase" >> "$LOG_FILE" 2>&1 || {
            echo "⚠️  agy model-visualizer failed, falling back to direct CLI generation..." >> "$LOG_FILE"
            .venv/bin/python python/visualize_model.py --force >> "$LOG_FILE" 2>&1 || true
        }
    else
        .venv/bin/python python/visualize_model.py --force >> "$LOG_FILE" 2>&1 || true
    fi
else
    # Re-verify diagram freshness against networks.py hash
    PYTHONPATH=python .venv/bin/python -c "
from coc_rl.visualize import ensure_architecture_diagrams
res = ensure_architecture_diagrams()
if res.get('regenerated'):
    print('Regenerated stale model diagrams')
" >> "$LOG_FILE" 2>&1 || true
fi

# 2. Check if Obsidian vault drift is detected relative to codebase commits
if ! python3 scripts/vault_diff.py --status >/dev/null 2>&1; then
    echo "🏰 Code drift detected relative to Obsidian vault. Running vault-updater..." >> "$LOG_FILE"
    if command -v agy >/dev/null 2>&1; then
        agy --agent vault-updater --model gemini-3.8-flash-medium --dangerously-skip-permissions -p "Update the vault with the latest codebase changes" >> "$LOG_FILE" 2>&1 || {
            echo "⚠️  agy vault-updater failed, falling back to direct vault generator..." >> "$LOG_FILE"
            .venv/bin/python python/generate_vault.py >> "$LOG_FILE" 2>&1 || true
            python3 scripts/vault_diff.py --mark-synced >> "$LOG_FILE" 2>&1 || true
        }
    else
        .venv/bin/python python/generate_vault.py >> "$LOG_FILE" 2>&1 || true
        python3 scripts/vault_diff.py --mark-synced >> "$LOG_FILE" 2>&1 || true
    fi
else
    echo "✅ Obsidian vault is already synchronized with Git HEAD." >> "$LOG_FILE"
fi

# 3. Stage, commit, and push updated documentation and diagrams if any changed
CHANGED_DOCS=$(git status --porcelain obsidian_vault/ docs/architecture/ 2>/dev/null || true)
if [ -n "$CHANGED_DOCS" ]; then
    echo "📝 Committing updated vault and diagram artifacts..." >> "$LOG_FILE"
    git add obsidian_vault/ docs/architecture/ >> "$LOG_FILE" 2>&1
    git commit -m "docs(vault): auto-sync long-term memory & model visualization in background" >> "$LOG_FILE" 2>&1 || true
    git pull --rebase origin main >> "$LOG_FILE" 2>&1 || true
    git push origin main >> "$LOG_FILE" 2>&1 || true
    echo "✅ Background sync successfully committed and pushed to remote." >> "$LOG_FILE"
else
    echo "✅ No documentation or diagram changes needed." >> "$LOG_FILE"
fi

echo "🏁 [$(date -u +"%Y-%m-%d %H:%M:%SZ")] Background sync completed successfully." >> "$LOG_FILE"
