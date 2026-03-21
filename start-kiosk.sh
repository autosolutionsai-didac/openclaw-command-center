#!/bin/bash
# OpenClaw Marketing Hub - Kiosk Startup Script
# For Raspberry Pi 5 + 7" touchscreen

set -e

echo "[kiosk] Starting Marketing Hub..."

# Set audio volume to 100%
echo "[kiosk] Setting audio volume..."
amixer cset numid=1 100% 2>/dev/null || true

# Kill any existing instance on port 3000
echo "[kiosk] Stopping existing instances..."
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Start server in background
echo "[kiosk] Starting server..."
cd ~/marketing-hub
export NODE_ENV=production
nohup node server/index.js &>/tmp/marketing-hub.log &
SERVER_PID=$!
echo "[kiosk] Server started (PID: ${SERVER_PID})"

# Wait for server to be ready
echo "[kiosk] Waiting for server to start..."
for i in {1..30}; do
  if curl -s http://localhost:3000/api/status > /dev/null 2>&1; then
    echo "[kiosk] Server is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "[kiosk] ⚠️  Server took too long to start, continuing anyway..."
  fi
  sleep 1
done

# Launch Chromium in kiosk mode
echo "[kiosk] Launching Chromium in kiosk mode..."
chromium-browser \
  --kiosk \
  --fullscreen \
  --disable-restore-session-state \
  --no-first-run \
  --disable-checking-for-update \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --disable-features=TranslateUI \
  --disable-component-extensions-with-background-pages \
  --disable-background-networking \
  --disable-default-apps \
  --disable-sync \
  --noerrdialogs \
  --window-size=1024,600 \
  https://localhost:3000 \
  &

echo "[kiosk] Marketing Hub is running!"
echo "[kiosk] Press Ctrl+C to stop (or reboot to restart)"

# Wait for Chromium
wait
