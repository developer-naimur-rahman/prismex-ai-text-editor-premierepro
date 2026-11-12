#!/usr/bin/env bash
set -e

# setup-daemon.sh - Configures macOS Launchd Agent for Prismex Companion Service
# Specification: docs/03-SYSTEM-ARCHITECTURE.md & docs/04-PREMIERE-PRO-INTEGRATION.md

PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/com.prismex.daemon.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PYTHON_BIN="$ROOT_DIR/venv/bin/python3"

echo "=== Prismex Companion Service Daemon Setup ==="

mkdir -p "$PLIST_DIR"

cat << EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.prismex.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON_BIN</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>daemon.prismex_core.server:app</string>
        <string>--host</string>
        <string>127.0.0.1</string>
        <string>--port</string>
        <string>49152</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$ROOT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/prismex-daemon.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/prismex-daemon-err.log</string>
</dict>
</plist>
EOF

chmod 644 "$PLIST_PATH"
echo "✓ Launchd agent installed: $PLIST_PATH"
echo "✓ To start immediately run: launchctl load -w $PLIST_PATH"
