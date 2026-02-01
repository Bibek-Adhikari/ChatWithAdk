
export type MessageRole = 'user' | 'assistant';

export interface MessagePart {
  type: 'text' | 'image';
  content: string;
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
  isGeneratingImage: boolean;
  error: string | null;
}
