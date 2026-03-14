# OpenClaw Command Center

![OpenClaw Command Center](public/openclaw_command_center.png)
A web-based AI command center featuring a pixel art office with 3 AI agents, voice interaction, and real-time system monitoring. Built for Raspberry Pi 5 + 7" touchscreen, but runs anywhere with Node.js.



## Quick Start

```bash
git clone <this-repo>
cd openclaw-command-center
npm install
cp .env.example .env
npm start
# Open http://localhost:3000
```

That's it. With zero config, the app runs in **demo mode** — full UI with simulated agent activity, no gateway or API keys needed.

## What You'll See

The UI has three zones:

- **Left** — Animated mascot (tap to talk to Jansky, the boss agent)
- **Right** — Pixel art office with 3 agents at desks, conference huddles, personality-driven wandering, real system metrics, weather widget, digital clock
- **Bottom** — Terminal log showing agent activity

### The Team

| Agent | ID | Role | Color | TTS Voice |
|-------|----|------|-------|-----------|
| **Jansky** | `main` | Boss/orchestrator | Gold | onyx (deep) |
| **Orbit** | `claw-1` | Coding/tasks | Cyan | echo (clear) |
| **Nova** | `claw-2` | Research/web | Purple | fable (warm) |

Tap an agent in the office to start recording a voice message for them. Tap again to send. Agents respond with per-character TTS voices.

## Architecture

### Server (`server/`)

| File | Purpose |
|------|---------|
| `index.js` | Express + HTTPS/HTTP server, WebSocket, voice routes, agent CLI bridge, weather + health APIs |
| `openclaw-bridge.js` | Gateway RPC v3 WebSocket connection, event normalization, demo fallback |
| `voice.js` | Whisper STT + OpenAI TTS with per-agent voice selection |
| `config.js` | Environment config loader |

### Client (`public/`)

| File | Purpose |
|------|---------|
| `js/app.js` | Boot sequence, WebSocket client, event routing, tap-to-talk |
| `js/office.js` | Canvas pixel art office — agents, furniture, wandering AI, huddles, weather ambiance, health metrics |
| `js/voice.js` | Client-side recording, target agent selection, Web Audio playback (2x volume boost) |
| `js/mascot.js` | Mascot canvas animation + emotion states |
| `js/terminal.js` | Terminal log renderer |

### Data Flow

```
Browser (tap agent) → MediaRecorder → POST /api/voice/transcribe
  → Whisper STT → openclaw CLI → agent response
  → WebSocket broadcast → office animation + TTS playback
```

## Environment Variables

See `.env.example` for the full template.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DEMO_MODE` | `true` | `true` = no gateway needed. `false` = connects to OpenClaw gateway |
| `GATEWAY_URL` | `ws://127.0.0.1:18789` | OpenClaw gateway WebSocket URL |
| `GATEWAY_TOKEN` | — | Gateway auth token (required when `DEMO_MODE=false`) |
| `OPENAI_API_KEY` | — | Enables Whisper STT + TTS voice features |
| `WEATHER_LOCATION` | `Kingston,Ontario,Canada` | City,Region,Country for the weather widget (via wttr.in) |

## Agent Configuration

### Agent config file

Copy the example to your OpenClaw config directory:

```bash
cp config/openclaw.json.example ~/.openclaw/openclaw.json
```

This defines 3 agents with cost-optimized models (kimi-k2.5 for the boss, minimax-m2.5 for sub-agents).

### System prompts

| Agent | Prompt location |
|-------|----------------|
| Jansky (main) | `agents/main/SYSTEM.md` → copy to `~/.openclaw/workspace/SYSTEM.md` |
| Orbit (claw-1) | `agents/claw-1/SYSTEM.md` (read from repo) |
| Nova (claw-2) | `agents/claw-2/SYSTEM.md` (read from repo) |

Sub-agent prompts emphasize speed: 1-3 sentences, no preamble, act-then-report, no markdown.

### Agent self-setup

If your OpenClaw agent can read files, point it at `SETUP.md` — it contains step-by-step instructions the agent can follow to configure everything automatically.

## Cost Optimization

Running 3 AI agents can get expensive. Here are copy-paste prompts to keep costs down:

### 1. Use cheap models (default config)

The included `config/openclaw.json.example` already uses cost-optimized models:
- **kimi-k2.5** (Moonshot) for the boss — good reasoning, low cost
- **minimax-m2.5** (OpenRouter) for sub-agents — fast, cheap

### 2. Even cheaper sub-agents

```
Switch claw-1 and claw-2 to gemini-2.5-flash-lite via openrouter. Keep main on kimi-k2.5.
```

### 3. Heartbeat optimization

```
Set heartbeat interval to 60 minutes, use the cheapest available model for heartbeats, and make the heartbeat target the last-active agent only.
```

### 4. Session management

```
After 30 exchanges or 30 minutes of continuous conversation, run /reset to clear context and reduce token costs. Warn me before resetting.
```

### 5. Memory flush

```
Set a soft token threshold of 4000 tokens. When approaching the limit, summarize the conversation so far, save key context to memory, then /reset.
```

## Raspberry Pi Deployment

### Deploy from local machine

```bash
rsync -avz ./ jansky@<PI_IP>:/home/jansky/openclaw-command-center/ \
  --exclude node_modules --exclude .env --exclude .git
ssh jansky@<PI_IP> 'cd /home/jansky/openclaw-command-center && npm install'
```

### Generate HTTPS certs (required for Pi kiosk)

```bash
ssh jansky@<PI_IP>
cd /home/jansky/openclaw-command-center
openssl req -x509 -newkey rsa:2048 -keyout server/key.pem -out server/cert.pem -days 365 -nodes -subj '/CN=localhost'
```

### Start / restart on Pi

```bash
ssh jansky@<PI_IP> 'fuser -k 3000/tcp; sleep 1; cd /home/jansky/openclaw-command-center && nohup node server/index.js &>/tmp/openclaw.log &'
```

Or use the included `start.sh` which also sets audio volume and launches Chromium in kiosk mode.

### Audio on Pi

The Pi has no system-level master mixer for USB audio. Volume boost is handled via Web Audio API GainNode (2x) in the browser. `start.sh` also runs `amixer` to set hardware volume to 100%.

## Troubleshooting

### Server won't start — port in use

```bash
fuser -k 3000/tcp
npm start
```

### Gateway connection keeps dropping

Check that your connect frame uses RPC v3 format (`type: "req"`, `method: "connect"`). See `server/openclaw-bridge.js` for the correct handshake.

### Voice not working

- Check that `OPENAI_API_KEY` is set in `.env`
- The server logs `Voice: ENABLED` or `Voice: DISABLED` on startup

### `openclaw: command not found`

The binary is at `~/.local/bin/openclaw`. The server sets PATH explicitly, but if running manually, add it to your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Sub-agents responding slowly

Sub-agents should use `--thinking off` (set in `server/index.js`). Their system prompts also instruct them to keep replies to 1-3 sentences.

### Weather widget shows wrong location

Set `WEATHER_LOCATION` in `.env` to your city (format: `City,Region,Country`).
