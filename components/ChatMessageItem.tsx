import React, { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatMessage } from '../types';
import { Copy, Check, RotateCcw, Volume2, Pause, Play, Square } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import { voiceWorkflow } from '../services/voiceWorkflow';

interface ChatMessageItemProps {
  message: ChatMessage;
  onImageClick?: (url: string) => void;
  theme?: 'light' | 'dark';
  onReusePrompt?: (text: string) => void;
  selectedVoiceId?: string;
  isAuthenticated?: boolean;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  onImageClick,
  theme = 'dark',
  onReusePrompt,
  selectedVoiceId,
  isAuthenticated = false
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isDark = theme === 'dark';
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

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
    if (allText && onReusePrompt) onReusePrompt(allText);
  };

  const speakText = useCallback((text: string) => {
    voiceWorkflow.speak(text, {
      selectedVoiceId,
      onStart: () => { setIsSpeaking(true); setIsPaused(false); setIsBuffering(false); },
      onPause: () => setIsPaused(true),
      onResume: () => setIsPaused(false),
      onEnd: () => { setIsSpeaking(false); setIsPaused(false); setIsBuffering(false); },
      onError: () => { setIsBuffering(false); setIsSpeaking(false); setIsPaused(false); }
    });
  }, [selectedVoiceId]);

  const toggleSpeech = () => {
    const allText = (message.parts || []).filter(p => p.type === 'text').map(p => p.content).join('\n');
    if (!allText) return;
    if (isSpeaking) {
      if (isPaused) { voiceWorkflow.resume(); setIsPaused(false); }
      else { voiceWorkflow.pause(); setIsPaused(true); }
    } else {
      const cleanText = allText
        .replace(/#{1,6}\s/g, '')
        .replace(/```[\s\S]*?```/g, 'Code block omitted.')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
        .replace(/>\s/g, '').replace(/-\s/g, '').replace(/\|/g, ' ')
        .replace(/\n+/g, ' ').trim();
      setIsSpeaking(true); setIsPaused(false); setIsBuffering(true);
      speakText(cleanText);
    }
  };

  const stopSpeech = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    voiceWorkflow.stop();
    setIsSpeaking(false); setIsPaused(false); setIsBuffering(false);
  };

  useEffect(() => () => { voiceWorkflow.stop(); }, []);

  const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    if (!inline && match) {
      return (
        <div className={`my-3 rounded-xl overflow-hidden border ${isDark ? 'border-white/10 bg-[#0d0d0d]' : 'border-black/[0.08] bg-[#f7f7f8]'}`}>
          <div className={`flex items-center justify-between px-3.5 py-2 ${isDark ? 'bg-white/[0.03] border-b border-white/[0.06]' : 'bg-black/[0.02] border-b border-black/[0.06]'}`}>
            <span className={`text-[11.5px] font-medium ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>{match[1]}</span>
            <button
              onClick={() => handleCopy(codeString)}
              className={`flex items-center gap-1.5 text-[11.5px] font-medium transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              {copiedCode === codeString ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy code</>}
            </button>
          </div>
          <SyntaxHighlighter
            style={isDark ? oneDark : oneLight}
            language={match[1]}
            PreTag="div"
            customStyle={{ margin: 0, padding: '14px 16px', fontSize: '13px', lineHeight: '1.65', background: 'transparent', overflowX: 'auto' }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }
    return (
      <code className={`px-1.5 py-0.5 rounded-md text-[0.88em] font-mono ${isDark ? 'bg-white/10 text-neutral-200' : 'bg-black/[0.06] text-neutral-800'}`} {...props}>
        {children}
      </code>
    );
  };

  const hasTextContent = (message.parts || []).some(p => p.type === 'text');
  const allText = (message.parts || []).filter(p => p.type === 'text').map(p => p.content).join('\n');

  /* ---------- USER: right-aligned bubble like DeepSeek/Claude ---------- */
  if (isUser) {
    return (
      <div className="flex flex-col items-end w-full mb-5 animate-slide-up group">
        <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-[14.5px] leading-relaxed break-words
          ${isDark ? 'bg-[#2f2f2f] text-[#ececec]' : 'bg-[#f4f4f4] text-neutral-900'}`}>
          {(message.parts || []).map((part, idx) => (
            <div key={idx}>
              {part.type === 'text' ? (
                <div className="whitespace-pre-wrap">{part.content}</div>
              ) : part.type === 'image' ? (
                <img
                  src={part.content.startsWith('http') ? part.content : `data:${part.mimeType || 'image/jpeg'};base64,${part.content}`}
                  alt="Upload"
                  className="mt-2 rounded-xl max-w-full h-auto cursor-pointer"
                  onClick={() => {
                    const url = part.content.startsWith('http') ? part.content : `data:${part.mimeType || 'image/jpeg'};base64,${part.content}`;
                    onImageClick?.(url);
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-1 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasTextContent && onReusePrompt && (
            <button onClick={handleReusePrompt} title="Reuse prompt"
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5' : 'text-neutral-400 hover:text-neutral-600 hover:bg-black/5'}`}>
              <RotateCcw size={13} />
            </button>
          )}
          <button onClick={() => { if (allText) handleCopy(allText); }} title="Copy"
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5' : 'text-neutral-400 hover:text-neutral-600 hover:bg-black/5'}`}>
            {copiedCode === allText ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- ASSISTANT: plain full-width like Claude ---------- */
  return (
    <div className="flex flex-col w-full mb-6 animate-slide-up group/message">
      <div className="flex items-start gap-3 w-full">
        <img src="/assets/logo.webp" alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 border border-black/10 dark:border-white/10" />
        <div className="flex-1 min-w-0">
          {(isSpeaking || isBuffering) && (
            <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl mb-2 text-[12.5px] ${isDark ? 'bg-white/[0.04] text-neutral-400' : 'bg-black/[0.03] text-neutral-500'}`}>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current thinking-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-current thinking-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-current thinking-dot" />
              </span>
              {isPaused ? 'Paused' : isBuffering ? 'Loading audio…' : 'Reading aloud…'}
              <span className="flex-1" />
              <button onClick={toggleSpeech} className="p-1 hover:opacity-70" title={isPaused ? 'Resume' : 'Pause'}>
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
              </button>
              <button onClick={stopSpeech} className="p-1 hover:opacity-70" title="Stop">
                <Square size={12} />
              </button>
            </div>
          )}

          {(message.parts || []).map((part, idx) => (
            <div key={idx} className="w-full">
              {part.type === 'text' ? (
                <div className={`text-[14.5px] leading-[1.75] markdown-content ${isDark ? 'text-[#ececec]' : 'text-neutral-800'}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code: CodeBlock,
                      p: ({ children }) => <p>{children}</p>,
                      ul: ({ children }) => <ul className="list-disc">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal">{children}</ol>,
                      h1: ({ children }) => <h1 className={isDark ? 'text-white' : 'text-neutral-900'}>{children}</h1>,
                      h2: ({ children }) => <h2 className={isDark ? 'text-white' : 'text-neutral-900'}>{children}</h2>,
                      h3: ({ children }) => <h3 className={isDark ? 'text-white' : 'text-neutral-900'}>{children}</h3>,
                      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#4d6bfe]">{children}</a>,
                      blockquote: ({ children }) => <blockquote>{children}</blockquote>,
                      table: ({ children }) => (
                        <div className={`overflow-x-auto my-3 rounded-xl border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                          <table className="w-full text-[13.5px] border-collapse">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className={isDark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'}>{children}</thead>,
                      th: ({ children }) => <th className={`px-3 py-2 text-left font-medium border-b ${isDark ? 'border-white/10 text-neutral-400' : 'border-black/10 text-neutral-500'}`}>{children}</th>,
                      td: ({ children }) => <td className={`px-3 py-2 border-b ${isDark ? 'border-white/[0.05]' : 'border-black/[0.05]'}`}>{children}</td>,
                    }}
                  >
                    {part.content}
                  </ReactMarkdown>
                </div>
              ) : part.type === 'image' ? (
                <img
                  src={part.content.startsWith('http') ? part.content : `data:${part.mimeType || 'image/jpeg'};base64,${part.content}`}
                  alt="Generated"
                  className="rounded-2xl w-full max-w-md h-auto mt-2 cursor-pointer border border-black/10 dark:border-white/10"
                  onClick={() => {
                    const url = part.content.startsWith('http') ? part.content : `data:${part.mimeType || 'image/jpeg'};base64,${part.content}`;
                    onImageClick?.(url);
                  }}
                />
              ) : part.type === 'video' ? (
                <div className="mt-2 max-w-md rounded-2xl overflow-hidden bg-black">
                  <video src={part.content} controls className="w-full h-auto block" poster={part.metadata?.thumbnail} />
                </div>
              ) : (
                <a href={`https://www.youtube.com/watch?v=${part.content}`} target="_blank" rel="noopener noreferrer"
                  className={`mt-2 flex gap-3 rounded-2xl overflow-hidden border p-2.5 max-w-md transition-colors hover-lift ${isDark ? 'border-white/10 hover:bg-white/[0.03]' : 'border-black/10 hover:bg-black/[0.02]'}`}>
                  <img src={part.metadata?.thumbnail} alt="" className="w-32 aspect-video object-cover rounded-xl shrink-0" />
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-medium leading-snug line-clamp-2 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>{part.metadata?.title}</span>
                    <span className={`block text-[11.5px] mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>{part.metadata?.channelTitle}</span>
                  </span>
                </a>
              )}
            </div>
          ))}

          {/* Minimal action row — appears on hover like Claude */}
          <div className="flex items-center gap-0.5 mt-1.5 opacity-60 group-hover/message:opacity-100 transition-opacity">
            <button
              onClick={() => { if (allText) handleCopy(allText); }}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06]' : 'text-neutral-400 hover:text-neutral-700 hover:bg-black/[0.05]'}`}
              title="Copy response"
            >
              {copiedCode === allText ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {hasTextContent && (
              <button
                onClick={() => {
                  if (isAuthenticated) toggleSpeech();
                  else window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: 'signin' }));
                }}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06]' : 'text-neutral-400 hover:text-neutral-700 hover:bg-black/[0.05]'}`}
                title={isAuthenticated ? 'Read aloud' : 'Log in to listen'}
              >
                <Volume2 size={14} />
              </button>
            )}
            {hasTextContent && onReusePrompt && (
              <button
                onClick={handleReusePrompt}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06]' : 'text-neutral-400 hover:text-neutral-700 hover:bg-black/[0.05]'}`}
                title="Retry with this prompt"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessageItem;
