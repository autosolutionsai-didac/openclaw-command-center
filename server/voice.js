import OpenAI from 'openai';
import config from './config.js';

let openai = null;

function getClient() {
  if (!openai) {
    if (!config.openaiApiKey) {
      // Return null - server STT disabled, use client-side Web Speech API
      return null;
    }
    openai = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openai;
}

export async function transcribe(audioBuffer, filename = 'audio.webm') {
  const client = getClient();
  
  if (!client) {
    // Fallback: return demo text when no OpenAI key
    console.log('[voice] No OpenAI key, using demo transcription');
    return 'Demo: Voice command received (configure OpenAI API key for real STT)';
  }
  
  const file = new File([audioBuffer], filename, { type: 'audio/webm' });

  const result = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });

  return result.text;
}

// Agent → voice mapping
// Uses Cartesia voice IDs (via voice-cartesia.js)
const AGENT_VOICES = {
  'main': 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', // Brooke
  'claw-1': 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', // Brooke
  'claw-2': 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', // Brooke
};

export async function speak(text, agentId = 'main') {
  // This function is now deprecated - use voice-cartesia.js instead
  // Kept for backwards compatibility
  const client = getClient();
  
  if (!client) {
    throw new Error('No OpenAI key configured. Use voice-cartesia.js for TTS.');
  }
  
  const voice = AGENT_VOICES[agentId] || 'nova';

  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
    response_format: 'mp3',
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
