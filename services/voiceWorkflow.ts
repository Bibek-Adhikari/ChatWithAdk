type VoiceMode = 'cloud' | 'browser';

interface SpeakHandlers {
  onStart?: (mode: VoiceMode) => void;
  onEnd?: (mode: VoiceMode) => void;
  onPause?: (mode: VoiceMode) => void;
  onResume?: (mode: VoiceMode) => void;
  onError?: (error: Error, mode: VoiceMode) => void;
}

interface SpeakOptions extends SpeakHandlers {
  selectedVoiceURI?: string;
  cloudTimeoutMs?: number;
  coldStartWindowMs?: number;
  warmupWindowMs?: number;
  maxChunkChars?: number;
  preferBrowserOnColdStart?: boolean;
}

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let lastCloudSuccessAt = 0;
let warmupInFlight = false;
let warmupBypassUntil = 0;
let cancelCloudPlayback: (() => void) | null = null;
let activeMode: VoiceMode | null = null;

const DEFAULT_CLOUD_TIMEOUT_MS = 3000;
const DEFAULT_COLD_START_MS = 5 * 60 * 1000;
const DEFAULT_WARMUP_WINDOW_MS = 2 * 60 * 1000;
const DEFAULT_MAX_CHUNK_CHARS = 240;

const detectNepali = (text: string) => /[\u0900-\u097F]/.test(text);

type VoiceChunk = {
  text: string;
  isNepali: boolean;
  voiceCode: string;
};

const buildCloudUrl = (text: string, voiceCode: string) =>
  `https://bibekadk-chatadk.hf.space/speak?text=${encodeURIComponent(text)}&voice=${voiceCode}`;

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

const speakBrowser = (chunks: VoiceChunk[], options: SpeakOptions, handlers: SpeakHandlers) => {
  if (!('speechSynthesis' in window)) {
    handlers.onError?.(new Error('Text-to-speech is not supported in your browser'), 'browser');
    return;
  }

  stopBrowserSpeech();

  const voices = window.speechSynthesis.getVoices();
  const lastIndex = chunks.length - 1;

  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    currentUtterance = utterance;

    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (options.selectedVoiceURI) {
      const voice = voices.find(v => v.voiceURI === options.selectedVoiceURI);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
    } else if (chunk.isNepali) {
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

    if (index === 0) {
      utterance.onstart = () => {
        activeMode = 'browser';
        handlers.onStart?.('browser');
      };
    }
    utterance.onpause = () => handlers.onPause?.('browser');
    utterance.onresume = () => handlers.onResume?.('browser');
    utterance.onerror = () => handlers.onError?.(new Error('Browser TTS error'), 'browser');
    utterance.onend = () => {
      if (index === lastIndex) {
        handlers.onEnd?.('browser');
        currentUtterance = null;
        if (activeMode === 'browser') {
          activeMode = null;
        }
      }
    };

    window.speechSynthesis.speak(utterance);
  });
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
  currentAudio = audio;

  let started = false;
  let paused = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearTimeoutSafe = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  audio.onplay = () => {
    if (!started) {
      started = true;
      activeMode = 'cloud';
      onStart();
      clearTimeoutSafe();
    } else if (paused) {
      paused = false;
      handlers.onResume?.('cloud');
    }
  };
  audio.onpause = () => {
    if (started) {
      paused = true;
      handlers.onPause?.('cloud');
    }
  };

  const playCloud = new Promise<void>((resolve, reject) => {
    audio.oncanplaythrough = () => {
      audio
        .play()
        .catch(err => {
          clearTimeoutSafe();
          reject(err);
        });
    };
    audio.onerror = () => {
      clearTimeoutSafe();
      reject(new Error('Network/Server Error'));
    };
    audio.onended = () => {
      clearTimeoutSafe();
      resolve();
    };
  });

  const forceFallback = new Promise<void>((_, reject) =>
    timeoutId = setTimeout(() => {
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
  const preferBrowser = options.preferBrowserOnColdStart === true;
  const rawChunks = splitLongText(text, maxChunkChars);
  if (!rawChunks.length) return;
  const chunks: VoiceChunk[] = rawChunks.map(chunkText => {
    const isNepaliChunk = detectNepali(chunkText);
    return {
      text: chunkText,
      isNepali: isNepaliChunk,
      voiceCode: isNepaliChunk ? 'ne-NP-SagarNeural' : 'en-AU-KenNeural'
    };
  });

  const coldStart = isColdStart(coldStartWindowMs);
  const allowCloudAttemptAfterWarmup = warmupBypassUntil && Date.now() < warmupBypassUntil;

  if (preferBrowser && coldStart && !allowCloudAttemptAfterWarmup) {
    warmUpCloud(chunks[0].voiceCode, warmupWindowMs).catch(() => {});
    speakBrowser(chunks, options, handlers);
    return;
  }

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
    speakBrowser(chunks, options, handlers);
  }
};

export const voiceWorkflow = {
  speak,
  stop,
  pause,
  resume,
};
