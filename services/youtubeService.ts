
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

export async function searchYouTubeVideo(query: string): Promise<YouTubeVideo | null> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error('YouTube API Key not found.');
    return null;
  }

  try {
    const url = `${YOUTUBE_API_URL}?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;
    console.log('Fetching YouTube:', url.replace(apiKey, 'HIDDEN_KEY'));
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('YouTube API Error Details:', errorData);
      const reason = errorData.error?.message || response.statusText;
      throw new Error(`${response.status} - ${reason}`);
    }

    const data = await response.json();
    console.log('YouTube Response Data:', data);
    const item = data.items?.[0];

    if (item) {
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url,
        channelTitle: item.snippet.channelTitle
      };
    }

    console.warn('No items found in YouTube response');
    return null;
  } catch (error) {
    console.error('YouTube Search Exception:', error);
    throw error; // Throw so the caller knows it failed
  }
}
