
import React from 'react';
import { ChatMessage } from '../types';

interface ChatMessageItemProps {
  message: ChatMessage;
  onImageClick?: (url: string) => void;
  theme?: 'light' | 'dark';
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, onImageClick, theme = 'dark' }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[75%]`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 mb-1">
            <i className="fas fa-robot text-xs"></i>
          </div>
        )}
        
        <div className="flex flex-col gap-2">
          {message.parts.map((part, idx) => (
            <div key={idx} className="w-full">
              {part.type === 'text' ? (
                <div 
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm
                    ${isUser 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : theme === 'dark'
                        ? 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                        : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-sm'}`}
                >
                  {part.content}
                </div>
              ) : (
                <div 
                  className={`group relative overflow-hidden rounded-2xl border-2 border-slate-700 shadow-xl transition-all ${onImageClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
                  onClick={() => onImageClick?.(part.content)}
                >
                  <img 
                    src={part.content} 
                    alt="Generated content" 
                    className="w-full h-auto max-w-[280px] object-cover aspect-square"
                  />
                  {onImageClick && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <i className="fas fa-expand text-white text-xl"></i>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <span className="text-[10px] text-slate-500 mt-1 px-1">
            {/* Fix: Convert string timestamp from ChatMessage to Date to call toLocaleTimeString */}
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {isUser && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 mb-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-400'}`}>
            <i className="fas fa-user text-xs"></i>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessageItem;
