export const EDGE_TTS_BASE_URL = 'https://bibekadk-chatadk.hf.space';

type EdgeVoiceRecord = {
  ShortName?: string;
  shortName?: string;
  Id?: string;
  id?: string;
};

export const fetchEdgeVoiceIds = async (): Promise<string[]> => {
  const response = await fetch(`${EDGE_TTS_BASE_URL}/voices`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Voice server unavailable');
  }
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  const ids = data
    .map((voice: EdgeVoiceRecord) => voice.ShortName || voice.shortName || voice.Id || voice.id || '')
    .filter((id: string) => typeof id === 'string' && id.length > 0);
  return Array.from(new Set(ids));
};
