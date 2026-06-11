#!/bin/bash
# start-all.sh — start all three services for campsite deployment

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Detect local IP for phone access ──────────────────────────────
if [[ "$(uname)" == "Darwin" ]]; then
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
else
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
fi

# ── Patch .env files to use LAN IP ────────────────────────────────
if [[ -n "$LAN_IP" ]]; then
  printf "VITE_API_URL=http://${LAN_IP}:3001\nVITE_PWA_URL=http://${LAN_IP}:5174\n" > "$ROOT/care-pwa/.env"
  printf "VITE_API_URL=http://${LAN_IP}:3001\nVITE_PWA_URL=http://${LAN_IP}:5174\n" > "$ROOT/creator-studio/.env"
  API_HOST="$LAN_IP"
else
  printf "VITE_API_URL=http://localhost:3001\nVITE_PWA_URL=http://localhost:5174\n" > "$ROOT/care-pwa/.env"
  printf "VITE_API_URL=http://localhost:3001\nVITE_PWA_URL=http://localhost:5174\n" > "$ROOT/creator-studio/.env"
  API_HOST="localhost"
fi

echo ""
echo "🪱 Starting Worm Tamagotchi..."
echo ""

# ── Install deps (errors non-fatal) ───────────────────────────────
echo "📦 Installing dependencies..."
(cd "$ROOT/api"            && npm install --silent) || true
(cd "$ROOT/creator-studio" && npm install --silent) || true
(cd "$ROOT/care-pwa"       && npm install --silent --legacy-peer-deps) || true

echo ""
echo "🚀 Starting services..."

# ── Start API ─────────────────────────────────────────────────────
(cd "$ROOT/api" && CARE_URL="http://${API_HOST}:5174" npm run dev) &
API_PID=$!

# ── Start Creator Studio ──────────────────────────────────────────
(cd "$ROOT/creator-studio" && npm run dev) &
STUDIO_PID=$!

# ── Start Care PWA (expose on LAN) ────────────────────────────────
(cd "$ROOT/care-pwa" && npm run dev -- --host) &
PWA_PID=$!

# ── Wait for API to be ready ──────────────────────────────────────
echo "⏳ Waiting for API..."
for i in $(seq 1 30); do
  if curl -s "http://localhost:3001/health" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo ""
echo -e "${GREEN}✅ All services running${NC}"
echo ""
echo -e "  ${CYAN}Creator Studio${NC}  →  http://localhost:5173        (open on Mac)"
echo -e "  ${CYAN}Care PWA${NC}        →  http://${API_HOST}:5174     (share with phones)"
echo -e "  ${CYAN}API${NC}             →  http://localhost:3001"
echo ""
if [[ -n "$LAN_IP" ]]; then
  echo -e "  📱 Phone QR URL:   http://${LAN_IP}:5174"
  echo "     (phones must be on same WiFi)"
else
  echo "  ⚠️  Could not detect LAN IP — phone access may not work."
  echo "     Run: ipconfig getifaddr en0   and update care-pwa/.env manually."
fi
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

trap "echo ''; echo 'Stopping...'; kill $API_PID $STUDIO_PID $PWA_PID 2>/dev/null; exit 0" INT TERM EXIT
wait
