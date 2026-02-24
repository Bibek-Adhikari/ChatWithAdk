import { getVoiceById } from './voiceLibrary';

type VoiceMode = 'cloud' | 'browser';

interface SpeakHandlers {
  onStart?: (mode: VoiceMode) => void;
  onEnd?: (mode: VoiceMode) => void;
  onPause?: (mode: VoiceMode) => void;
  onResume?: (mode: VoiceMode) => void;
  onError?: (error: Error, mode: VoiceMode) => void;
}

interface SpeakOptions extends SpeakHandlers {
  selectedVoiceId?: string;
  cloudTimeoutMs?: number;
  coldStartWindowMs?: number;
  warmupWindowMs?: number;
  maxChunkChars?: number;
}

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let lastCloudSuccessAt = 0;
let warmupInFlight = false;
let warmupBypassUntil = 0;
let cancelCloudPlayback: (() => void) | null = null;
let activeMode: VoiceMode | null = null;
let browserSessionId = 0;
type EdgeHealthState = 'unknown' | 'up' | 'down';

const edgeHealthCache = new Map<string, { state: EdgeHealthState; checkedAt: number; inFlight?: Promise<'up' | 'down'> }>();

const DEFAULT_CLOUD_TIMEOUT_MS = 3000;
const DEFAULT_COLD_START_MS = 5 * 60 * 1000;
const DEFAULT_WARMUP_WINDOW_MS = 2 * 60 * 1000;
const DEFAULT_MAX_CHUNK_CHARS = 240;
const EDGE_HEALTH_TTL_MS = 30 * 1000;
const EDGE_HEALTH_TIMEOUT_MS = 1200;
const DEFAULT_NEPALI_VOICE = 'ne-NP-SagarNeural';
const DEFAULT_ENGLISH_VOICE = 'en-US-DarrenNeural';

const detectNepali = (text: string) => /[\u0900-\u097F]/.test(text);

type VoiceChunk = {
  text: string;
  isNepali: boolean;
  voiceCode: string;
};

const buildCloudUrl = (text: string, voiceCode: string) => {
  const url = new URL('https://bibekadk-chatadk.hf.space/speak');
  url.searchParams.set('text', text.trim());
  url.searchParams.set('voice', voiceCode);
  url.searchParams.set('rate', '+20%');
  return url.toString();
};

const getEdgeCache = (voiceCode: string) => {
  if (!edgeHealthCache.has(voiceCode)) {
    edgeHealthCache.set(voiceCode, { state: 'unknown', checkedAt: 0 });
  }
  return edgeHealthCache.get(voiceCode)!;
};

const markEdgeUp = (voiceCode: string) => {
  const entry = getEdgeCache(voiceCode);
  entry.state = 'up';
  entry.checkedAt = Date.now();
};

const markEdgeDown = (voiceCode: string) => {
  const entry = getEdgeCache(voiceCode);
  entry.state = 'down';
  entry.checkedAt = Date.now();
};

const checkEdgeHealth = async (voiceCode: string): Promise<'up' | 'down'> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EDGE_HEALTH_TIMEOUT_MS);
  try {
    const url = buildCloudUrl('ping', voiceCode || DEFAULT_ENGLISH_VOICE);
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.startsWith('audio/')) {
      markEdgeUp(voiceCode);
      return 'up';
    }
    markEdgeDown(voiceCode);
    return 'down';
  } catch {
    clearTimeout(timeoutId);
    markEdgeDown(voiceCode);
    return 'down';
  }
};

const ensureEdgeHealth = async (voiceCode: string): Promise<'up' | 'down' | 'unknown'> => {
  const entry = getEdgeCache(voiceCode);
  const isFresh = Date.now() - entry.checkedAt < EDGE_HEALTH_TTL_MS;
  if (entry.state !== 'unknown' && isFresh) return entry.state;
  if (entry.inFlight) return entry.inFlight;
  entry.inFlight = checkEdgeHealth(voiceCode).finally(() => {
    const freshEntry = getEdgeCache(voiceCode);
    delete freshEntry.inFlight;
  });
  return entry.inFlight;
};

const splitLongText = (text: string, maxChars: number) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const sentenceParts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const chunks: string[] = [];
  let buffer = '';

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed) chunks.push(trimmed);
    buffer = '';
  };

  for (const sentence of sentenceParts) {
    const next = buffer ? `${buffer} ${sentence}` : sentence;
    if (next.trim().length <= maxChars) {
      buffer = next.trim();
      continue;
    }

    if (buffer) flush();

    if (sentence.length <= maxChars) {
      chunks.push(sentence.trim());
      continue;
    }

    const words = sentence.split(' ');
    let wordBuffer = '';
    for (const word of words) {
      const candidate = wordBuffer ? `${wordBuffer} ${word}` : word;
      if (candidate.length <= maxChars) {
        wordBuffer = candidate;
      } else {
        if (wordBuffer) chunks.push(wordBuffer.trim());
        wordBuffer = word;
      }
    }
    if (wordBuffer) chunks.push(wordBuffer.trim());
  }

  flush();
  return chunks;
};

const stopCloudAudio = () => {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.src = '';
  currentAudio.load();
  currentAudio = null;
  if (activeMode === 'cloud') {
    activeMode = null;
  }
};

const stopBrowserSpeech = () => {
  browserSessionId += 1;
  if (!currentUtterance) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;
  if (activeMode === 'browser') {
    activeMode = null;
  }
};

const warmUpCloud = async (voiceCode: string, warmupWindowMs: number) => {
  if (warmupInFlight) return;
  warmupInFlight = true;
  const url = buildCloudUrl('warmup', voiceCode);
  warmupBypassUntil = Date.now() + warmupWindowMs;
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store' });
  } catch {
    // ignore warmup failures
  } finally {
    warmupInFlight = false;
  }
};

const waitForVoices = async (timeoutMs = 1200) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) return voices;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return window.speechSynthesis.getVoices();
};

const speakBrowser = async (chunks: VoiceChunk[], handlers: SpeakHandlers) => {
  if (!('speechSynthesis' in window)) {
    handlers.onError?.(new Error('Text-to-speech is not supported in your browser'), 'browser');
    return;
  }

  stopBrowserSpeech();

  const voices = await waitForVoices();
  const sessionId = ++browserSessionId;

  const buildUtterance = (chunk: VoiceChunk, useLang: boolean) => {
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (useLang) {
      if (chunk.isNepali) {
        const regionalVoice = voices.find(v => v.lang.startsWith('ne') || v.lang.startsWith('hi'));
        if (regionalVoice) {
          utterance.voice = regionalVoice;
          utterance.lang = regionalVoice.lang;
        } else {
          utterance.lang = 'ne-NP';
        }
      } else {
        const preferredVoice = voices.find(v =>
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Daniel') ||
          v.lang === 'en-US'
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          utterance.lang = preferredVoice.lang;
        } else {
          utterance.lang = 'en-US';
        }
      }
    }

    return utterance;
  };

  const speakChunk = (chunk: VoiceChunk, isFirst: boolean, useLang: boolean) =>
    new Promise<void>((resolve, reject) => {
      const utterance = buildUtterance(chunk, useLang);
      currentUtterance = utterance;

      if (isFirst) {
        utterance.onstart = () => {
          if (sessionId !== browserSessionId) return;
          activeMode = 'browser';
          handlers.onStart?.('browser');
        };
      }
      utterance.onpause = () => handlers.onPause?.('browser');
      utterance.onresume = () => handlers.onResume?.('browser');
      utterance.onerror = () => reject(new Error('Browser TTS error'));
      utterance.onend = () => resolve();

      window.speechSynthesis.speak(utterance);
    });

  for (let i = 0; i < chunks.length; i += 1) {
    if (sessionId !== browserSessionId) return;
    try {
      await speakChunk(chunks[i], i === 0, true);
    } catch {
      if (sessionId !== browserSessionId) return;
      window.speechSynthesis.cancel();
      await new Promise(resolve => setTimeout(resolve, 150));
      try {
        await speakChunk(chunks[i], i === 0, false);
      } catch (error) {
        handlers.onError?.(error instanceof Error ? error : new Error('Browser TTS error'), 'browser');
        return;
      }
    }
  }

  if (sessionId !== browserSessionId) return;
  handlers.onEnd?.('browser');
  currentUtterance = null;
  if (activeMode === 'browser') {
    activeMode = null;
  }
};

const createCloudCancel = () => {
  let cancel: () => void = () => {};
  const promise = new Promise<never>((_, reject) => {
    cancel = () => {
      stopCloudAudio();
      reject(new Error('Cloud playback cancelled'));
    };
  });
  return { promise, cancel };
};

const playCloudChunk = (
  chunk: VoiceChunk,
  timeoutMs: number,
  handlers: SpeakHandlers,
  onStart: () => void
) => {
  stopCloudAudio();
  const cloudUrl = buildCloudUrl(chunk.text, chunk.voiceCode);
  const audio = new Audio(cloudUrl);
  audio.preload = 'auto';
  currentAudio = audio;

  let started = false;
  let paused = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let aborted = false;

  const clearTimeoutSafe = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const markStarted = () => {
    if (aborted) return;
    if (!started) {
      started = true;
      activeMode = 'cloud';
      onStart();
      clearTimeoutSafe();
    }
  };

  audio.onplaying = () => {
    markStarted();
    if (paused) {
      paused = false;
      handlers.onResume?.('cloud');
    }
  };
  audio.ontimeupdate = () => {
    if (audio.currentTime > 0.05) {
      markStarted();
    }
  };
  audio.onpause = () => {
    if (started) {
      paused = true;
      handlers.onPause?.('cloud');
    }
  };

  const playCloud = new Promise<void>((resolve, reject) => {
    const fail = (err: Error) => {
      clearTimeoutSafe();
      reject(err);
    };
    const done = () => {
      clearTimeoutSafe();
      resolve();
    };

    audio.onerror = () => {
      stopCloudAudio();
      fail(new Error('Network/Server Error'));
    };
    audio.onended = () => done();

    audio.play()
      .catch(err => {
        stopCloudAudio();
        fail(err instanceof Error ? err : new Error('Audio play failed'));
      });
  });

  const forceFallback = new Promise<void>((_, reject) =>
    timeoutId = setTimeout(() => {
      aborted = true;
      stopCloudAudio();
      reject(new Error('Cloud Too Slow - Using Local Voice'));
    }, timeoutMs)
  );

  return Promise.race([playCloud, forceFallback]);
};

const speakCloud = async (
  chunks: VoiceChunk[],
  options: SpeakOptions,
  handlers: SpeakHandlers
): Promise<boolean> => {
  const timeoutMs = options.cloudTimeoutMs ?? DEFAULT_CLOUD_TIMEOUT_MS;
  const { promise: cancelPromise, cancel } = createCloudCancel();
  cancelCloudPlayback = cancel;

  let started = false;
  const handleStart = () => {
    if (!started) {
      started = true;
      handlers.onStart?.('cloud');
    }
  };

  try {
    for (const chunk of chunks) {
      await Promise.race([
        playCloudChunk(chunk, timeoutMs, handlers, handleStart),
        cancelPromise
      ]);
    }
    handlers.onEnd?.('cloud');
    lastCloudSuccessAt = Date.now();
    return started;
  } catch (error: any) {
    if (error && typeof error === 'object') {
      (error as any).cloudStarted = started;
    }
    throw error;
  } finally {
    if (cancelCloudPlayback === cancel) {
      cancelCloudPlayback = null;
    }
  }
};

const stop = () => {
  cancelCloudPlayback?.();
  cancelCloudPlayback = null;
  stopCloudAudio();
  stopBrowserSpeech();
};

const pause = () => {
  if (activeMode === 'cloud') {
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
    }
    return;
  }
  if (activeMode === 'browser') {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
    return;
  }
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
  }
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
  }
};

const resume = () => {
  if (activeMode === 'cloud') {
    if (currentAudio && currentAudio.paused) {
      currentAudio.play().catch(() => {});
    }
    return;
  }
  if (activeMode === 'browser') {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    return;
  }
  if (currentAudio && currentAudio.paused) {
    currentAudio.play().catch(() => {});
  }
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
};

const isColdStart = (coldStartWindowMs: number) => {
  if (!lastCloudSuccessAt) return true;
  return Date.now() - lastCloudSuccessAt > coldStartWindowMs;
};

const speak = async (text: string, options: SpeakOptions = {}) => {
  if (!text.trim()) return;

  const handlers: SpeakHandlers = {
    onStart: options.onStart,
    onEnd: options.onEnd,
    onPause: options.onPause,
    onResume: options.onResume,
    onError: options.onError
  };

  stop();

  const coldStartWindowMs = options.coldStartWindowMs ?? DEFAULT_COLD_START_MS;
  const warmupWindowMs = options.warmupWindowMs ?? DEFAULT_WARMUP_WINDOW_MS;
  const maxChunkChars = options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS;
  const rawChunks = splitLongText(text, maxChunkChars);
  if (!rawChunks.length) return;
  const preferredVoice = getVoiceById(options.selectedVoiceId);
  const chunks: VoiceChunk[] = rawChunks.map(chunkText => {
    const isNepaliChunk = detectNepali(chunkText);
    const preferredIsNepali = preferredVoice?.lang.startsWith('ne') || preferredVoice?.lang.startsWith('hi');
    const preferredMatches = preferredVoice
      ? (isNepaliChunk ? preferredIsNepali : !preferredIsNepali)
      : false;
    return {
      text: chunkText,
      isNepali: isNepaliChunk,
      voiceCode: preferredMatches
        ? preferredVoice!.id
        : isNepaliChunk
          ? DEFAULT_NEPALI_VOICE
          : DEFAULT_ENGLISH_VOICE
    };
  });

  const coldStart = isColdStart(coldStartWindowMs);
  if (coldStart) {
    warmUpCloud(chunks[0].voiceCode, warmupWindowMs).catch(() => {});
  }

  const primaryVoice = chunks[0]?.voiceCode || DEFAULT_ENGLISH_VOICE;
  const edgeHealth = await ensureEdgeHealth(primaryVoice);
  if (edgeHealth === 'down') {
    await speakBrowser(chunks, handlers);
    return;
  }

  let attempt = 0;
  while (attempt < 2) {
    try {
      await speakCloud(chunks, options, handlers);
      markEdgeUp(primaryVoice);
      return;
    } catch (error: any) {
      if (error?.message === 'Cloud playback cancelled') {
        return;
      }
      if (error?.cloudStarted) {
        return;
      }
      if (error?.message?.includes('Network/Server Error') || error?.message?.includes('Cloud Too Slow')) {
        markEdgeDown(primaryVoice);
      }
      handlers.onError?.(error, 'cloud');
      attempt += 1;
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }
      stopCloudAudio();
      await speakBrowser(chunks, handlers);
      return;
    }
  }
  return;

  /*
  // legacy single-try path
  try {
    await speakCloud(chunks, options, handlers);
  } catch (error: any) {
    if (error?.message === 'Cloud playback cancelled') {
      return;
    }
    handlers.onError?.(error, 'cloud');
    if (error?.cloudStarted) {
      return;
    }
    stopCloudAudio();
    await speakBrowser(chunks, handlers);
  }
  */
};

export const voiceWorkflow = {
  speak,
  stop,
  pause,
  resume,
};
