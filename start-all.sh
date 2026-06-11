#!/bin/bash
# start-all.sh — start all three services for campsite deployment
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🪱 Starting Worm Tamagotchi..."

# API
cd "$ROOT/api"
npm install --silent
npm run dev &
API_PID=$!

# Creator Studio
cd "$ROOT/creator-studio"
npm install --silent
npm run dev &
STUDIO_PID=$!

# Care PWA
cd "$ROOT/care-pwa"
npm install --silent --legacy-peer-deps
npm run dev -- --host &
PWA_PID=$!

echo ""
echo "✅ All services started"
echo "   API:            http://localhost:3001"
echo "   Creator Studio: http://localhost:5173"
echo "   Care PWA:       http://localhost:5174 (+ LAN)"
echo ""
echo "Press Ctrl+C to stop all"

trap "kill $API_PID $STUDIO_PID $PWA_PID 2>/dev/null" EXIT
wait
