/**
 * Security-first TTS implementation
 *
 * IMPORTANT: Never put API keys directly in frontend code.
 * This service only uses Edge-TTS and the browser SpeechSynthesis API.
 */

import { EDGE_TTS_BASE_URL } from './edgeVoiceService';

const MAX_TEXT_LENGTH = 200;

type SpeechMode = 'edge-tts' | 'browser';

interface SpeakOptions {
  voiceId?: string;
  modelId?: string;
  onStart?: (mode: SpeechMode) => void;
  onEnd?: () => void;
  onError?: (error: Error, mode: SpeechMode) => void;
}

/**
 * Truncates text for TTS processing
 */
function truncateText(text: string, maxLength: number = MAX_TEXT_LENGTH): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Fetches audio from Edge-TTS service
 * Uses ne-NP-SagarNeural voice for Nepali
 */
async function fetchEdgeTTSAudio(text: string): Promise<AudioBuffer> {
  console.log('[TTS] Fetching Edge-TTS audio for:', text.substring(0, 50));
  
  const response = await fetch(`${EDGE_TTS_BASE_URL}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice: 'ne-NP-SagarNeural', // Nepali voice
    }),
  });

  console.log('[TTS] Edge-TTS response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[TTS] Edge-TTS error response:', errorText);
    throw new Error(`Edge-TTS failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log('[TTS] Edge-TTS received audio buffer, size:', arrayBuffer.byteLength);
  return await new AudioContext().decodeAudioData(arrayBuffer);
}

/**
 * Uses browser's native SpeechSynthesis API (Fallback 2)
 * No external API calls - works offline
 */
function speakWithBrowser(text: string, onEnd?: () => void): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Try to find a Nepali voice, fallback to default
  const voices = speechSynthesis.getVoices();
  const nepaliVoice = voices.find(v => 
    v.lang.startsWith('ne') || v.name.toLowerCase().includes('nepali')
  );
  
  if (nepaliVoice) {
    utterance.voice = nepaliVoice;
  }
  
  utterance.lang = 'ne-NP';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  
  if (onEnd) {
    utterance.onend = onEnd;
  }
  
  speechSynthesis.speak(utterance);
  return utterance;
}

/**
 * Main speech handler with automatic fallback chain:
 * 1. Edge-TTS → 2. Browser SpeechSynthesis
 */
export async function handleSpeech(
  text: string,
  options: SpeakOptions = {}
): Promise<void> {
  const {
    onStart,
    onEnd,
    onError,
  } = options;

  // Step 1: Truncate text if > 200 characters
  const processedText = truncateText(text, MAX_TEXT_LENGTH);
  
  console.log(`[TTS] Processing text (${text.length} chars → ${processedText.length} chars)`);

  // Step 2: Try Edge-TTS (Primary)
  try {
    console.log('[TTS] Attempting Edge-TTS API...');
    onStart?.('edge-tts');
    
    const audioBuffer = await fetchEdgeTTSAudio(processedText);
    
    // Play the audio - handle browser autoplay policy
    const audioContext = new AudioContext();
    
    // Resume context if suspended (required for autoplay policy)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
    
    source.onended = () => {
      console.log('[TTS] Edge-TTS playback completed');
      onEnd?.();
    };
    
    return;
  } catch (error: any) {
    console.warn(`[TTS] Edge-TTS failed: ${error.message}`);
    
    // Continue to Fallback (Browser SpeechSynthesis)
  }

  // Step 3: Fallback - Browser SpeechSynthesis
  try {
    console.log('[TTS] Falling back to Browser SpeechSynthesis...');
    onStart?.('browser');
    
    speakWithBrowser(processedText, () => {
      console.log('[TTS] Browser speech completed');
      onEnd?.();
    });
    
    return;
  } catch (error: any) {
    console.error(`[TTS] Browser speech failed: ${error.message}`);
    onError?.(error, 'browser');
    throw error;
  }
}

/**
 * Simple function to speak text with minimal options
 * Uses the full handleSpeech with defaults
 */
export async function speak(text: string): Promise<void> {
  return handleSpeech(text);
}

/**
 * Check if browser supports speech synthesis
 */
export function isBrowserSpeechSupported(): boolean {
  return 'speechSynthesis' in window;
}

export default handleSpeech;
