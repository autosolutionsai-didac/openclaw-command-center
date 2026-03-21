#!/bin/bash
# Deploy Marketing Hub to Raspberry Pi via Tailscale
# Usage: ./scripts/deploy-to-pi.sh <pi-tailscale-ip> [username]
# Examples:
#   ./scripts/deploy-to-pi.sh 100.95.221.113
#   ./scripts/deploy-to-pi.sh 100.95.221.113 didac

set -e

PI_IP="${1:-100.95.221.113}"  # Default: pi-4b-marketing Tailscale IP
PI_USER="${2:-pi-4b}"  # Default username: pi-4b (override with second arg)
PI_PATH="/home/${PI_USER}/marketing-hub"

echo "🚀 Deploying Marketing Hub to Pi at ${PI_IP}..."

# Check connectivity
echo "📡 Checking Tailscale connectivity..."
if ! ping -c 1 "${PI_IP}" > /dev/null 2>&1; then
  echo "❌ Cannot reach Pi at ${PI_IP}. Is Tailscale running?"
  exit 1
fi
echo "✅ Pi is reachable"

# Create deployment archive
echo "📦 Creating deployment archive..."
cd "$(dirname "$0")/.."
tar -czf /tmp/marketing-hub-deploy.tar.gz \
  --exclude node_modules \
  --exclude .git \
  --exclude data \
  --exclude .env \
  --exclude server/cert.pem \
  --exclude server/key.pem \
  --exclude /tmp \
  .

# Copy to Pi
echo "📤 Copying to Pi (${PI_USER}@${PI_IP})..."
scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 /tmp/marketing-hub-deploy.tar.gz ${PI_USER}@${PI_IP}:/tmp/ 2>&1 || {
  echo "❌ SSH connection failed. Check:"
  echo "   1. Pi is reachable: ping -c 1 ${PI_IP}"
  echo "   2. SSH is enabled: sudo systemctl status ssh"
  echo "   3. Username is correct: ${PI_USER}"
  echo "   4. SSH key is authorized on Pi"
  exit 1
}

# Install on Pi
echo "🔧 Installing on Pi..."
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${PI_USER}@${PI_IP} << 'EOF'
  set -e
  
  echo "  → Stopping existing service..."
  sudo systemctl stop marketing-hub 2>/dev/null || true
  
  echo "  → Creating directory..."
  mkdir -p ~/marketing-hub
  
  echo "  → Extracting archive..."
  tar -xzf /tmp/marketing-hub-deploy.tar.gz -C ~/marketing-hub/
  
  echo "  → Installing dependencies..."
  cd ~/marketing-hub
  npm install --production
  
  echo "  → Installing OpenClaw CLI..."
  if ! command -v openclaw &> /dev/null; then
    curl -fsSL https://openclaw.ai/install.sh | sh
    echo "  → OpenClaw CLI installed"
  else
    echo "  → OpenClaw CLI already installed"
  fi
  
  echo "  → Setting up environment..."
  if [ ! -f .env ]; then
    cp .env.example .env
    echo "  → Edit .env with your configuration!"
  fi
  
  echo "  → Generating HTTPS certs..."
  if [ ! -f server/cert.pem ]; then
    cd server
    openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost' 2>/dev/null
    cd ..
  fi
  
  echo "  → Setting permissions..."
  chmod +x start-kiosk.sh 2>/dev/null || true
  
  echo "  → Starting service..."
  sudo systemctl daemon-reload
  sudo systemctl start marketing-hub
  
  echo "✅ Installation complete!"
EOF

# Cleanup
rm -f /tmp/marketing-hub-deploy.tar.gz

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps on Pi:"
echo "  1. SSH into Pi: ssh ${PI_USER}@${PI_IP}"
echo "  2. Edit .env: nano ~/marketing-hub/.env"
echo "  3. Check status: sudo systemctl status marketing-hub"
echo "  4. View logs: sudo journalctl -u marketing-hub -f"
echo ""
echo "Open browser: https://${PI_IP}:3000"
