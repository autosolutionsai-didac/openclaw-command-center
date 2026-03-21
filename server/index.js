import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFile, exec } from 'node:child_process';
import os from 'node:os';
import multer from 'multer';

import config from './config.js';
import { initDatabase, logActivity, getActiveCompany } from './db/index.js';
import companyManager from './company-manager.js';
import OpenClawBridge from './openclaw-bridge.js';
import { transcribe } from './voice.js';
import { speak } from './voice-cartesia.js';
import companiesRouter from './routes/companies.js';
import postsRouter from './routes/posts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Initialize database
initDatabase();

// Initialize company manager
await companyManager.init();

// Use HTTPS if certs exist, otherwise fall back to HTTP
const certPath = join(__dirname, 'cert.pem');
const keyPath = join(__dirname, 'key.pem');
const useHttps = existsSync(certPath) && existsSync(keyPath);
let server;
if (useHttps) {
  server = createHttpsServer({
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  }, app);
} else {
  server = createHttpServer(app);
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Static files
app.use(express.static(join(__dirname, '..', 'public')));
app.use(express.json());

// API Routes
app.use('/api/companies', companiesRouter);
app.use('/api/posts', postsRouter);

// Status endpoint (multi-tenant aware)
app.get('/api/status', (req, res) => {
  const activeCompany = companyManager.getActiveCompany();
  res.json({
    uptime: process.uptime(),
    bridge: bridge.getStatus(),
    clients: wss.clients.size,
    voiceEnabled: !!config.cartesiaApiKey,
    multiTenant: true,
    activeCompany: activeCompany ? {
      id: activeCompany.id,
      name: activeCompany.name,
      colors: activeCompany.colors
    } : null,
    companyCount: companyManager.getAllCompanies().length
  });
});

// Health endpoint — real Pi metrics (CPU, memory, disk, temp)
app.get('/api/health', (req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
  const loadAvg = os.loadavg()[0]; // 1-min average
  const cpuPct = Math.min(100, Math.round((loadAvg / cpus.length) * 100));

  // Disk usage and CPU temp (Linux-specific, async)
  exec("df / --output=pcent | tail -1 | tr -d ' %'; echo; cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0", (err, stdout) => {
    const lines = (stdout || '').trim().split('\n');
    const diskPct = parseInt(lines[0]) || 0;
    const tempC = Math.round((parseInt(lines[1]) || 0) / 1000);
    res.json({ cpu_pct: cpuPct, mem_pct: memPct, disk_pct: diskPct, temp_c: tempC, uptime: Math.floor(os.uptime()) });
  });
});

// Weather endpoint (configurable location — cached 10 min)
let weatherCache = { data: null, ts: 0 };
app.get('/api/weather', async (req, res) => {
  const now = Date.now();
  if (weatherCache.data && now - weatherCache.ts < 600000) {
    return res.json(weatherCache.data);
  }
  try {
    const resp = await fetch(`https://wttr.in/${encodeURIComponent(config.weatherLocation)}?format=j1`);
    const json = await resp.json();
    const cur = json.current_condition?.[0] || {};
    const data = {
      temp_c: parseInt(cur.temp_C) || 0,
      feels_like: parseInt(cur.FeelsLikeC) || 0,
      desc: cur.weatherDesc?.[0]?.value || 'Unknown',
      code: parseInt(cur.weatherCode) || 0,
      humidity: parseInt(cur.humidity) || 0,
      wind_kph: parseInt(cur.windspeedKmph) || 0,
      location: config.weatherLocation.split(',')[0],
    };
    weatherCache = { data, ts: now };
    res.json(data);
  } catch (err) {
    console.error('[weather] Error:', err.message);
    res.json(weatherCache.data || { temp_c: 0, desc: 'Unavailable', code: 0 });
  }
});

// Get current active company context
function getCurrentCompanyContext() {
  const company = companyManager.getActiveCompany();
  if (!company) {
    throw new Error('No active company configured');
  }
  return {
    companyId: company.id,
    companyName: company.name,
    brandVoice: company.brandVoice,
    colors: company.colors
  };
}

// Send transcribed text to an OpenClaw agent via CLI (multi-tenant aware)
function sendToAgent(agentId, message, companyId = null) {
  const target = agentId || 'main';
  const companyContext = companyId ? companyManager.getCompany(companyId) : getCurrentCompanyContext();
  
  console.log(`[agent] Sending to ${target} for ${companyContext.name}: "${message.slice(0, 80)}..."`);

  broadcast({
    type: 'agent:thinking',
    data: { agent: target, status: 'Processing...', companyId: companyContext.id },
  });

  const openclawBin = process.env.HOME + '/.local/bin/openclaw';
  // Sub-agents use --thinking off for faster responses
  const thinkingLevel = target === 'main' ? 'low' : 'off';
  execFile(openclawBin, [
    'agent', '--agent', target,
    '--thinking', thinkingLevel,
    '--message', message,
  ], {
    timeout: 90000,
    env: { 
      ...process.env, 
      PATH: process.env.HOME + '/.local/bin:' + process.env.PATH,
      COMPANY_ID: companyContext.id // Pass company context to agent
    },
  }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[agent] Error from ${target}:`, err.message);
      broadcast({
        type: 'agent:error',
        data: { agent: target, message: err.message, companyId: companyContext.id },
      });
      return;
    }

    const response = stdout.trim();
    console.log(`[agent] Response from ${target}: "${response.slice(0, 80)}..."`);

    // Log activity
    logActivity(companyContext.id, target, 'agent_response', { message, response });

    broadcast({
      type: 'agent:responding',
      data: { agent: target, message: response, companyId: companyContext.id },
    });
  });
}

// Voice: transcribe audio -> text (multi-tenant aware)
app.post('/api/voice/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const targetAgent = req.body?.targetAgent || 'main';
    const companyId = req.body?.companyId || companyManager.getActiveCompany()?.id;
    
    console.log(`[voice] Transcribing ${req.file.size} bytes for agent: ${targetAgent}, company: ${companyId}`);
    const text = await transcribe(req.file.buffer, req.file.originalname || 'audio.webm');
    console.log(`[voice] Transcribed: "${text}"`);

    // Log activity
    if (companyId) {
      logActivity(companyId, 'voice', 'transcription', { text, targetAgent });
    }

    // Broadcast the transcription as a user command event
    broadcast({
      type: 'voice:transcription',
      data: { text, agent: targetAgent, timestamp: Date.now(), companyId },
    });

    // Send to the targeted agent
    sendToAgent(targetAgent, text, companyId);

    res.json({ text, agent: targetAgent, companyId });
  } catch (err) {
    console.error('[voice] Transcription error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Voice: text -> speech audio (returns mp3)
app.post('/api/voice/speak', async (req, res) => {
  try {
    const { text, agent, companyId } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const companyContext = companyId ? companyManager.getCompany(companyId) : getCurrentCompanyContext();
    console.log(`[voice] Speaking as ${agent || 'main'} for ${companyContext.name}: "${text.slice(0, 80)}..."`);
    
    // Get voice from company agent config
    const agentConfig = companyContext.agentConfig?.[agent === 'main' ? 'director' : agent === 'claw-1' ? 'content' : 'scout'];
    const voiceId = agentConfig?.voice || 'onyx';
    
    const audioBuffer = await speak(text, agent || 'main', voiceId);

    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  } catch (err) {
    console.error('[voice] TTS error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// WebSocket server
const wss = new WebSocketServer({ server });

// Track company context per WebSocket connection
const clientCompanyMap = new WeakMap();

wss.on('connection', (ws) => {
  console.log(`[ws] Client connected (total: ${wss.clients.size})`);

  // Send current status on connect
  const activeCompany = companyManager.getActiveCompany();
  ws.send(JSON.stringify({
    type: 'status',
    data: { 
      ...bridge.getStatus(), 
      voiceEnabled: !!config.cartesiaApiKey,
      multiTenant: true,
      activeCompany: activeCompany ? {
        id: activeCompany.id,
        name: activeCompany.name,
        colors: activeCompany.colors
      } : null
    },
  }));

  ws.on('close', () => {
    console.log(`[ws] Client disconnected (total: ${wss.clients.size})`);
  });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'switch_company' && data.companyId) {
        // Handle company switch via WebSocket
        const company = companyManager.setActiveCompany(data.companyId);
        clientCompanyMap.set(ws, company.id);
        broadcast({
          type: 'company:switched',
          data: {
            companyId: company.id,
            companyName: company.name,
            colors: company.colors
          }
        });
        console.log(`[ws] Client switched to company: ${company.id}`);
      }
    } catch (err) {
      console.error('[ws] Error parsing message:', err.message);
    }
  });
});

function broadcast(msg) {
  const payload = JSON.stringify(msg);

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

// Make broadcast available for external use (OpenClaw agent)
export { broadcast, wss };

// OpenClaw Bridge
const bridge = new OpenClawBridge();

bridge.on('connected', (info) => {
  console.log(`[bridge] Connected (${info.mode} mode)`);
  broadcast({ type: 'bridge:connected', data: info });
});

bridge.on('disconnected', () => {
  broadcast({ type: 'bridge:disconnected' });
});

bridge.on('event', (event) => {
  // Add company context to bridge events if available
  const activeCompany = companyManager.getActiveCompany();
  if (activeCompany && event.data) {
    event.data.companyId = activeCompany.id;
  }
  broadcast(event);
});

// Start
server.listen(config.port, '0.0.0.0', () => {
  const proto = useHttps ? 'https' : 'http';
  console.log(`[server] OpenClaw Marketing Hub running on ${proto}://0.0.0.0:${config.port}`);
  console.log(`[server] TLS: ${useHttps ? 'ENABLED' : 'DISABLED (no cert.pem/key.pem)'}`);
  console.log(`[server] Voice: ${config.chatProxyUrl ? 'ENABLED (Cartesia via chat-proxy)' : 'DISABLED (set CHAT_PROXY_URL in .env)'}`);
  console.log(`[server] Multi-tenant: ENABLED (${companyManager.getAllCompanies().length} companies loaded)`);
  bridge.start();
});
