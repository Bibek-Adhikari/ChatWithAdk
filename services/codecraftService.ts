
import { proxyPost } from './serverProxy';
import { extractThinking, ModelResponse } from './modelThinking';
import { DEFAULT_CRAFT_MODEL as DEFAULT_CODECRAFT_MODEL } from './codecraftModels';

export { DEFAULT_CODECRAFT_MODEL };

export interface CodecraftMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const CODECRAFT_BASE_URL =
  (import.meta as any).env?.VITE_CODECRAFT_BASE_URL || 'https://codecraftapi.com/v1';



export async function generateCodecraftResponse(
  prompt: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  model: string = DEFAULT_CODECRAFT_MODEL
): Promise<ModelResponse> {
  // Format history for CodeCraft (OpenAI format — provider is OpenAI-compatible)
  const messages: CodecraftMessage[] = [
    {
      role: 'system',
      content: "You are Tufan (Craft Mode). Be helpful, direct, and concise. If the user pastes 'LATEST NEWS DATA', treat it as the source of truth for 2025-2026 facts, overriding training data."
    },
    ...history.map(h => ({
      role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: h.parts.map(p => p.text).join('\n')
    })),
    { role: 'user', content: prompt }
  ];

  // Prefer the metered server proxy (per-user daily quota, key stays server-side)
  try {
    const proxied = await proxyPost<{ text: string; thinking?: string }>('/chat', {
      engine: 'codecraft', model, messages, temperature: 0.7, max_tokens: 4096,
    }).catch(() => null);
    if (proxied) {
      if (proxied.status === 200 && typeof proxied.json?.text === 'string') {
        return {
          text: proxied.json.text,
          thinking: typeof proxied.json.thinking === 'string' ? proxied.json.thinking : undefined,
        };
      }
      if (proxied.status === 429) throw new Error(proxied.json?.error || 'Daily chat limit reached. Upgrade to Pro.');
      // other server errors → fall through to direct key below
    }
  } catch (e: any) {
    if (e?.message?.includes('Daily chat limit')) throw e;
    // unreachable server → direct fallback below
  }

  const apiKey = (import.meta as any).env?.VITE_CODECRAFT_API_KEY;
  if (!apiKey) {
    throw new Error('CodeCraft API Key not found. Please add VITE_CODECRAFT_API_KEY to your .env file.');
  }

  try {
    const response = await fetch(`${CODECRAFT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 4096 }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `CodeCraft API error: ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.choices[0]?.message;
    return {
      text: message?.content || '',
      thinking: extractThinking(message),
    };
  } catch (error: any) {
    console.error('CodeCraft API Error:', error);
    throw error;
  }
}
