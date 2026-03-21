#!/bin/bash
# Production Setup Script for Marketing Hub
# Run this on the Pi to configure for production

set -e

echo "🚀 Setting up Marketing Hub for production..."

cd ~/marketing-hub

# 1. Check if .env exists
if [ ! -f .env ]; then
  echo "📝 Creating .env from template..."
  cp .env.example .env
fi

# 2. Prompt for required values
echo ""
echo "⚙️  Production Configuration"
echo "============================="
echo ""

# Gateway Token
read -p "Enter OpenClaw Gateway Token (or press Enter to skip): " GATEWAY_TOKEN
if [ -n "$GATEWAY_TOKEN" ]; then
  sed -i "s/^GATEWAY_TOKEN=.*/GATEWAY_TOKEN=${GATEWAY_TOKEN}/" .env
  echo "✅ Gateway token configured"
fi

# Late API Key (already in .env.example, but confirm)
read -p "Use default Late API key? (y/n): " USE_LATE_KEY
if [ "$USE_LATE_KEY" != "y" ]; then
  read -p "Enter Late API Key: " LATE_API_KEY
  sed -i "s/^LATE_API_KEY=.*/LATE_API_KEY=${LATE_API_KEY}/" .env
  echo "✅ Late API key configured"
fi

# 3. Install OpenClaw CLI (if not present)
if ! command -v openclaw &> /dev/null; then
  echo ""
  echo "🔧 Installing OpenClaw CLI..."
  curl -fsSL https://openclaw.ai/install.sh | sh
  echo "✅ OpenClaw CLI installed"
else
  echo ""
  echo "✅ OpenClaw CLI already installed"
fi

# 4. Enable production mode
echo ""
echo "🔧 Enabling production mode..."
sed -i 's/^DEMO_MODE=.*/DEMO_MODE=false/' .env
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' .env
echo "✅ Production mode enabled"

# 4. Fix chat-proxy URL
sed -i 's|^CHAT_PROXY_URL=.*|CHAT_PROXY_URL=https://chat.abos.work|' .env
echo "✅ Chat-proxy URL configured"

# 5. Generate HTTPS certs if missing
if [ ! -f server/cert.pem ] || [ ! -f server/key.pem ]; then
  echo ""
  echo "🔒 Generating HTTPS certificates..."
  cd server
  openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost' 2>/dev/null
  cd ..
  echo "✅ HTTPS certs generated"
fi

# 6. Set permissions
echo ""
echo "🔐 Setting permissions..."
chmod 600 .env
chmod +x start-kiosk.sh
echo "✅ Permissions set"

# 7. Show configuration
echo ""
echo "📋 Current Configuration:"
echo "========================="
grep -E "^(DEMO_MODE|NODE_ENV|GATEWAY_URL|CHAT_PROXY_URL|LATE_API_KEY|WEATHER_LOCATION)=" .env | sed 's/=.*$/=****/' | sed 's/CHAT_PROXY_URL=.*/CHAT_PROXY_URL=https:\/\/chat.abos.work/' | sed 's/LATE_API_KEY=.*/LATE_API_KEY=sk_****/'
echo ""

# 8. Restart service
echo ""
read -p "Restart marketing-hub service now? (y/n): " RESTART
if [ "$RESTART" = "y" ]; then
  echo "🔄 Restarting service..."
  sudo systemctl restart marketing-hub
  echo "✅ Service restarted"
  
  echo ""
  echo "📊 Service Status:"
  sudo systemctl status marketing-hub --no-pager -l
fi

echo ""
echo "🎉 Production setup complete!"
echo ""
echo "Next steps:"
echo "  1. Create Late profiles at https://getlate.dev"
echo "  2. Add company configs in config/companies/"
echo "  3. Open https://localhost:3000 in Chromium"
echo "  4. Test voice (tap mascot and speak)"
echo "  5. Create and schedule posts"
echo ""
