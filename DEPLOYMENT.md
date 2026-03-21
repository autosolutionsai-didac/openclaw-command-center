# OpenClaw Marketing Hub - Deployment Guide

**Target:** Raspberry Pi 5 + 7" touchscreen (kiosk mode)  
**Backend:** VPS (Hetzner) via Tailscale  
**Frontend:** Pi (local browser, fullscreen)

---

## Architecture

```
┌─────────────────────────────────────┐
│  Raspberry Pi (Kiosk)               │
│  - Browser (Chromium, fullscreen)   │
│  - UI rendering                     │
│  - Voice I/O (Cartesia via proxy)   │
│  - Local SQLite cache               │
└──────────────┬──────────────────────┘
               │ Tailscale (100.x.x.x)
┌──────────────▼──────────────────────┐
│  VPS (Backend)                      │
│  - Node.js server (port 3000)       │
│  - OpenClaw gateway                 │
│  - Agent sessions                   │
│  - Late API integration             │
└─────────────────────────────────────┘
```

---

## Prerequisites

### Raspberry Pi

- Raspberry Pi 5 (4GB+ RAM recommended)
- 7" touchscreen (800x480 or 1024x600)
- Raspberry Pi OS (64-bit)
- Chromium browser
- Tailscale (for VPS connectivity)
- Node.js 20+

### VPS

- Ubuntu 22.04+ (Hetzner, 8GB RAM)
- Tailscale connected to same tailnet
- OpenClaw gateway running
- Node.js 20+
- SSH access

---

## Installation

### Step 1: Clone Repository

**On Pi:**

```bash
cd ~
git clone https://github.com/autosolutionsai-didac/openclaw-command-center.git marketing-hub
cd marketing-hub
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
cp .env.example .env
nano .env
```

**Edit `.env`:**

```bash
# Server
PORT=3000
NODE_ENV=production
DEMO_MODE=false

# OpenClaw Gateway (VPS address via Tailscale)
GATEWAY_URL=ws://100.124.13.56:18789
GATEWAY_TOKEN=<your-gateway-token>

# Voice (Cartesia via chat-proxy)
CHAT_PROXY_URL=https://chat.abos.work

# Late API
LATE_API_KEY=<your-late-api-key>
LATE_API_BASE=https://getlate.dev/api/v1

# Weather
WEATHER_LOCATION=Barcelona,Spain

# Multi-Company
DEFAULT_COMPANY=example
MAX_COMPANIES=5

# Database
DATABASE_PATH=./data/marketing-hub.db
```

### Step 4: Generate HTTPS Certs (for kiosk)

```bash
cd server
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
cd ..
```

### Step 5: Create Startup Script

**Create `start-kiosk.sh`:**

```bash
#!/bin/bash

# Set audio volume to 100%
amixer cset numid=1 100% 2>/dev/null || true

# Kill any existing instance
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Start server in background
cd ~/marketing-hub
nohup node server/index.js &>/tmp/marketing-hub.log &

# Wait for server to start
sleep 3

# Launch Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --fullscreen \
  --disable-restore-session-state \
  --no-first-run \
  --disable-checking-for-update \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  https://localhost:3000 \
  &

echo "Marketing Hub started!"
```

**Make executable:**

```bash
chmod +x start-kiosk.sh
```

### Step 6: Auto-Start on Boot

**Option A: Systemd Service**

Create `/etc/systemd/system/marketing-hub.service`:

```ini
[Unit]
Description=OpenClaw Marketing Hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/marketing-hub
ExecStart=/home/pi/marketing-hub/start-kiosk.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable service:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable marketing-hub
sudo systemctl start marketing-hub
```

**Check status:**

```bash
sudo systemctl status marketing-hub
```

**Option B: Crontab (@reboot)**

```bash
crontab -e
```

Add line:

```bash
@reboot /home/pi/marketing-hub/start-kiosk.sh
```

---

## Configuration

### Adding Companies

1. Create company config file:

```bash
nano config/companies/my-company.json
```

**Template:**

```json
{
  "id": "my-company",
  "name": "My OpenClaw Co",
  "brandVoice": "professional",
  "description": "Enterprise OpenClaw consulting",
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
    "timezone": "Europe/Madrid",
    "frequency": {
      "linkedin": "daily",
      "instagram": "daily",
      "facebook": "daily"
    }
  },
  "websites": [
    {
      "name": "Main Site",
      "url": "https://mycompany.com",
      "checkInterval": 300
    }
  ],
  "agentConfig": {
    "director": {
      "name": "Director",
      "color": "#F59E0B",
      "voice": "onyx"
    },
    "content": {
      "name": "Content",
      "color": "#EC4899",
      "voice": "fable"
    },
    "scout": {
      "name": "Scout",
      "color": "#06B6D4",
      "voice": "echo"
    }
  }
}
```

2. Restart server or wait for auto-reload

### Configuring Late API

1. Go to https://getlate.dev
2. Create new profile for each company
3. Connect social accounts (LinkedIn, Instagram, Facebook)
4. Copy profile ID to company config (`lateProfileId`)

---

## Operations

### Viewing Logs

**Server logs:**

```bash
tail -f /tmp/marketing-hub.log
```

**Systemd logs:**

```bash
sudo journalctl -u marketing-hub -f
```

### Restarting

```bash
sudo systemctl restart marketing-hub
```

### Stopping

```bash
sudo systemctl stop marketing-hub
```

### Updating

```bash
cd ~/marketing-hub
git pull
npm install  # if dependencies changed
sudo systemctl restart marketing-hub
```

---

## Troubleshooting

### Server won't start

**Check logs:**

```bash
tail -f /tmp/marketing-hub.log
```

**Common issues:**

- Port 3000 in use: `fuser -k 3000/tcp`
- Missing `.env`: `cp .env.example .env` and edit
- Database locked: `rm data/marketing-hub.db*` (resets DB)

### Can't connect to gateway

**Check Tailscale:**

```bash
tailscale status
```

**Test connectivity:**

```bash
ping 100.124.13.56
```

**Check gateway on VPS:**

```bash
ssh ubuntu@100.124.13.56
sudo systemctl status openclaw-gateway
```

### Voice not working

**Check chat-proxy:**

```bash
curl -X POST https://chat.abos.work/cartesia/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"test","voice_id":"e07c00bc-4134-4eae-9ea4-1a55fb45746b","format":"mp3"}'
```

**Check browser console:** F12 → Console tab

### Touchscreen not responding

**Check display:**

```bash
xrandr
```

**Recalibrate (if needed):**

```bash
sudo apt install xinput-calibrator
xinput_calibrator
```

---

## Performance Tuning

### Reduce memory usage

- Limit max companies to 3-5
- Disable demo mode in production
- Use lightweight models for agents

### Improve startup time

- Pre-generate HTTPS certs
- Use PM2 for process management
- Enable systemd service

### Optimize for 7" screen

- Use 1024x600 resolution if available
- Increase font sizes in CSS if needed
- Test touch targets (minimum 44x44px)

---

## Security

### HTTPS

- Self-signed certs generated automatically
- For production, use Let's Encrypt or valid cert
- Browser will warn on self-signed (acceptable for kiosk)

### Tailscale

- Ensure tailnet is private
- Use ACLs to restrict access
- Enable MFA on Tailscale account

### API Keys

- Store in `.env` (not committed to Git)
- Rotate keys periodically
- Use separate Late profiles per company

---

## Backup

### Database backup

```bash
cp ~/marketing-hub/data/marketing-hub.db ~/backups/marketing-hub-$(date +%Y%m%d).db
```

### Config backup

```bash
tar -czf ~/backups/marketing-hub-config-$(date +%Y%m%d).tar.gz \
  ~/marketing-hub/.env \
  ~/marketing-hub/config/companies/
```

### Restore

```bash
# Stop service
sudo systemctl stop marketing-hub

# Restore database
cp ~/backups/marketing-hub-20260321.db ~/marketing-hub/data/marketing-hub.db

# Restore config
tar -xzf ~/backups/marketing-hub-config-20260321.tar.gz -C ~/

# Restart service
sudo systemctl start marketing-hub
```

---

## Version

**v1.0** - Initial deployment guide (2026-03-21)
