
import { proxyPost } from './serverProxy';

export interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function generateGroqResponse(
  prompt: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('Groq API Key not found. Please add VITE_GROQ_API_KEY to your .env.local file.');
  }

  // Format history for Groq (OpenAI format)
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: "You are ChatADK (Fast Mode). Today is February 2026. \n\n1. Use 'LATEST NEWS DATA' as your absolute source for 2025-2026 facts. \n2. If the news data is from 2026 but doesn't name a leader, DON'T use your pre-2024 knowledge. State clearly that recent news is available but doesn't mention the name. \n3. If a name IS mentioned in the news as the current official, that is the only correct answer."
    },
    ...history.map(h => ({
      role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: h.parts.map(p => p.text).join('\n')
    })),
    { role: 'user', content: prompt }
  ];

  // Prefer the metered server proxy (per-user daily quota, key stays server-side)
  try {
    const proxied = await proxyPost<{ text: string }>('/chat', {
      engine: 'groq', model: 'openai/gpt-oss-120b', messages, temperature: 0.7, max_tokens: 4096,
    }).catch(() => null);
    if (proxied) {
      if (proxied.status === 200 && typeof proxied.json?.text === 'string') return proxied.json.text;
      if (proxied.status === 429) throw new Error(proxied.json?.error || 'Daily chat limit reached. Upgrade to Pro.');
      // other server errors → fall through to direct key below
    }
  } catch (e: any) {
    if (e?.message?.includes('Daily chat limit')) throw e;
    // unreachable server → direct fallback below
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', // Groq flagship (llama-3.3-70b-versatile was retired Aug 2026)
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Groq API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('Groq API Error:', error);
    throw error;
  }
}
