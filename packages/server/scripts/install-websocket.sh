#!/bin/bash
# Script to install WebSocket dependencies for real-time progress monitoring

# Change to the server package directory
cd "$(dirname "$0")/.." || exit

echo "Setting up WebSocket dependencies for real-time progress monitoring (for local dev reference)..."

# NOTE: The 'ws' and '@types/ws' dependencies are now managed in packages/server/package.json.
# They are installed via 'yarn install' during Docker builds or local setup.
# This script is kept for historical reference only.
# Original command (using npm, inconsistent with project's use of yarn):
# npm install ws @types/ws --save

echo "WebSocket dependencies should be installed via 'yarn install' in the 'packages/server' directory."
echo "Real-time training progress monitoring features should now be available if dependencies are installed."