# OpenClaw Marketing Hub - Quick Start Guide

**5 minutes to running on your Raspberry Pi**

---

## Prerequisites

- Raspberry Pi 5 with 7" touchscreen
- Tailscale installed and connected to your tailnet
- Node.js 20+ installed on Pi

---

## Option A: Automated Deployment (Recommended)

**From your MacBook:**

```bash
# Clone and deploy
cd ~/marketing-hub
./scripts/deploy-to-pi.sh <your-pi-tailscale-ip>
```

Example:
```bash
./scripts/deploy-to-pi.sh 100.108.202.72
```

**Then on Pi:**

```bash
# SSH into Pi
ssh pi@<your-pi-tailscale-ip>

# Edit .env with your settings
nano ~/marketing-hub/.env

# Required settings:
# - GATEWAY_URL (your VPS Tailscale IP)
# - GATEWAY_TOKEN
# - LATE_API_KEY
# - WEATHER_LOCATION

# Check status
sudo systemctl status marketing-hub

# View logs
sudo journalctl -u marketing-hub -f
```

---

## Option B: Manual Installation

**On Pi:**

```bash
# 1. Clone repository
cd ~
git clone https://github.com/autosolutionsai-didac/openclaw-command-center.git marketing-hub
cd marketing-hub

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
nano .env  # Edit with your settings

# 4. Generate HTTPS certs
cd server
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
cd ..

# 5. Make startup script executable
chmod +x start-kiosk.sh

# 6. Install systemd service
sudo cp marketing-hub.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable marketing-hub
sudo systemctl start marketing-hub

# 7. Check status
sudo systemctl status marketing-hub
```

---

## Configuration (.env)

**Required settings:**

```bash
# Server
PORT=3000
NODE_ENV=production
DEMO_MODE=false

# OpenClaw Gateway (VPS via Tailscale)
GATEWAY_URL=ws://100.124.13.56:18789  # Suzy's VPS
GATEWAY_TOKEN=<your-gateway-token>

# Voice (Cartesia via chat-proxy)
CHAT_PROXY_URL=https://chat.abos.work

# Late API
LATE_API_KEY=sk_xxxxxx
LATE_API_BASE=https://getlate.dev/api/v1

# Weather
WEATHER_LOCATION=Barcelona,Spain

# Multi-Company
DEFAULT_COMPANY=example
MAX_COMPANIES=5

# Database
DATABASE_PATH=./data/marketing-hub.db
```

---

## Adding Your First Company

**Create company config:**

```bash
nano config/companies/my-company.json
```

**Template:**

```json
{
  "id": "my-company",
  "name": "My OpenClaw Co",
  "brandVoice": "professional",
  "lateProfileId": "<late-profile-id>",
  "socialAccounts": ["linkedin", "instagram", "facebook"],
  "colors": {
    "primary": "#3B82F6",
    "secondary": "#1E40AF",
    "kanban": "#10B981"
  },
  "postingSchedule": {
    "enabled": true,
    "times": ["9:00", "13:00", "17:00"],
    "timezone": "Europe/Madrid"
  }
}
```

**Restart to load new company:**

```bash
sudo systemctl restart marketing-hub
```

---

## Testing

**1. Access the UI:**

Open browser on Pi: `https://localhost:3000`

Or from another device: `https://<pi-tailscale-ip>:3000`

**2. Test company switcher:**

- Click dropdown in header
- Select different company
- Kanban should update

**3. Test voice:**

- Tap mascot (Director agent)
- Speak a message
- Should see transcription + response

**4. Test kanban:**

- Should show DRAFTS → SCHEDULED → POSTED columns
- Auto-refreshes every 10 seconds

---

## Operations

**View logs:**

```bash
sudo journalctl -u marketing-hub -f
```

**Restart:**

```bash
sudo systemctl restart marketing-hub
```

**Stop:**

```bash
sudo systemctl stop marketing-hub
```

**Update:**

```bash
cd ~/marketing-hub
git pull
sudo systemctl restart marketing-hub
```

**Check status:**

```bash
sudo systemctl status marketing-hub
```

---

## Troubleshooting

**Service won't start:**

```bash
# Check logs
sudo journalctl -u marketing-hub -n 50

# Check if port 3000 is in use
sudo lsof -i :3000

# Check Node.js version
node --version  # Should be 20+
```

**Can't connect to gateway:**

```bash
# Test Tailscale connectivity
ping 100.124.13.56

# Check gateway on VPS
ssh ubuntu@100.124.13.56
sudo systemctl status openclaw-gateway
```

**Touchscreen not working:**

```bash
# Check display
xrandr

# Recalibrate if needed
sudo apt install xinput-calibrator
xinput_calibrator
```

---

## Next Steps

1. **Configure Late API** - Create profiles at https://getlate.dev
2. **Connect social accounts** - LinkedIn, Instagram, Facebook
3. **Create content** - Add posts via API or voice commands
4. **Monitor** - Check kanban for scheduled/published posts

---

## Support

- **Docs:** `/Users/didacfg/.openclaw/workspace/openclaw-marketing-hub/DEPLOYMENT.md`
- **GitHub:** https://github.com/autosolutionsai-didac/openclaw-command-center
- **Discord:** https://discord.com/invite/clawd

---

**Version:** v1.0 (2026-03-21)
