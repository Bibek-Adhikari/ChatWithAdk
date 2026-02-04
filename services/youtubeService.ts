
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
    const response = await fetch(`${YOUTUBE_API_URL}?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = await response.json();
    const item = data.items?.[0];

    if (item) {
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url,
        channelTitle: item.snippet.channelTitle
      };
    }

    return null;
  } catch (error) {
    console.error('YouTube Search Error:', error);
    return null;
  }
}
