import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { nightOwl, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatMessage } from '../types';
import { Copy, Check, CornerDownLeft, Volume2, VolumeX, Pause, Play } from 'lucide-react';
import remarkGfm from 'remark-gfm';

interface ChatMessageItemProps {
  message: ChatMessage;
  onImageClick?: (url: string) => void;
  theme?: 'light' | 'dark';
  onReusePrompt?: (text: string) => void; // New callback for reusing prompt
  selectedVoiceURI?: string;
  isAuthenticated?: boolean;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ 
  message, 
  onImageClick, 
  theme = 'dark',
  onReusePrompt,
  selectedVoiceURI,
  isAuthenticated = false 
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleReusePrompt = () => {
    const allText = (message.parts || [])
      .filter(p => p.type === 'text')
      .map(p => p.content)
      .join('\n');
    
    if (allText && onReusePrompt) {
      onReusePrompt(allText);
    }
  };

  // Text-to-Speech functionality
  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in your browser');
      return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Try to use the user-selected voice
    const voices = window.speechSynthesis.getVoices();
    if (selectedVoiceURI) {
      const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
    } else {
      // Smart Fallback: Detect if text is likely Nepali/Hindi (Devanagari script)
      const isDevanagari = /[\u0900-\u097F]/.test(text);
      
      if (isDevanagari) {
        const regionalVoice = voices.find(v => v.lang.startsWith('ne') || v.lang.startsWith('hi'));
        if (regionalVoice) {
          utterance.voice = regionalVoice;
          utterance.lang = regionalVoice.lang;
        }
      } else {
        // Find a good high-quality English voice
        const preferredVoice = voices.find(v => 
          v.name.includes('Google') || 
          v.name.includes('Samantha') || 
          v.name.includes('Daniel') ||
          v.lang === 'en-US'
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          utterance.lang = preferredVoice.lang;
        }
      }
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      speechRef.current = null;
    };

    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [selectedVoiceURI]);

  const toggleSpeech = () => {
    const allText = (message.parts || [])
      .filter(p => p.type === 'text')
      .map(p => p.content)
      .join('\n');

    if (!allText) return;

    if (isSpeaking) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      // Clean text for speech (remove markdown syntax for better flow)
      const cleanText = allText
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/```[\s\S]*?```/g, 'Code block omitted.') // Remove code blocks
        .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1') // Remove bold/italic
        .replace(/>\s/g, '') // Remove blockquote
        .replace(/-\s/g, '') // Remove list markers
        .replace(/\|/g, ' ') // Remove table pipes
        .replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g, '') // Remove emojis
        .replace(/\n+/g, ' ') // Replace newlines with space
        .trim();
      
      speakText(cleanText);
    }
  };

  const stopSpeech = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speechRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
              overflowX: 'auto',
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

  // Check if message has text content to reuse
  const hasTextContent = (message.parts || []).some(p => p.type === 'text');
  const allText = (message.parts || [])
    .filter(p => p.type === 'text')
    .map(p => p.content)
    .join('\n');

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-8 w-full animate-slide-up`}>
      <div className={`flex items-start gap-3 max-w-[92%] sm:max-w-[85%]`}>
        {!isUser && (
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-lg shadow-blue-500/10">
            <img src="/assets/logo.webp" alt="ChatADK" className="w-full h-full object-cover" />
          </div>
        )}
        
        <div className="flex flex-col gap-2 w-full">
          {/* Audio Player Bar - Shows when speaking */}
          {isSpeaking && isAssistant && (
            <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl mb-2 animate-fadeIn ${
              theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 items-end h-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`w-1 bg-blue-500 rounded-full animate-pulse`}
                      style={{
                        height: `${Math.random() * 16 + 4}px`,
                        animationDelay: `${i * 0.1}s`
                      }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
                  {isPaused ? 'Paused' : 'Reading...'}
                </span>
              </div>
              <div className="flex-1" />
              <button
                onClick={toggleSpeech}
                className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play size={14} className="text-blue-500" /> : <Pause size={14} className="text-blue-500" />}
              </button>
              <button
                onClick={stopSpeech}
                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                title="Stop"
              >
                <VolumeX size={14} className="text-red-500" />
              </button>
            </div>
          )}
          {(message.parts || []).map((part, idx) => (
            <div key={idx} className="w-full relative group/message">
              {part.type === 'text' ? (
                <div 
                  className={`px-4 sm:px-6 py-4 rounded-[24px] text-[15px] leading-[1.6] chat-shadow markdown-content relative break-words overflow-hidden
                    ${isUser 
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-500/20' 
                      : theme === 'dark'
                        ? 'bg-slate-800/40 text-slate-100 rounded-tl-none border border-white/5 backdrop-blur-md'
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'}`}
                >
                  
                  
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
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
                      blockquote: ({ children }) => <blockquote className={`border-l-4 pl-4 py-1 italic mb-4 ${theme === 'dark' ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>{children}</blockquote>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-6 rounded-xl border border-white/5">
                          <table className="w-full text-sm border-collapse">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className={theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}>{children}</thead>,
                      th: ({ children }) => <th className={`px-4 py-3 text-left font-black uppercase tracking-widest text-[10px] border border-white/5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{children}</th>,
                      td: ({ children }) => <td className={`px-4 py-3 border border-white/5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{children}</td>,
                    }}
                  >
                    {part.content}
                  </ReactMarkdown>
                </div>
              ) : part.type === 'image' ? (
                <div 
                  className={`group relative overflow-hidden rounded-[24px] border border-white/5 shadow-2xl transition-all ${onImageClick ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
                  onClick={() => {
                    const url = part.content.startsWith('http') ? part.content : `data:${part.mimeType || 'image/jpeg'};base64,${part.content}`;
                    onImageClick?.(url);
                  }}
                >
                  <img 
                    src={part.content.startsWith('http') ? part.content : `data:${part.mimeType || 'image/jpeg'};base64,${part.content}`} 
                    alt="Process" 
                    className="w-full h-auto max-w-md object-cover rounded-[24px]"
                  />
                  {onImageClick && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                      <div className="flex flex-col items-center gap-2">
                        <i className="fas fa-expand text-white text-xl"></i>
                        <span className="text-[10px] text-white font-bold tracking-widest uppercase">Expand</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : part.type === 'video' ? (
                <div className="mt-4 relative group/video max-w-md rounded-[28px] overflow-hidden border border-white/10 shadow-2xl bg-black">
                  <video 
                    src={part.content} 
                    controls 
                    className="w-full h-auto block"
                    poster={part.metadata?.thumbnail}
                  />
                  <div className="absolute top-4 left-4 pointer-events-none">
                    <div className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2">
                       <i className="fas fa-video text-blue-400 text-[10px]"></i>
                       <span className="text-[9px] font-black uppercase tracking-widest text-white">Motion Gen</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`mt-2 rounded-2xl overflow-hidden border shadow-xl group/yt transition-all hover:scale-[1.01] max-w-sm
                  ${theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'}`}>
                  <a href={`https://www.youtube.com/watch?v=${part.content}`} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="relative aspect-video overflow-hidden">
                      <img src={part.metadata?.thumbnail} alt={part.metadata?.title} className="w-full h-full object-cover transition-transform group-hover/yt:scale-105" />
                      <div className="absolute inset-0 bg-black/20 group-hover/yt:bg-black/0 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-white shadow-xl shadow-red-600/30 transform group-hover/yt:scale-110 transition-all">
                          <i className="fas fa-play ml-1"></i>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className={`text-xs font-black uppercase tracking-widest mb-1 text-red-500`}>YouTube Reference</p>
                      <h4 className={`text-sm font-bold leading-tight line-clamp-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{part.metadata?.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-widest">{part.metadata?.channelTitle}</p>
                    </div>
                  </a>
                </div>
              )}
            </div>
          ))}
          <div className={`flex items-center gap-3 mt-2 px-2 ${isUser ? 'justify-end' : ''}`}>
             <div className="flex items-center gap-2 opacity-50">
               <div className="w-1 h-1 rounded-full bg-slate-500"></div>
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                 {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </span>
             </div>

              {/* Read Aloud Button - Only for assistant messages with text */}
              {isAssistant && hasTextContent && !isSpeaking && (
                <button
                  onClick={() => {
                    if (isAuthenticated) {
                      toggleSpeech();
                    } else {
                      // Trigger auth modal if not authenticated
                      const event = new CustomEvent('open-auth-modal', { detail: 'signin' });
                      window.dispatchEvent(event);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all active:scale-90 group/speak
                    ${theme === 'dark' 
                      ? 'hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400' 
                      : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'}`}
                  title={isAuthenticated ? "Read aloud" : "Login to listen"}
                >
                  {isAuthenticated ? (
                    <Volume2 size={12} className="group-hover/speak:scale-110 transition-transform" />
                  ) : (
                    <i className="fas fa-lock text-[10px] text-slate-500"></i>
                  )}
                  <span className="text-[9px] font-black uppercase tracking-widest">{isAuthenticated ? 'Read' : 'Locked'}</span>
                </button>
              )}

             {/* Reuse Prompt Button - Only show if there's text content and callback is provided */}
             {hasTextContent && onReusePrompt && (
               <button
                 onClick={handleReusePrompt}
                 className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all active:scale-90 group/reuse
                   ${theme === 'dark' 
                     ? 'hover:bg-blue-500/10 text-slate-500 hover:text-blue-400' 
                     : 'hover:bg-blue-50 text-slate-400 hover:text-blue-600'}`}
                 title="Use as new prompt"
               >
                 <CornerDownLeft size={12} className="group-hover/reuse:-rotate-12 transition-transform" />
                 <span className="text-[9px] font-black uppercase tracking-widest">Reuse</span>
               </button>
             )}

             {/* Unified Copy Button */}
             <button
               onClick={() => {
                 if (allText) handleCopy(allText);
               }}
               className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all active:scale-90
                 ${theme === 'dark' ? 'hover:bg-white/5 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
               title="Copy full message"
             >
               {copiedCode === allText ? (
                 <>
                   <Check size={12} className="text-emerald-500" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Copied</span>
                 </>
               ) : (
                 <>
                   <Copy size={12} />
                   <span className="text-[9px] font-black uppercase tracking-widest">Copy</span>
                 </>
               )}
             </button>
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