#!/usr/bin/env python3
"""
scripts/vault_diff.py — Incremental Git-Commit Diff & Sync Tool for CoC Obsidian Vault.

Enables the `vault-updater` agent to inspect only the incremental changes made across
git commits since the last vault synchronization, avoiding full-codebase reads.

Usage:
  python3 scripts/vault_diff.py                 # Inspect incremental diffs since last sync
  python3 scripts/vault_diff.py --summary       # Inspect commit logs & changed files summary only
  python3 scripts/vault_diff.py --diff-only     # Output raw unified diff for changed code paths
  python3 scripts/vault_diff.py --mark-synced   # Mark current HEAD as synced in .sync_state.json & 00_Index_MOC.md
  python3 scripts/vault_diff.py --status        # Show current sync status
  python3 scripts/vault_diff.py --json          # Output results as machine-readable JSON
"""

import argparse
from datetime import datetime, timezone
import json
import os
import re
import subprocess
import sys
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VAULT_DIR = os.path.join(REPO_ROOT, "obsidian_vault")
STATE_FILE = os.path.join(VAULT_DIR, ".sync_state.json")
MOC_FILE = os.path.join(VAULT_DIR, "00_Index_MOC.md")

# Path prefixes relevant to Obsidian architectural documentation
RELEVANT_CODE_PATHS = [
    "crates/coc-engine",
    "crates/coc-data",
    "crates/coc-py",
    "crates/coc-wasm",
    "python/coc_rl",
    "python/train_ai.py",
    "python/ai_server.py",
    "python/generate_vault.py",
    "scripts",
    "web/src",
]

# Patterns to ignore when computing code diffs
IGNORED_PATTERNS = [
    "obsidian_vault/",
    "docs/architecture/",
    "node_modules/",
    "target/",
    ".venv/",
    "__pycache__/",
    "wasm-pkg/",
    ".lock",
    ".png",
    ".svg",
    ".pt",
    ".bin",
    ".apk",
]

# High-impact architectural symbols to alert on
WATCHED_SYMBOLS = {
    "extract_spatial_observation": "Spatial observation extraction / channel definitions",
    "extract_army_context": "64-D Live army context encoding",
    "write_spatial_observation": "In-place zero-copy spatial tensor extraction",
    "write_army_context": "In-place zero-copy army context extraction",
    "CoCActorCritic": "Actor-Critic neural network architecture / action heads",
    "CoCSpatialEncoder": "Spatial CNN / Dilated ResNet feature extractor",
    "DilatedResBlock": "Dilated residual blocks for receptive field expansion",
    "PyVecBattleEnv": "Rayon-parallelized vectorized environment bindings",
    "PyBattleEnv": "PyO3 battle environment bridge",
    "TacticalEnvState": "Rust-native tactical action mask & ring precomputation",
    "compute_gae": "Generalized Advantage Estimation (GAE) calculation",
    "CoCTrainer": "PPO training loop and hyperparameter updates",
    "TOTAL_CHANNELS": "Spatial observation channel count constant",
}


def run_git(args: List[str]) -> Tuple[int, str, str]:
    """Execute a git command within the repository root."""
    res = subprocess.run(
        ["git"] + args,
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return res.returncode, res.stdout.strip(), res.stderr.strip()


def get_current_branch() -> str:
    _, out, _ = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    return out or "main"


def get_commit_details(commit_ref: str = "HEAD") -> Dict[str, str]:
    """Extract full SHA, short SHA, timestamp, and subject for a given commit ref."""
    code, out, _ = run_git(["log", "-n", "1", "--format=%H|%h|%cI|%s", commit_ref])
    if code != 0 or not out:
        return {
            "commit": "unknown",
            "short_commit": "unknown",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "subject": "Unknown commit",
            "branch": get_current_branch(),
        }
    parts = out.split("|", 3)
    return {
        "commit": parts[0],
        "short_commit": parts[1],
        "timestamp": parts[2],
        "subject": parts[3] if len(parts) > 3 else "",
        "branch": get_current_branch(),
    }


def load_sync_state() -> Dict[str, Any]:
    """
    Load the persistent sync state from `obsidian_vault/.sync_state.json`.
    If file is absent, discovers the latest commit that touched `obsidian_vault/`
    and initializes the state file.
    """
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("last_synced_commit"):
                    return data
        except Exception:
            pass

    # Discover the latest commit that touched obsidian_vault
    code, out, _ = run_git(["log", "-n", "1", "--format=%H|%h|%cI|%s", "--", "obsidian_vault"])
    if code == 0 and out:
        parts = out.split("|", 3)
        state = {
            "last_synced_commit": parts[0],
            "last_synced_commit_short": parts[1],
            "last_synced_at": parts[2],
            "last_synced_subject": parts[3] if len(parts) > 3 else "",
            "branch": get_current_branch(),
        }
    else:
        # Fallback to current HEAD
        head_info = get_commit_details("HEAD")
        state = {
            "last_synced_commit": head_info["commit"],
            "last_synced_commit_short": head_info["short_commit"],
            "last_synced_at": head_info["timestamp"],
            "last_synced_subject": head_info["subject"],
            "branch": head_info["branch"],
        }

    save_sync_state_file(state)
    return state


def save_sync_state_file(state: Dict[str, Any]) -> None:
    """Save the sync state dictionary to .sync_state.json."""
    os.makedirs(VAULT_DIR, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
        f.write("\n")


def update_moc_sync_banner(state: Dict[str, Any]) -> None:
    """
    Refreshes the sync status metadata and banner callout in `00_Index_MOC.md`.
    Preserves all user-written content outside the sync callout block.
    """
    if not os.path.exists(MOC_FILE):
        return

    with open(MOC_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    short_sha = state.get("last_synced_commit_short", "")
    full_sha = state.get("last_synced_commit", "")
    subject = state.get("last_synced_subject", "")
    synced_at = state.get("last_synced_at", "")[:19].replace("T", " ")

    # Update or insert frontmatter keys
    frontmatter_pattern = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
    fm_match = frontmatter_pattern.search(content)
    if fm_match:
        fm = fm_match.group(1)
        if "last_synced_commit:" in fm:
            fm = re.sub(r"last_synced_commit:.*", f'last_synced_commit: "{short_sha}"', fm)
        else:
            fm += f'\nlast_synced_commit: "{short_sha}"'
        if "last_synced_at:" in fm:
            fm = re.sub(r"last_synced_at:.*", f'last_synced_at: "{synced_at}"', fm)
        else:
            fm += f'\nlast_synced_at: "{synced_at}"'
        content = frontmatter_pattern.sub(f"---\n{fm}\n---", content, count=1)

    # Update or insert callout block
    callout_block = (
        f"> [!NOTE] 🔄 Codebase Synchronization Status\n"
        f"> **Synchronized Commit**: [`{short_sha}`](file://{REPO_ROOT}) &mdash; *{subject}*\n"
        f"> **Synced At**: `{synced_at} UTC` • **Full SHA**: `{full_sha}`\n"
    )

    callout_pattern = re.compile(
        r"> \[!NOTE\] 🔄 Codebase Synchronization Status\n> \*\*Synchronized Commit\*\*:[^\n]*\n> \*\*Synced At\*\*:[^\n]*\n?"
    )
    if callout_pattern.search(content):
        content = callout_pattern.sub(callout_block, content, count=1)
    else:
        # Insert below the main H1 header
        h1_match = re.search(r"(# 🏰 [^\n]+\n+)", content)
        if h1_match:
            insert_pos = h1_match.end()
            content = content[:insert_pos] + callout_block + "\n" + content[insert_pos:]

    with open(MOC_FILE, "w", encoding="utf-8") as f:
        f.write(content)


def mark_commit_synced(commit_ref: str = "HEAD") -> Dict[str, Any]:
    """
    Mark a specific commit as the latest synced commit in both
    `obsidian_vault/.sync_state.json` and `00_Index_MOC.md`.
    """
    details = get_commit_details(commit_ref)
    state = {
        "last_synced_commit": details["commit"],
        "last_synced_commit_short": details["short_commit"],
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
        "last_synced_subject": details["subject"],
        "branch": details["branch"],
    }
    save_sync_state_file(state)
    update_moc_sync_banner(state)
    return state


def filter_relevant_files(file_list: List[str]) -> List[str]:
    """Filter files that are relevant to codebase architecture and documentation."""
    filtered = []
    for f in file_list:
        f_clean = f.strip()
        if not f_clean:
            continue
        # Exclude ignored patterns
        if any(ignored in f_clean for ignored in IGNORED_PATTERNS):
            continue
        # Include if starts with any relevant code path
        if any(f_clean.startswith(prefix) for prefix in RELEVANT_CODE_PATHS):
            filtered.append(f_clean)
    return filtered


def categorize_file(path: str) -> str:
    """Categorize modified source files into domain sections."""
    if path.startswith("crates/coc-engine") or path.startswith("crates/coc-data"):
        return "Simulation Core & Observation Channels"
    elif path.startswith("crates/coc-py") or path.startswith("python/coc_rl") or path.startswith("python/train_ai") or path.startswith("python/ai_server"):
        return "Python Deep RL & PyO3 Bindings"
    elif path.startswith("crates/coc-wasm") or path.startswith("web/"):
        return "Web Sandbox & Visualizer"
    elif path.startswith("scripts/"):
        return "Development & Audit Tooling"
    return "Other Source Files"


def analyze_codebase_drift(
    last_commit: str,
    target_ref: str = "HEAD",
    max_diff_lines: int = 400,
) -> Dict[str, Any]:
    """
    Analyzes code drift between `last_commit` and `target_ref`, including working tree changes.
    Returns commit history, changed files, detected high-impact symbols, and targeted unified diff.
    """
    head_details = get_commit_details(target_ref)
    target_sha = head_details["commit"]

    # 1. Check commits in range
    commits_list: List[Dict[str, str]] = []
    if last_commit != target_sha:
        code, out, _ = run_git(["log", "--reverse", "--format=%H|%h|%cI|%an|%s", f"{last_commit}..{target_ref}"])
        if code == 0 and out:
            for line in out.splitlines():
                if line.strip():
                    parts = line.split("|", 4)
                    commits_list.append({
                        "commit": parts[0],
                        "short": parts[1],
                        "date": parts[2],
                        "author": parts[3],
                        "subject": parts[4] if len(parts) > 4 else "",
                    })

    # 2. Check working tree changes
    _, status_out, _ = run_git(["status", "--porcelain"])
    uncommitted_files = []
    if status_out:
        for line in status_out.splitlines():
            if len(line) >= 4:
                uncommitted_files.append(line[3:].strip())
    relevant_uncommitted = filter_relevant_files(uncommitted_files)

    # 3. Check diff of relevant files from last_commit to working tree
    code, diff_files_out, _ = run_git(["diff", "--name-only", last_commit])
    all_changed_files = diff_files_out.splitlines() if (code == 0 and diff_files_out) else []
    relevant_files = filter_relevant_files(all_changed_files)

    # Combine unique relevant files
    combined_files = sorted(list(set(relevant_files + relevant_uncommitted)))

    # Only treat as drift if actual relevant code files were modified
    has_drift = len(combined_files) > 0

    # Categorize files
    categorized: Dict[str, List[str]] = {}
    for f in combined_files:
        cat = categorize_file(f)
        categorized.setdefault(cat, []).append(f)

    # 4. Generate diff stat for relevant files
    diff_stat_text = ""
    if combined_files:
        _, diff_stat_text, _ = run_git(["diff", "--stat", last_commit, "--"] + combined_files)

    # 5. Extract unified diff for relevant files
    unified_diff_text = ""
    detected_symbols: List[Dict[str, str]] = []
    if combined_files:
        _, raw_diff, _ = run_git(["diff", "-U4", last_commit, "--"] + combined_files)
        unified_diff_text = raw_diff

        # Scan diff for watched architectural symbols
        for sym, desc in WATCHED_SYMBOLS.items():
            if sym in raw_diff:
                detected_symbols.append({"symbol": sym, "description": desc})

    # Limit diff text if requested
    truncated_diff = unified_diff_text
    diff_lines = unified_diff_text.splitlines()
    if max_diff_lines > 0 and len(diff_lines) > max_diff_lines:
        truncated_diff = (
            "\n".join(diff_lines[:max_diff_lines])
            + f"\n\n... [Diff truncated: {len(diff_lines) - max_diff_lines} more lines. Use --diff-only for full diff] ..."
        )

    return {
        "has_drift": has_drift,
        "last_commit": last_commit,
        "target_commit": target_sha,
        "commits_ahead_count": len(commits_list),
        "commits": commits_list,
        "changed_files_count": len(combined_files),
        "changed_files": combined_files,
        "categorized_files": categorized,
        "has_uncommitted_changes": len(relevant_uncommitted) > 0,
        "uncommitted_files": relevant_uncommitted,
        "diff_stat": diff_stat_text,
        "detected_symbols": detected_symbols,
        "unified_diff": truncated_diff,
        "full_diff_line_count": len(diff_lines),
    }


def print_formatted_report(analysis: Dict[str, Any], summary_only: bool = False) -> None:
    """Print an aesthetic, high-density terminal report."""
    state = load_sync_state()
    last_short = state.get("last_synced_commit_short", "unknown")
    last_subj = state.get("last_synced_subject", "")
    last_date = state.get("last_synced_at", "")[:19].replace("T", " ")

    print("=" * 80)
    print("🏰 CoC OBSIDIAN VAULT — INCREMENTAL CODEBASE SYNC DETECTOR")
    print("=" * 80)
    print(f"📌 Last Synced Commit : {last_short} ({last_date})")
    print(f"   Subject            : {last_subj}")
    print(f"🎯 Target Git HEAD    : {analysis['target_commit'][:7]}")

    if not analysis["has_drift"]:
        print("\n✅ STATUS: Obsidian Vault is FULLY UP-TO-DATE with codebase!")
        print("   No commits or working tree modifications detected since last sync.")
        print("   -> vault-updater does NOT need to process any source files.")
        print("=" * 80)
        return

    print(f"\n⚠️  STATUS: CODEBASE DRIFT DETECTED ({analysis['commits_ahead_count']} new commits, {analysis['changed_files_count']} relevant files)")

    # 1. Commits list
    if analysis["commits"]:
        print("\n📜 COMMITS TO RECONCILE INTO OBSIDIAN VAULT:")
        for c in analysis["commits"]:
            print(f"   * [{c['short']}] {c['date'][:10]} ({c['author']}): {c['subject']}")

    if analysis["has_uncommitted_changes"]:
        print(f"\n⚠️  UNCOMMITTED CHANGES IN WORKING TREE ({len(analysis['uncommitted_files'])} files):")
        for u in analysis["uncommitted_files"]:
            print(f"   - {u}")

    # 2. Categorized files
    print("\n📁 CHANGED FILES BY DOMAIN:")
    for cat, files in analysis["categorized_files"].items():
        print(f"   📂 {cat} ({len(files)} files):")
        for f in files:
            print(f"      - {f}")

    # 3. High-Impact Architectural Symbols
    if analysis["detected_symbols"]:
        print("\n🚨 DETECTED HIGH-IMPACT ARCHITECTURAL SYMBOLS MODIFIED:")
        for sym_info in analysis["detected_symbols"]:
            print(f"   ⚡ `{sym_info['symbol']}` : {sym_info['description']}")
        print("   👉 Check ADRs in `obsidian_vault/decisions/` and specs in `obsidian_vault/encodings/`!")

    # 4. Diff stat
    if analysis["diff_stat"]:
        print("\n📊 DIFF STATS:")
        for line in analysis["diff_stat"].splitlines():
            print(f"   {line}")

    # 5. Targeted Unified Diff
    if not summary_only and analysis["unified_diff"]:
        print("\n" + "=" * 80)
        print("📝 RELEVANT CODE DIFF (Read ONLY these modified code lines):")
        print("=" * 80)
        print(analysis["unified_diff"])
        print("=" * 80)

    print("\n💡 NEXT STEPS FOR `vault-updater`:")
    print("   1. Review ONLY the modified code diff above (no need to open whole source files).")
    print("   2. Update relevant ADRs in `obsidian_vault/decisions/` or specs in `obsidian_vault/encodings/`.")
    print("   3. Run `.venv/bin/python python/generate_vault.py` to refresh canvas and MOC.")
    print("   4. Run `python3 scripts/vault_diff.py --mark-synced` to update sync state.")
    print("   5. Commit & push vault changes.")
    print("=" * 80)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inspect incremental git commit diffs since last Obsidian vault synchronization."
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print commit list, categorized file stats, and high-impact symbols without code diff",
    )
    parser.add_argument(
        "--diff-only",
        action="store_true",
        help="Output raw unified diff only",
    )
    parser.add_argument(
        "--mark-synced",
        nargs="?",
        const="HEAD",
        metavar="COMMIT",
        help="Mark specified commit (default: HEAD) as synced in .sync_state.json and 00_Index_MOC.md",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Print current synchronization status and exit",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output analysis in machine-readable JSON format",
    )
    parser.add_argument(
        "--max-diff-lines",
        type=int,
        default=400,
        help="Maximum diff lines to display before truncating (0 for unlimited, default 400)",
    )
    args = parser.parse_args()

    # Handle --mark-synced
    if args.mark_synced:
        state = mark_commit_synced(args.mark_synced)
        print(f"✅ Marked commit {state['last_synced_commit_short']} (\"{state['last_synced_subject']}\") as synced.")
        print(f"   State updated in: {STATE_FILE}")
        print(f"   MOC updated in  : {MOC_FILE}")
        sys.exit(0)

    # Load current state
    state = load_sync_state()
    last_commit = state["last_synced_commit"]

    # Handle --status
    if args.status:
        head_info = get_commit_details("HEAD")
        is_synced = (last_commit == head_info["commit"])
        print(f"Last Synced Commit : {state.get('last_synced_commit_short', 'unknown')} ({state.get('last_synced_at', '')})")
        print(f"Current Git HEAD   : {head_info['short_commit']} ({head_info['subject']})")
        print(f"Status             : {'SYNCHRONIZED' if is_synced else 'AHEAD (Drift detected)'}")
        sys.exit(0 if is_synced else 1)

    # Analyze drift
    analysis = analyze_codebase_drift(
        last_commit=last_commit,
        target_ref="HEAD",
        max_diff_lines=0 if args.diff_only else args.max_diff_lines,
    )

    if args.json:
        # Exclude giant diff text in basic JSON summary if requested
        print(json.dumps(analysis, indent=2))
        sys.exit(0)

    if args.diff_only:
        if analysis["unified_diff"]:
            print(analysis["unified_diff"])
        else:
            print("# No relevant code diff detected.")
        sys.exit(0)

    print_formatted_report(analysis, summary_only=args.summary)
    sys.exit(0)


if __name__ == "__main__":
    main()
