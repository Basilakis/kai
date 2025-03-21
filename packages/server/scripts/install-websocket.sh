#!/bin/bash
# Script to install WebSocket dependencies for real-time progress monitoring

# Change to the server package directory
cd "$(dirname "$0")/.." || exit

echo "Installing WebSocket dependencies for real-time progress monitoring..."

# Install WebSocket server library and TypeScript definitions
npm install ws @types/ws --save

echo "WebSocket dependencies installed successfully!"
echo "Now you can use the real-time training progress monitoring features."