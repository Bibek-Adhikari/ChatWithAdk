
import { proxyPost } from './serverProxy';

const IMAGE_API_URL = import.meta.env.VITE_IMAGE_API_URL || 'https://backend.buildpicoapps.com/aero/run/image-generation-api?pk=v1-Z0FBQUFBQnBmeTlUS2lZdFVCSlQzWG1BTnN6ZXlpMTh6cExGZ2ZmWi1HQ3VRblNuRHg1SW5BOG9vdzdLdWd6U3RxYWw0REtiZkNycUxBQlZUV2o4MVVzUFpIZmFiVHBwZkE9PQ==';

export async function generateImageResponse(prompt: string): Promise<string> {
  try {
    // Prefer the metered server proxy (per-user daily quota)
    const proxied = await proxyPost<{ imageUrl: string }>('/image', { prompt }).catch(() => null);
    if (proxied) {
      if (proxied.status === 200 && proxied.json?.imageUrl) return proxied.json.imageUrl;
      if (proxied.status === 429) throw new Error(proxied.json?.error || 'Daily image limit reached. Upgrade to Pro.');
      // other server errors → fall through to direct key below
    }
    const response = await fetch(IMAGE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Image API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status === 'success' && data.imageUrl) {
      return data.imageUrl;
    } else {
      throw new Error(data.message || 'Failed to generate image');
    }
  } catch (error: any) {
    console.error('Image Generation Error:', error);
    throw error;
  }
}
