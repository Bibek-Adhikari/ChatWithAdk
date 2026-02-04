
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
      content: "You are ChatADK (Fast Mode), a blazing fast and highly capable AI assistant developed by Bibek Adhikari. Provide detailed, helpful, and clear responses. Even though you are in 'Fast Mode', do not sacrifice depth or clarity for brevity. Explain things step-by-step when appropriate and ensure your answers are comprehensive."
    },
    ...history.map(h => ({
      role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: h.parts.map(p => p.text).join('\n')
    })),
    { role: 'user', content: prompt }
  ];

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // High quality and fast
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
