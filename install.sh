#!/usr/bin/env bash
# Install claude-alert into a target project (project/folder level only).
# For macOS / Linux. Windows users: run install.ps1 instead (or this via Git Bash).
#
# Usage:
#   ./install.sh                 # install into the current directory
#   ./install.sh /path/to/proj   # install into another project
#
# Copies the alert script into <target>/.claude/ and adds a "Stop" hook to
# <target>/.claude/settings.json (merging if one already exists).

set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$PWD}"
TARGET="$(cd "$TARGET" && pwd)"

mkdir -p "$TARGET/.claude"
cp "$SRC_DIR/.claude/claude-alert.js" "$TARGET/.claude/claude-alert.js"

SETTINGS="$TARGET/.claude/settings.json"
NEW="$(cat "$SRC_DIR/.claude/settings.json")"

if [ -f "$SETTINGS" ] && command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  jq --argjson add "$NEW" '
    .hooks //= {} |
    .hooks.Stop = ((.hooks.Stop // []) + $add.hooks.Stop)
  ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  echo "OK Merged Stop hook into existing $SETTINGS"
elif [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.bak"
  cp "$SRC_DIR/.claude/settings.json" "$SETTINGS"
  echo "WARN jq not found - backed up old settings to $SETTINGS.bak and wrote a fresh one."
  echo "     If you had other hooks, merge them back from the .bak file."
else
  cp "$SRC_DIR/.claude/settings.json" "$SETTINGS"
  echo "OK Installed $SETTINGS"
fi

echo "OK Installed $TARGET/.claude/claude-alert.js"
echo
echo "Done. Restart Claude Code in $TARGET (or run /hooks) to load it."
