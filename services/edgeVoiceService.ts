const DEFAULT_EDGE_TTS_URL = 'https://bibekadk-chatadk.hf.space';
export const EDGE_TTS_BASE_URL = (import.meta.env.VITE_EDGE_TTS_URL || DEFAULT_EDGE_TTS_URL)
  .replace(/\/+$/, '');

const EDGE_VOICES_TIMEOUT_MS = 1500;

type EdgeVoiceRecord = {
  ShortName?: string;
  shortName?: string;
  Id?: string;
  id?: string;
};

export const fetchEdgeVoiceIds = async (): Promise<string[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EDGE_VOICES_TIMEOUT_MS);
  try {
    const response = await fetch(`${EDGE_TTS_BASE_URL}/voices`, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error('Voice server unavailable');
    }
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    const ids = data
      .map((voice: EdgeVoiceRecord) => voice.ShortName || voice.shortName || voice.Id || voice.id || '')
      .filter((id: string) => typeof id === 'string' && id.length > 0);
    return Array.from(new Set(ids));
  } finally {
    clearTimeout(timeoutId);
  }
};
