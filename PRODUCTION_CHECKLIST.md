# Production Checklist - OpenClaw Marketing Hub

**Use this checklist to ensure everything is configured correctly for production.**

---

## ✅ Pre-Deployment

- [ ] Repository cloned on Pi (`~/marketing-hub`)
- [ ] Node.js 20+ installed (`node --version`)
- [ ] Tailscale connected (`tailscale status`)
- [ ] SSH access working (`ssh pi-4b@100.95.221.113`)

---

## ✅ Configuration

### Environment Variables (.env)

Run on Pi:
```bash
cd ~/marketing-hub
./scripts/setup-production.sh
```

Or manually edit `.env`:

```bash
# REQUIRED for production
DEMO_MODE=false
NODE_ENV=production
GATEWAY_URL=ws://100.124.13.56:18789
GATEWAY_TOKEN=<your-gateway-token>
CHAT_PROXY_URL=https://chat.abos.work
LATE_API_KEY=sk_xxxxxx
LATE_PROFILE_ID=<profile-id>
WEATHER_LOCATION=Barcelona,Spain
```

**Verify:**
```bash
grep -E "^(DEMO_MODE|GATEWAY_URL|CHAT_PROXY_URL|LATE_API_KEY)=" .env
```

---

## ✅ HTTPS Certificates

```bash
ls -la server/cert.pem server/key.pem
```

If missing:
```bash
cd server
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
cd ..
```

---

## ✅ Company Configuration

Create at least one company:

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

---

## ✅ Late API Setup

1. Go to https://getlate.dev
2. Create new profile for each company
3. Connect social accounts:
   - LinkedIn (Company Page)
   - Instagram (Business Account)
   - Facebook (Page)
4. Copy Profile ID to company config

**Test Late API:**
```bash
curl -X GET https://getlate.dev/api/v1/profiles \
  -H "Authorization: Bearer sk_xxxxxx"
```

---

## ✅ OpenClaw Gateway

**On VPS (Suzy's Hetzner box):**
```bash
# Check gateway is running
sudo systemctl status openclaw-gateway

# Get gateway token
cat ~/.openclaw/gateway-token
```

**On Pi, test connection:**
```bash
curl http://100.124.13.56:18789
```

---

## ✅ Voice Testing

**On Pi (Chromium):**

1. Open `https://localhost:3000`
2. Accept HTTPS certificate warning
3. Click 🔒 lock icon → Allow Microphone
4. Tap mascot → Speak → Should see transcription

**Troubleshooting:**

- No transcription? Check browser console (F12)
- Mic not working? `arecord -l` to check mic detection
- Permission denied? Reset in Chromium settings

---

## ✅ Service Status

```bash
# Check service is running
sudo systemctl status marketing-hub

# View logs
sudo journalctl -u marketing-hub -f

# Check port 3000 is listening
sudo lsof -i :3000
```

**Expected output:**
```
[server] OpenClaw Marketing Hub running on https://0.0.0.0:3000
[server] TLS: ENABLED
[server] Voice: ENABLED (Cartesia via chat-proxy)
[server] Multi-tenant: ENABLED (X companies loaded)
[server] Scheduler: ENABLED (auto-posting)
[bridge] Connected (production mode)
```

---

## ✅ Functional Tests

### Company Switcher
- [ ] Dropdown shows all companies
- [ ] Switching updates UI colors
- [ ] Kanban updates per company

### Voice
- [ ] Tap mascot → mic permission granted
- [ ] Speak → transcription appears
- [ ] Agent responds with TTS audio

### Kanban Board
- [ ] DRAFTS column shows draft posts
- [ ] SCHEDULED column shows upcoming posts with times
- [ ] POSTED column shows published posts

### Post Creation
- [ ] Create post via API:
  ```bash
  curl -X POST http://localhost:3000/api/posts/example \
    -H "Content-Type: application/json" \
    -d '{"content":"Test post","platforms":["linkedin"]}'
  ```
- [ ] Post appears in DRAFTS
- [ ] Schedule post → appears in SCHEDULED
- [ ] Post publishes → appears in POSTED

### Auto-Posting Scheduler
- [ ] Scheduler is running (check logs for `[scheduler]`)
- [ ] Scheduled posts publish at correct time
- [ ] Failed posts marked as error

### Analytics
- [ ] Weather widget shows Barcelona weather
- [ ] System metrics show real CPU/mem/disk/temp
- [ ] Clock updates every second

---

## ✅ Security

- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] HTTPS enabled (self-signed or valid cert)
- [ ] Tailscale firewall enabled
- [ ] No API keys in GitHub (check `.gitignore`)
- [ ] Gateway token rotated (if shared)

---

## ✅ Monitoring

**Set up log rotation:**
```bash
sudo nano /etc/logrotate.d/marketing-hub
```

**Content:**
```
/tmp/marketing-hub.log {
  daily
  rotate 7
  compress
  delaycompress
  notifempty
  create 0644 pi-4b pi-4b
}
```

**Check disk space:**
```bash
df -h
```

---

## ✅ Backup

**Database backup:**
```bash
cp ~/marketing-hub/data/marketing-hub.db ~/backups/
```

**Config backup:**
```bash
tar -czf ~/backups/marketing-hub-config.tar.gz \
  ~/marketing-hub/.env \
  ~/marketing-hub/config/companies/
```

**Automate backups (cron):**
```bash
crontab -e
# Add: 0 2 * * * cp ~/marketing-hub/data/marketing-hub.db ~/backups/db-$(date +\%Y\%m\%d).db
```

---

## ✅ Performance Tuning

**For Pi 4B (2-8GB RAM):**

- Limit max companies: `MAX_COMPANIES=5`
- Disable unused features in config
- Monitor memory: `free -h`
- Check CPU temp: `vcgencmd measure_temp`

**If running slow:**
- Reduce kanban refresh rate (default 10s)
- Limit post history (default 50 per company)
- Disable demo mode animations

---

## ✅ Documentation

- [ ] QUICKSTART.md accessible
- [ ] DEPLOYMENT.md reviewed
- [ ] Team trained on basic operations
- [ ] Emergency contacts documented

---

## 🚀 Go-Live

Once all items checked:

1. **Announce to team** - Marketing Hub is live
2. **Create first real posts** - Test full workflow
3. **Monitor for 24h** - Watch for issues
4. **Gather feedback** - Iterate based on usage

---

## 📞 Support

**Logs:** `sudo journalctl -u marketing-hub -f`  
**Status:** `sudo systemctl status marketing-hub`  
**Restart:** `sudo systemctl restart marketing-hub`  
**GitHub:** https://github.com/autosolutionsai-didac/openclaw-command-center

---

**Version:** v1.0 (2026-03-21)  
**Status:** ✅ Production Ready
