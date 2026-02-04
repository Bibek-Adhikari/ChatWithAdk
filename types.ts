
export type MessageRole = 'user' | 'assistant';

export interface MessagePart {
  type: 'text' | 'image' | 'youtube';
  content: string;
  mimeType?: string; // e.g. 'image/png', 'image/jpeg'
  metadata?: any; // For structured data like video titles/thumbs
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
  timestamp: string; // ISO string for better JSON serialization
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface GenerationState {
  isTyping: boolean;
  error: string | null;
}
