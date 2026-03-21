import 'dotenv/config';

export default {
  port: parseInt(process.env.PORT || '3000', 10),
  gatewayUrl: process.env.GATEWAY_URL || 'ws://127.0.0.1:18789',
  gatewayToken: process.env.GATEWAY_TOKEN || '',
  demoMode: process.env.DEMO_MODE !== 'false',
  
  // Voice (Cartesia via chat-proxy)
  cartesiaApiKey: process.env.CARTESIA_API_KEY || '',
  cartesiaVoiceId: process.env.CARTESIA_VOICE_ID || '',
  chatProxyUrl: process.env.CHAT_PROXY_URL || 'https://chat.abos.work',
  
  // Late API
  lateApiKey: process.env.LATE_API_KEY || '',
  lateApiBase: process.env.LATE_API_BASE || 'https://getlate.dev/api/v1',
  
  // Weather
  weatherLocation: process.env.WEATHER_LOCATION || 'Barcelona,Spain',
  
  // Multi-tenant
  defaultCompany: process.env.DEFAULT_COMPANY || 'example',
  maxCompanies: parseInt(process.env.MAX_COMPANIES || '5', 10),
  
  // Database
  databasePath: process.env.DATABASE_PATH || './data/marketing-hub.db',
};
