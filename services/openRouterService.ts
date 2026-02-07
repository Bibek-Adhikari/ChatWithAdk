
export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateResearchResponse(
  prompt: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OpenRouter API Key not found. Please add VITE_OPENROUTER_API_KEY to your .env.local file.');
  }

  const messages: OpenRouterMessage[] = [
    {
      role: 'system',
      content: "You are ChatADK (Research Mode). Today is February 2026. \n\n1. Evaluate 'LATEST NEWS DATA' analytically. It is provided because your training is pre-2024. \n2. If 2026 news articles are present, they override your internal database completely for current events. \n3. If no name is found in the news for a 2026 position, acknowledge the 2024 holder as 'likely outdated' and explain that 2026 news mentions the office but not the name."
    },
    ...history.map(h => ({
      role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: h.parts.map(p => p.text).join('\n')
    })),
    { role: 'user', content: prompt }
  ];

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://chatwithadk.com', // Optional
        'X-Title': 'ChatWithAdk', // Optional
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1', // Reasoning model perfect for research
        messages: messages,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('OpenRouter API Error:', error);
    throw error;
  }
}
