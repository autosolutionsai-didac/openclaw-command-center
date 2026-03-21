// Voice recording + playback module
// Uses Web Speech API for STT (free, no API key needed)
// Sends to server for TTS playback

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let onTranscription = null; // callback(text)
let silenceTimer = null;
let targetAgent = 'main';

const MAX_RECORD_SECONDS = 30;  // Increased from 15s to 30s
const MIN_RECORD_SECONDS = 2;   // Minimum recording time before auto-stop

// Web Speech API recognition
let recognition = null;
let speechResult = '';

export function init(opts = {}) {
  onTranscription = opts.onTranscription || null;
  
  // Initialize Web Speech API for STT (Chrome/Chromium only)
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        }
      }
      if (finalTranscript) {
        speechResult = finalTranscript;
        console.log('[voice] Speech recognition:', speechResult);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('[voice] Speech recognition error:', event.error);
    };
    
    console.log('[voice] Web Speech API initialized');
  } else {
    console.warn('[voice] Web Speech API not supported, falling back to server STT');
  }
}

export function getIsRecording() {
  return isRecording;
}

export function setTargetAgent(agentId) {
  targetAgent = agentId || 'main';
}

export function getTargetAgent() {
  return targetAgent;
}

export async function startRecording() {
  if (isRecording) return;
  
  speechResult = ''; // Reset speech result
  
  // Try Web Speech API first (free, no API key)
  if (recognition) {
    try {
      recognition.start();
      isRecording = true;
      console.log('[voice] Started Web Speech API recognition');
      
      // Auto-stop after max duration (but don't stop on brief pauses)
      silenceTimer = setTimeout(() => {
        if (isRecording) {
          console.log('[voice] Max duration reached, stopping');
          stopRecording();
        }
      }, MAX_RECORD_SECONDS * 1000);
      
      return;
    } catch (err) {
      console.error('[voice] Web Speech API failed:', err);
      // Fall through to MediaRecorder
    }
  }
  
  // Fallback: MediaRecorder for server-side STT
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      // Stop all tracks
      stream.getTracks().forEach(t => t.stop());
      clearTimeout(silenceTimer);

      if (audioChunks.length === 0) return;

      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      await sendToServer(blob);
    };

    mediaRecorder.start(250); // collect in 250ms chunks
    isRecording = true;

    // Auto-stop after max duration
    silenceTimer = setTimeout(() => {
      if (isRecording) stopRecording();
    }, MAX_RECORD_SECONDS * 1000);

  } catch (err) {
    console.error('[voice] Mic access denied:', err);
    isRecording = false;
  }
}

export function stopRecording() {
  if (!isRecording) return;
  
  // Stop Web Speech API
  if (recognition && isRecording) {
    recognition.stop();
    console.log('[voice] Stopped Web Speech API');
    
    // Use the speech result
    if (speechResult && onTranscription) {
      onTranscription(speechResult, targetAgent);
    } else if (!speechResult) {
      console.warn('[voice] No speech detected');
    }
    
    clearTimeout(silenceTimer);
    isRecording = false;
    return;
  }
  
  // Stop MediaRecorder
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  clearTimeout(silenceTimer);
  isRecording = false;
}

export async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
  return isRecording;
}

async function sendToServer(blob) {
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  form.append('targetAgent', targetAgent);

  // Reset target after sending
  const sentTo = targetAgent;
  targetAgent = 'main';

  try {
    const res = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const data = await res.json();
    if (onTranscription && data.text) {
      onTranscription(data.text, sentTo);
    }
  } catch (err) {
    console.error('[voice] Transcription failed:', err.message);
  }
}

export default {
  init,
  getIsRecording,
  setTargetAgent,
  getTargetAgent,
  startRecording,
  stopRecording,
  toggleRecording,
};
