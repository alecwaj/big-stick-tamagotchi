#!/bin/bash
# start-all.sh — start all three services for weekend deployment

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Detect LAN IP ──────────────────────────────────────────────────
if [[ "$(uname)" == "Darwin" ]]; then
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
else
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
fi

# ── Write .env files ───────────────────────────────────────────────
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
echo "🪱 Starting Big Stick Worm..."
echo ""

# ── Install deps (errors non-fatal) ───────────────────────────────
echo "📦 Installing dependencies..."
(cd "$ROOT/api"            && npm install --silent) || true
(cd "$ROOT/creator-studio" && npm install --silent) || true
(cd "$ROOT/care-pwa"       && npm install --silent --legacy-peer-deps) || true

echo ""
echo "🚀 Starting services..."

# ── Start API (bind to 0.0.0.0 so phones on LAN can hit it) ──────
(cd "$ROOT/api" && CARE_URL="http://${API_HOST}:5174" \
  STUDIO_URL="http://${API_HOST}:5173" npm run dev) &
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

# ── Print QR code for landing page in terminal ────────────────────
LANDING_URL="http://${API_HOST}:3001"
echo ""
echo -e "${YELLOW}📱 LANDING PAGE QR — point phones here:${NC}"
echo ""
# Try qrencode (brew install qrencode) — graceful fallback if missing
if command -v qrencode &> /dev/null; then
  qrencode -t UTF8 "$LANDING_URL" 2>/dev/null || true
else
  echo "   (install qrencode for QR: brew install qrencode)"
fi
echo "   $LANDING_URL"
echo ""

# ── Print summary ─────────────────────────────────────────────────
echo -e "${GREEN}✅ All services running${NC}"
echo ""
echo -e "  ${CYAN}Landing page${NC}    →  http://${API_HOST}:3001       📱 phones join here"
echo -e "  ${CYAN}Creator Studio${NC}  →  http://localhost:5173          🖥  big screen"
echo -e "  ${CYAN}Care PWA${NC}        →  http://${API_HOST}:5174"
echo -e "  ${CYAN}Admin panel${NC}     →  http://localhost:3001/admin    🔧 your view"
echo ""
if [[ -n "$LAN_IP" ]]; then
  echo "  Phones must be on the same WiFi as this machine."
else
  echo "  ⚠️  Could not detect LAN IP. Run: ipconfig getifaddr en0"
fi
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

trap "echo ''; echo 'Stopping...'; kill $API_PID $STUDIO_PID $PWA_PID 2>/dev/null; exit 0" INT TERM EXIT
wait
