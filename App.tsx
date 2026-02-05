
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessage, ChatSession, GenerationState, MessagePart } from './types';
import ChatMessageItem from './components/ChatMessageItem';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import SettingsModal from './components/SettingsModal';
import UserProfileModal from './components/UserProfileModal';
import { generateTextResponse } from './services/geminiService';
import { generateGroqResponse } from './services/groqService';
import { generateResearchResponse } from './services/openRouterService';
import { generateImageResponse } from './services/imageService';
import { searchYouTubeVideo } from './services/youtubeService';
import { auth } from './services/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

const STORAGE_KEY = 'chat_with_adk_history';

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length > 0 ? parsed[0].id : '';
  });

  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<GenerationState>({
    isTyping: false,
    error: null,
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'signin' | 'signup' }>({
    open: false,
    mode: 'signin'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [aiModel, setAiModel] = useState<'gemini' | 'groq' | 'research' | 'imagine' | 'motion'>('groq');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const currentSession = useMemo(() => 
    sessions.find(s => s.id === currentSessionId), 
    [sessions, currentSessionId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Reset to Groq if user logs out and was on a restricted model
      if (!currentUser) {
        setAiModel('groq');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSession?.messages, status]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K for New Chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
      // Esc to close all modals
      if (e.key === 'Escape') {
        setAuthModal(prev => ({ ...prev, open: false }));
        setIsSettingsOpen(false);
        setIsProfileOpen(false);
        setIsModelMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNewChat = () => {
    const newId = Date.now().toString();
    // Check both state and live auth object to ensure we have the latest displayName (especially after signup)
    const currentDisplayName = user?.displayName || auth.currentUser?.displayName;
    const firstName = currentDisplayName ? currentDisplayName.split(' ')[0] : '';
    const greeting = firstName ? `Hello, ${firstName}!` : 'Hello!';
    
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      messages: [{
        id: 'welcome',
        role: 'assistant',
        parts: [{ type: 'text', content: `${greeting} I am ChatAdk. How can I help you today?` }],
        timestamp: new Date().toISOString(),
      }],
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleAuthClick = (mode: 'signin' | 'signup') => {
    setAuthModal({ open: true, mode });
  };

  const handleDeleteSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (currentSessionId === id) {
      setCurrentSessionId(updated.length > 0 ? updated[0].id : '');
    }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatus(prev => ({ ...prev, error: "Please select an image file." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const data = base64.split(',')[1];
      setSelectedImage({ data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || status.isTyping) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newId = Date.now().toString();
      const newSession: ChatSession = {
        id: newId,
        title: inputValue.trim().slice(0, 30) + (inputValue.length > 30 ? '...' : ''),
        messages: [],
        updatedAt: Date.now(),
      };
      setSessions([newSession]);
      setCurrentSessionId(newId);
      sessionId = newId;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: [
        { type: 'text', content: inputValue.trim() },
        ...(selectedImage ? [{ type: 'image' as const, content: selectedImage.data, mimeType: selectedImage.mimeType }] : [])
      ],
      timestamp: new Date().toISOString(),
    };

    updateSessionMessages(sessionId, (prev) => [...prev, userMessage], inputValue.trim());
    
    const currentInput = inputValue.trim();
    setInputValue('');
    setStatus(prev => ({ ...prev, isTyping: true, error: null }));

    try {
      const history = (currentSession?.messages || []).map(m => ({
        role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
        parts: (m.parts || []).filter(p => p && p.content).map(p => {
          if (p.type === 'text') return { text: p.content };
          return { inlineData: { data: p.content, mimeType: p.mimeType || 'image/jpeg' } };
        })
      }));
      
      console.log("Sending prompt with history:", { prompt: currentInput, historyLength: history.length, hasImage: !!selectedImage, model: aiModel });
      
      let responseText = '';
      let generatedImageUrl = '';

      if (aiModel === 'imagine' || currentInput.toLowerCase().startsWith('/image')) {
        if (!user) {
          addAssistantMessage(sessionId, [{ type: 'text', content: "Please sign in to ChatADK to generate images and access premium features." }]);
          handleAuthClick('signup');
        } else {
          const imagePrompt = currentInput.toLowerCase().startsWith('/image') 
            ? currentInput.substring(6).trim() 
            : currentInput;
          
          generatedImageUrl = await generateImageResponse(imagePrompt);
          addAssistantMessage(sessionId, [
            { type: 'text', content: `Here is the image I generated for: "${imagePrompt}"` },
            { type: 'image', content: generatedImageUrl }
          ]);
        }
      } else if (aiModel === 'motion' || currentInput.toLowerCase().startsWith('/video')) {
        addAssistantMessage(sessionId, [{ type: 'text', content: "Motion generation is currently an upcoming feature and will be available soon! Stay tuned." }]);
      } else {
        if (aiModel === 'groq') {
          const textOnlyHistory = history.map(h => ({
            ...h,
            parts: h.parts.filter(p => 'text' in p) as { text: string }[]
          }));
          responseText = await generateGroqResponse(currentInput, textOnlyHistory);
        } else if (aiModel === 'research') {
          const textOnlyHistory = history.map(h => ({
            ...h,
            parts: h.parts.filter(p => 'text' in p) as { text: string }[]
          }));
          responseText = await generateResearchResponse(currentInput, textOnlyHistory);
        } else {
          responseText = await generateTextResponse(currentInput, history, selectedImage || undefined);
        }

        // Check if AI suggested an image generation via /image trigger
        if (responseText.toLowerCase().includes('/image') || responseText.toLowerCase().includes('/youtube')) {
          const parts = responseText.split(/(\/image\s+[^\s]+|\/youtube\s+[^\s]+)/i);
          const finalParts: MessagePart[] = [];
          
          for (const segment of parts) {
            if (segment.toLowerCase().startsWith('/image')) {
              const imgPrompt = segment.substring(6).trim();
              if (user) {
                try {
                  const imgUrl = await generateImageResponse(imgPrompt);
                  finalParts.push({ type: 'image', content: imgUrl });
                } catch (e) {
                  finalParts.push({ type: 'text', content: segment });
                }
              } else {
                finalParts.push({ type: 'text', content: " [Image generation requires sign-in] " });
              }
            } else if (segment.toLowerCase().startsWith('/youtube')) {
              const query = segment.substring(8).trim();
              try {
                const video = await searchYouTubeVideo(query);
                if (video) {
                  finalParts.push({ 
                    type: 'youtube', 
                    content: video.id,
                    metadata: {
                      title: video.title,
                      thumbnail: video.thumbnail,
                      channelTitle: video.channelTitle
                    }
                  });
                } else {
                  finalParts.push({ type: 'text', content: segment });
                }
              } catch (e) {
                finalParts.push({ type: 'text', content: segment });
              }
            } else if (segment.trim()) {
              finalParts.push({ type: 'text', content: segment });
            }
          }
          addAssistantMessage(sessionId, finalParts);
        } else {
          addAssistantMessage(sessionId, [{ type: 'text', content: responseText }]);
        }
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setStatus(prev => ({ ...prev, error: err.message || "Connection lost. Please try again." }));
    } finally {
      setStatus(prev => ({ ...prev, isTyping: false }));
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateSessionMessages = (sessionId: string, updater: (prev: ChatMessage[]) => ChatMessage[], firstInput?: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const newMessages = updater(s.messages);
        return { 
          ...s, 
          messages: newMessages, 
          updatedAt: Date.now(),
          title: (s.title === 'New Conversation' && firstInput) ? (firstInput.slice(0, 30) + (firstInput.length > 30 ? '...' : '')) : s.title
        };
      }
      return s;
    }));
  };

  const addAssistantMessage = (sessionId: string, parts: MessagePart[]) => {
    const newMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      parts,
      timestamp: new Date().toISOString(),
    };
    updateSessionMessages(sessionId, prev => [...prev, newMessage]);
  };

  // Convert ISO timestamp string back to Date for the component
  const localizedMessages = useMemo(() => 
    (currentSession?.messages || []).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    })),
    [currentSession?.messages]
  );

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onAuthClick={handleAuthClick}
        theme={theme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ${theme === 'dark' ? 'bg-slate-950/20' : 'bg-slate-50'}`}>

        {/* Mobile Mini Navbar (Visible only on mobile) */}
        <div className={`lg:hidden flex items-center justify-between p-3 border-b sticky top-0 z-30
          ${theme === 'dark' ? 'bg-slate-950/80 border-white/5' : 'bg-white/80 border-slate-100'} backdrop-blur-md`}>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-90
              ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <i className="fas fa-bars-staggered text-sm"></i>
          </button>
          
          <div className="flex items-center gap-2 -ml-8">
            <img src="/assets/logo.webp" alt="ChatADK" className="w-9 h-9 rounded-xl shadow-xl object-cover border border-white/5" />
            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>ChatADK</span>
          </div>

          {user ? (
            <button 
              onClick={() => setIsProfileOpen(true)}
              className={`w-9 h-9 rounded-lg border border-white/5 flex items-center justify-center transition-all overflow-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}
            >
              {user.photoURL && !imageError ? (
                <img 
                  src={user.photoURL} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                />
              ) : (
                <i className="fas fa-user-circle text-base text-blue-500"></i>
              )}
            </button>
          ) : (
            <button 
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[8px] font-black tracking-widest active:scale-95"
              onClick={() => handleAuthClick('signin')}
            >
              SIGN IN
            </button>
          )}
        </div>

        {/* Desktop Standalone Floating Controls (Hidden on mobile) */}
        <div className="hidden lg:flex fixed top-0 left-0 right-0 z-30 pointer-events-none items-center justify-between p-6">
          <div className="flex items-center gap-3 pointer-events-auto">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-xl transition-all active:scale-90 group
                  ${theme === 'dark' ? 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/5 backdrop-blur-xl' : 'bg-white/90 text-slate-500 hover:text-slate-900 border border-slate-200 backdrop-blur-xl'}`}
              >
                <i className="fas fa-bars-staggered group-hover:scale-110 transition-transform text-sm"></i>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            {user ? (
              <button 
                onClick={() => setIsProfileOpen(true)}
                className={`w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center transition-all overflow-hidden shadow-xl ${theme === 'dark' ? 'bg-slate-900/80 hover:bg-slate-800' : 'bg-white/90 hover:bg-slate-50'}`}
                title="Profile"
              >
                {user.photoURL && !imageError ? (
                  <img 
                    src={user.photoURL} 
                    alt="Avatar" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <i className="fas fa-user-circle text-lg text-blue-500"></i>
                )}
              </button>
            ) : (
              <button 
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black tracking-widest transition-all shadow-xl active:scale-95"
                onClick={() => handleAuthClick('signin')}
              >
                <i className="fas fa-sign-in-alt"></i>
                <span className="hidden sm:inline">SIGN IN</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <main className={`flex-1 overflow-y-auto px-3 sm:px-8 py-6 custom-scrollbar relative flex flex-col ${localizedMessages.length < 3 ? 'justify-center' : ''}`} ref={scrollRef}>
          <div className={`max-w-3xl mx-auto space-y-2 w-full ${localizedMessages.length < 3 ? 'flex-1 flex flex-col justify-center' : ''}`}>
            {!currentSession && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-20 opacity-50">
                <i className="fas fa-comments text-6xl text-slate-800"></i>
                <h3 className="text-xl font-medium">
                  {(user?.displayName || auth.currentUser?.displayName) 
                    ? `Ready for a new adventure, ${(user?.displayName || auth.currentUser?.displayName)?.split(' ')[0]}?` 
                    : 'Ready for a new adventure?'}
                </h3>
                <p className="text-sm text-slate-500 max-w-xs">Start a conversation or choose a recent chat from the sidebar.</p>
                <button 
                  onClick={handleNewChat}
                  className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 px-6 py-2 rounded-full text-sm font-semibold transition-all"
                >
                  Start Chatting
                </button>
              </div>
            )}
            
            {localizedMessages.map((msg) => (
              <ChatMessageItem 
                key={msg.id} 
                message={msg as any} 
                theme={theme}
                onReusePrompt={(text) => {
                  setInputValue(text);
                  if (inputRef.current) {
                    inputRef.current.focus();
                    // Manually trigger height adjustment
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.style.height = 'auto';
                        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
                      }
                    }, 0);
                  }
                }}
              />
            ))}
            
            {status.isTyping && (
              <div className="flex items-start gap-4 mb-8 animate-pulse">
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-lg shadow-blue-500/10">
                  <img src="/assets/logo.webp" alt="Thinking" className="w-full h-full object-cover" />
                </div>
                <div className={`px-5 py-3 rounded-2xl text-[13px] font-bold tracking-tight shadow-sm border
                  ${theme === 'dark' 
                    ? 'bg-slate-800/40 border-white/5 text-blue-400' 
                    : 'bg-white border-slate-200 text-blue-600'}`}>
                  <span className="flex items-center gap-2">
                    ChatAdk is thinking
                    <span className="flex gap-1">
                      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1 h-1 rounded-full bg-current animate-bounce"></span>
                    </span>
                  </span>
                </div>
              </div>
            )}

            {status.error && (
              <div className="max-w-xl mx-auto mb-8 animate-in slide-in-from-top-4 duration-500">
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                    <i className="fas fa-exclamation-circle text-lg"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase font-black tracking-widest text-red-500 opacity-60 mb-0.5">Application Error</p>
                    <p className="text-xs font-bold text-red-100/80 leading-relaxed truncate">{status.error}</p>
                  </div>
                  <button 
                    onClick={() => setStatus(prev => ({ ...prev, error: null }))}
                    className="p-2 text-red-500/50 hover:text-red-500 transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Input Section */}
        <footer className={`p-4 sm:p-6 shrink-0 z-10 pb-safe ${theme === 'dark' ? 'bg-transparent' : 'bg-transparent'}`}>
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSend} className="relative group transition-all duration-300">
              {/* Outer Glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[22px] blur-sm opacity-10 group-focus-within:opacity-25 transition duration-500"></div>
              
              <div className={`relative flex flex-col p-2 rounded-[24px] shadow-2xl transition-all border
                ${theme === 'dark' 
                  ? 'bg-slate-900/80 border-white/5 backdrop-blur-xl' 
                  : 'bg-white/90 border-slate-200 backdrop-blur-xl'}`}>
                
                

                {/* Model Selector Dropdown (Floating above) */}
                {isModelMenuOpen && (
                  <div 
                    ref={modelMenuRef}
                    className={`absolute bottom-[calc(100%+16px)] left-0 w-72 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border p-3 animate-slide-up z-50
                    ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 shadow-xl'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-2 px-3 py-2">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Conversation Mode</p>
                    </div>

                    <div className="space-y-1">
                      <button 
                        type="button"
                        onClick={() => { setAiModel('groq'); setIsModelMenuOpen(false); }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group
                          ${aiModel === 'groq' ? (theme === 'dark' ? 'bg-blue-600/20' : 'bg-blue-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90
                          ${aiModel === 'groq' ? 'bg-blue-600 text-white shadow-lg' : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                          <i className="fas fa-bolt"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Fast</p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-1">Blazing fast execution for simple tasks and quick answers.</p>
                        </div>
                      </button>

                      <button 
                        type="button"
                        onClick={() => { 
                          if (!user) { handleAuthClick('signup'); return; }
                          setAiModel('research'); setIsModelMenuOpen(false); 
                        }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group relative
                          ${aiModel === 'research' ? (theme === 'dark' ? 'bg-emerald-600/20' : 'bg-emerald-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                      >
                        {!user && <i className="fas fa-lock text-[8px] absolute top-4 right-4 text-emerald-500"></i>}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90
                          ${aiModel === 'research' ? 'bg-emerald-600 text-white shadow-lg' : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                          <i className="fas fa-microscope text-sm"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Research</p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-1">Deep analysis and patterns using DeepSeek R1.</p>
                        </div>
                      </button>

                      <button 
                        type="button"
                        onClick={() => { 
                          if (!user) { handleAuthClick('signup'); return; }
                          setAiModel('imagine'); setIsModelMenuOpen(false); 
                        }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group relative
                          ${aiModel === 'imagine' ? (theme === 'dark' ? 'bg-pink-600/20' : 'bg-pink-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                      >
                        {!user && <i className="fas fa-lock text-[8px] absolute top-4 right-4 text-pink-500"></i>}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90
                          ${aiModel === 'imagine' ? 'bg-pink-600 text-white shadow-lg' : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                          <i className="fas fa-magic text-sm"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Imagine</p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-1">Creative visual generation. Describe any image.</p>
                        </div>
                      </button>

                      <button 
                        type="button"
                        onClick={() => { 
                          if (!user) { handleAuthClick('signup'); return; }
                          setAiModel('gemini'); setIsModelMenuOpen(false); 
                        }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group relative
                          ${aiModel === 'gemini' ? (theme === 'dark' ? 'bg-indigo-600/20' : 'bg-indigo-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                      >
                        {!user && <i className="fas fa-lock text-[8px] absolute top-4 right-4 text-indigo-500"></i>}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90
                          ${aiModel === 'gemini' ? 'bg-indigo-600 text-white shadow-lg' : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                          <i className="fas fa-brain text-sm"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Detail</p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-1">Advanced multimodal analysis and technical breakdown.</p>
                        </div>
                      </button>

                      <div 
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group relative opacity-60 cursor-not-allowed
                          ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                      >
                        <div className="absolute top-4 right-4 px-2 py-0.5 rounded-md bg-blue-600/20 border border-blue-600/30">
                          <span className="text-[7px] font-black uppercase tracking-widest text-blue-400">Soon</span>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform
                          ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                          <i className="fas fa-film text-sm"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Motion</p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-1">High-fidelity AI video generation is coming soon to ChatADK.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex flex-col flex-1 pl-1">
                    {selectedImage && (
                      <div className="pb-2 flex items-center gap-2">
                        <div className="relative group/img overflow-hidden rounded-lg">
                          <img 
                            src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                            alt="Selected" 
                            className="h-20 w-auto object-cover border border-white/10"
                          />
                          <button 
                            type="button"
                            onClick={removeSelectedImage}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                            <i className="fas fa-times text-[10px]"></i>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1.5 px-2">
                       {/* ChatADK Logo in Input Area */}
                      <img src="/assets/logo.webp" alt="Logo" className="w-12 h-12 rounded-xl shadow-lg shrink-0 mr-1 object-cover" />

                      <button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsModelMenuOpen(!isModelMenuOpen); }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all hover:scale-[1.02] active:scale-95
                          ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white hover:bg-black/60' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100 shadow-sm'}`}
                      >
                        <div className={`w-4 h-4 rounded-lg flex items-center justify-center text-[8px] shadow-sm
                          ${aiModel === 'groq' ? 'bg-blue-600 text-white' : 
                            aiModel === 'research' ? 'bg-emerald-600 text-white' :
                            aiModel === 'imagine' ? 'bg-pink-600 text-white' :
                            aiModel === 'motion' ? 'bg-amber-600 text-white' :
                            'bg-indigo-600 text-white'}`}>
                          <i className={`fas ${
                            aiModel === 'groq' ? 'fa-bolt' : 
                            aiModel === 'research' ? 'fa-microscope' :
                            aiModel === 'imagine' ? 'fa-magic' :
                            aiModel === 'motion' ? 'fa-film' :
                            'fa-brain'
                          }`}></i>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest">{aiModel === 'gemini' ? 'Detail' : aiModel === 'groq' ? 'Fast' : aiModel}</span>
                        <i className={`fas fa-chevron-up text-[7px] transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`}></i>
                      </button>

                      <div className={`w-px h-3 ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-200'}`}></div>

                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        className="hidden"
                      />
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-8 h-8 shrink-0 flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Attach Image"
                      >
                        <i className="fas fa-image text-base"></i>
                      </button>
                    </div>

                    <textarea 
                      ref={inputRef}
                      rows={1}
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type a message..."
                      className={`flex-1 bg-transparent border-none outline-none px-4 py-3 text-[14.5px] leading-relaxed resize-none overflow-y-auto max-h-[200px] placeholder:text-slate-500/60
                        ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}
                      disabled={status.isTyping}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={!inputValue.trim() || status.isTyping}
                    className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:opacity-30 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
                  >
                    <i className={`fas ${status.isTyping ? 'fa-spinner fa-spin' : 'fa-arrow-up'} text-xs`}></i>
                  </button>
                </div>
              </div>
            </form>
            
            <div className={`mt-4 text-center select-none transition-opacity duration-500 ${status.isTyping ? 'opacity-40' : 'opacity-100'}`}>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
                <i className="fas fa-shield-alt mr-2 text-blue-500/50"></i>
                chatAdk may produce inaccurate data. verify critical info.
              </p>
            </div>
          </div>
        </footer>
      </div>
      <AuthModal 
        isOpen={authModal.open}
        onClose={() => setAuthModal(prev => ({ ...prev, open: false }))}
        initialMode={authModal.mode}
        theme={theme}
      />
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <UserProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        theme={theme}
      />
    </div>
  );
};

export default App;
