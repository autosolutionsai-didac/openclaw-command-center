import config from './config.js';

// Cartesia voice mapping per agent role
const VOICE_MAP = {
  'main': 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', // Brooke (default)
  'director': 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', // Brooke - deep, authoritative
  'claw-1': 'b7d5c0e3-8f4a-4c9e-a1d2-3e5f6a7b8c9d', // TBD - clear, friendly (Content)
  'claw-2': 'c8e6d1f4-9a5b-4d0f-b2e3-4f6a7b8c9d0e', // TBD - warm, curious (Scout)
};

/**
 * Generate speech using Cartesia via chat-proxy
 * @param {string} text - Text to speak
 * @param {string} agent - Agent ID (main, claw-1, claw-2)
 * @param {string} [voiceId] - Optional override voice ID
 * @returns {Promise<Buffer>} - MP3 audio buffer
 */
export async function speak(text, agent = 'main', voiceId = null) {
  if (!config.chatProxyUrl) {
    throw new Error('Chat proxy URL not configured');
  }

  const voice = voiceId || VOICE_MAP[agent] || VOICE_MAP.main;
  
  console.log(`[cartesia] Speaking as ${agent} with voice ${voice.slice(0, 8)}...`);

  try {
    const response = await fetch(`${config.chatProxyUrl}/cartesia/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id: voice,
        format: 'mp3',
      }),
    });

    if (!response.ok) {
      throw new Error(`Cartesia API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.audio) {
      throw new Error('No audio data in Cartesia response');
    }

    // Decode base64 audio to buffer
    const audioBuffer = Buffer.from(result.audio, 'base64');
    console.log(`[cartesia] Generated ${audioBuffer.length} bytes of audio`);
    
    return audioBuffer;
  } catch (err) {
    console.error('[cartesia] TTS error:', err.message);
    throw err;
  }
}

/**
 * Transcribe audio using Whisper (via OpenAI for now)
 * TODO: Switch to Cartesia STT or our own Whisper instance
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribe(audioBuffer, filename = 'audio.webm') {
  if (!config.openaiApiKey && !process.env.OPENAI_API_KEY) {
    // Fallback: return demo text if no API key
    console.log('[transcribe] No API key, using demo transcription');
    return 'Demo: Hello, this is a test transcription.';
  }

  // Use OpenAI Whisper for now
  const { OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY });

  // Create a blob from the buffer
  const blob = new Blob([audioBuffer], { type: 'audio/webm' });
  const file = new File([blob], filename, { type: 'audio/webm' });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    return transcription.text;
  } catch (err) {
    console.error('[transcribe] Whisper error:', err.message);
    throw err;
  }
}

export default {
  speak,
  transcribe,
  VOICE_MAP,
};
