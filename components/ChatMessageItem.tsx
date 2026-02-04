
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { nightOwl, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatMessage } from '../types';
import { Copy, Check, MessageSquare } from 'lucide-react';

interface ChatMessageItemProps {
  message: ChatMessage;
  onImageClick?: (url: string) => void;
  theme?: 'light' | 'dark';
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, onImageClick, theme = 'dark' }) => {
  const isUser = message.role === 'user';
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');

    if (!inline && match) {
      return (
        <div className={`relative group my-4 rounded-xl overflow-hidden border shadow-2xl transition-all
          ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
          <div className={`flex items-center justify-between px-4 py-2 border-b
            ${theme === 'dark' ? 'bg-slate-800/80 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{match[1]}</span>
            <button
              onClick={() => handleCopy(codeString)}
              className={`flex items-center gap-1.5 transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {copiedCode === codeString ? (
                <>
                  <Check size={12} className="text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Copy</span>
                </>
              )}
            </button>
          </div>
          <SyntaxHighlighter
            style={theme === 'dark' ? nightOwl : oneLight}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '1.25rem',
              fontSize: '13.5px',
              backgroundColor: theme === 'dark' ? '#011627' : '#fafafa',
              lineHeight: '1.5',
            }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }
    return (
      <code className={`${className} ${theme === 'dark' ? 'bg-slate-800/50 text-blue-400' : 'bg-slate-100 text-blue-600'} px-1.5 py-0.5 rounded text-sm font-mono`} {...props}>
        {children}
      </code>
    );
  };

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-8 w-full animate-slide-up`}>
      <div className={`flex items-start gap-3 max-w-[92%] sm:max-w-[85%]`}>
        {!isUser && (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20">
            <i className="fas fa-brain text-xs"></i>
          </div>
        )}
        
        <div className="flex flex-col gap-2">
          {message.parts.map((part, idx) => (
            <div key={idx} className="w-full relative group/message">
              {part.type === 'text' ? (
                <div 
                  className={`px-6 py-4 rounded-[24px] text-[15px] leading-[1.6] chat-shadow markdown-content relative
                    ${isUser 
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none shadow-blue-500/20' 
                      : theme === 'dark'
                        ? 'bg-slate-800/40 text-slate-100 rounded-tl-none border border-white/5 backdrop-blur-md'
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'}`}
                >
                  {/* Global Message Copy Button */}
                  {!isUser && (
                    <button
                      onClick={() => handleCopy(part.content)}
                      className={`absolute top-4 right-4 p-2 rounded-lg opacity-0 group-hover/message:opacity-100 transition-all active:scale-90
                        ${theme === 'dark' ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                      title="Copy full response"
                    >
                      {copiedCode === part.content ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  )}
                  
                  <ReactMarkdown
                    components={{
                      code: CodeBlock,
                      p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc ml-4 mb-4 space-y-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-4 mb-4 space-y-2">{children}</ol>,
                      li: ({ children }) => <li className="pl-1">{children}</li>,
                      h1: ({ children }) => <h1 className={`text-xl font-black mb-4 uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{children}</h1>,
                      h2: ({ children }) => <h2 className={`text-lg font-black mb-3 uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{children}</h2>,
                      h3: ({ children }) => <h3 className={`text-md font-black mb-2 uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{children}</h3>,
                      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className={`${theme === 'dark' ? 'text-blue-400 decoration-blue-400/30' : 'text-blue-600 decoration-blue-600/30'} underline underline-offset-4 hover:decoration-blue-400 transition-all`}>{children}</a>,
                      blockquote: ({ children }) => <blockquote className={`border-l-4 pl-4 py-1 italic mb-4 ${theme === 'dark' ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>{children}</blockquote>
                    }}
                  >
                    {part.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div 
                  className={`group relative overflow-hidden rounded-[24px] border border-white/5 shadow-2xl transition-all ${onImageClick ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
                  onClick={() => onImageClick?.(part.content)}
                >
                  <img 
                    src={part.content} 
                    alt="Process" 
                    className="w-full h-auto max-w-md object-cover"
                  />
                  {onImageClick && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                      <i className="fas fa-expand text-white text-xl"></i>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className={`flex items-center gap-2 mt-2 px-2 opacity-50 ${isUser ? 'justify-end' : ''}`}>
             <div className="w-1 h-1 rounded-full bg-slate-500"></div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
               {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </span>
          </div>
        </div>

        {isUser && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-200'}`}>
            <i className="fas fa-user text-xs"></i>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessageItem;
