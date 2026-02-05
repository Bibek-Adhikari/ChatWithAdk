
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { chatStorageService } from './services/chatStorageService';
import AdminDashboardModal from './components/AdminDashboardModal';

const ADMIN_EMAILS = [
  "crazybibek4444@gmail.com",
  "geniusbibek4444@gmail.com"
];


const STORAGE_KEY = 'chat_with_adk_history';

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

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
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    return localStorage.getItem('selectedVoiceURI') || '';
  });
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [aiModel, setAiModel] = useState<'gemini' | 'groq' | 'research' | 'imagine' | 'motion' | 'multi'>('groq');
  const [multiChatConfig, setMultiChatConfig] = useState({
    leftModel: 'groq' as const,
    rightModel: 'gemini' as const,
    dividerPosition: 50,
  });
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isPromptDisabled, setIsPromptDisabled] = useState(false);
  const [isPreviewVideoOpen, setIsPreviewVideoOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const [isResizing, setIsResizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const handleSelectVoice = (uri: string) => {
    setSelectedVoiceURI(uri);
    localStorage.setItem('selectedVoiceURI', uri);
  };

  const currentSession = useMemo(() => 
    sessions.find(s => s.id === currentSessionId), 
    [sessions, currentSessionId]
  );

  // Get storage key for current user
  const getUserStorageKey = () => {
    return user ? `${STORAGE_KEY}_${user.uid}` : `${STORAGE_KEY}_guest`;
  };

  // Load user sessions when user changes
  useEffect(() => {
    const loadSessions = async () => {
      if (user) {
        // Load from Firestore for authenticated users
        const cloudSessions = await chatStorageService.getUserSessions(user.uid);
        if (cloudSessions.length > 0) {
          setSessions(cloudSessions);
          setCurrentSessionId(cloudSessions[0].id);
          // Also update local storage cache
          localStorage.setItem(getUserStorageKey(), JSON.stringify(cloudSessions));
          return;
        }
      }
      
      // Fallback to local storage
      const key = getUserStorageKey();
      const saved = localStorage.getItem(key);
      const loadedSessions = saved ? JSON.parse(saved) : [];
      setSessions(loadedSessions);
      setCurrentSessionId(loadedSessions.length > 0 ? loadedSessions[0].id : '');
    };

    loadSessions();
  }, [user?.uid]);

  // Save sessions when they change
  useEffect(() => {
    const key = getUserStorageKey();
    if (key) {
      localStorage.setItem(key, JSON.stringify(sessions));
    }
  }, [sessions, user?.uid]);

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

  const isAdmin = useMemo(() => {
    return user && user.email && ADMIN_EMAILS.includes(user.email);
  }, [user]);

  const isPro = useMemo(() => {
    // Admins are always Pro, plus anyone with a 'pro' flag in custom claims or profile (placeholder here)
    return isAdmin || (user && (user.displayName?.toLowerCase().includes('pro') || user.email?.toLowerCase().includes('pro')));
  }, [user, isAdmin]);

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
        setIsAdminDashboardOpen(false);
        setIsModelMenuOpen(false);
      }

    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };

    const handleAuthEvent = (e: any) => {
      setAuthModal({ open: true, mode: e.detail || 'signin' });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('open-auth-modal', handleAuthEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('open-auth-modal', handleAuthEvent);
    };
  }, []);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newPos = (e.clientX / window.innerWidth) * 100;
      if (newPos > 20 && newPos < 80) {
        setMultiChatConfig(prev => ({ ...prev, dividerPosition: newPos }));
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

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

  const handleDeleteSession = async (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (currentSessionId === id) {
      setCurrentSessionId(updated.length > 0 ? updated[0].id : '');
    }
    
    // Sync with Firestore if authenticated
    if (user) {
      try {
        await chatStorageService.deleteSession(id);
      } catch (err) {
        console.error("Failed to delete session from cloud:", err);
      }
    }
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    
    // Sync with Firestore if authenticated
    if (user) {
      const session = sessions.find(s => s.id === id);
      if (session) {
        try {
          await chatStorageService.saveSession(user.uid, { ...session, title: newTitle });
        } catch (err) {
          console.error("Failed to rename session in cloud:", err);
        }
      }
    }
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
      } else if (currentInput.toLowerCase().startsWith('/youtube')) {
        const query = currentInput.substring(8).trim();
        if (!query) {
          addAssistantMessage(sessionId, [{ type: 'text', content: "Please provide a search query after /youtube (e.g., /youtube lo-fi hip hop)" }]);
        } else {
          try {
            const video = await searchYouTubeVideo(query);
            if (video) {
              addAssistantMessage(sessionId, [
                { type: 'text', content: `🎬 I found a great video for: **${query}**` },
                { 
                  type: 'youtube', 
                  content: video.id,
                  metadata: {
                    title: video.title,
                    thumbnail: video.thumbnail,
                    channelTitle: video.channelTitle
                  }
                },
                { type: 'text', content: `[Not the right video? View more results here](https://www.youtube.com/results?search_query=${encodeURIComponent(query)})` }
              ]);
            } else {
              addAssistantMessage(sessionId, [
                { type: 'text', content: `🔍 I couldn't find a direct video match for "${query}".` },
                { type: 'text', content: `👉 [Click here to see YouTube search results for "${query}"](https://www.youtube.com/results?search_query=${encodeURIComponent(query)})` }
              ]);
            }
          } catch (e: any) {
            const errorMsg = e.message || "Unknown error";
            addAssistantMessage(sessionId, [{ 
              type: 'text', 
              content: `❌ YouTube Search Failed: ${errorMsg}. Please check if your YouTube API Key is valid and enabled in the Google Cloud Console.` 
            }]);
          }
        }
      } else if (aiModel === 'multi') {
        const [leftResponse, rightResponse] = await Promise.all([
          generateModelResponse(multiChatConfig.leftModel, currentInput, history, selectedImage || undefined),
          generateModelResponse(multiChatConfig.rightModel, currentInput, history, selectedImage || undefined)
        ]);
        
        addAssistantMessage(sessionId, [{ type: 'text', content: leftResponse }], multiChatConfig.leftModel);
        addAssistantMessage(sessionId, [{ type: 'text', content: rightResponse }], multiChatConfig.rightModel);
      } else {
        const responseText = await generateModelResponse(aiModel, currentInput, history, selectedImage || undefined);
        addAssistantMessage(sessionId, [{ type: 'text', content: responseText }]);
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

  const updateSessionMessages = async (sessionId: string, updater: (prev: ChatMessage[]) => ChatMessage[], firstInput?: string) => {
    let updatedSession: ChatSession | null = null;
    
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const newMessages = updater(s.messages);
        const newTitle = (s.title === 'New Conversation' && firstInput) ? (firstInput.slice(0, 30) + (firstInput.length > 30 ? '...' : '')) : s.title;
        updatedSession = { 
          ...s, 
          messages: newMessages, 
          updatedAt: Date.now(),
          title: newTitle
        };
        return updatedSession;
      }
      return s;
    }));

    // Sync with Firestore if authenticated
    if (user && updatedSession) {
      try {
        await chatStorageService.saveSession(user.uid, updatedSession);
      } catch (err) {
        console.error("Failed to sync message to cloud:", err);
      }
    }
  };

  const addAssistantMessage = (sessionId: string, parts: MessagePart[], modelId?: string) => {
    const newMessage: ChatMessage = {
      id: (Date.now() + Math.random()).toString(), // Ensure unique ID even in parallel calls
      role: 'assistant',
      parts,
      timestamp: new Date().toISOString(),
      modelId
    };
    updateSessionMessages(sessionId, prev => [...prev, newMessage]);
  };

  const generateModelResponse = async (model: string, input: string, history: any[], image?: any) => {
    if (model === 'groq') {
      const textOnlyHistory = history.map(h => ({
        ...h,
        parts: h.parts.filter(p => 'text' in p) as { text: string }[]
      }));
      return await generateGroqResponse(input, textOnlyHistory);
    } else if (model === 'research') {
      const textOnlyHistory = history.map(h => ({
        ...h,
        parts: h.parts.filter(p => 'text' in p) as { text: string }[]
      }));
      return await generateResearchResponse(input, textOnlyHistory);
    } else if (model === 'imagine') {
      return `[Imagine Model Placeholder] I cannot yet generate images inside multi-chat logic cleanly. Use the standalone Imagine mode.`;
    } else {
      return await generateTextResponse(input, history, image);
    }
  };

  // Convert ISO timestamp string back to Date for the component
  const localizedMessages = useMemo(() => 
    (currentSession?.messages || []).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    })),
    [currentSession?.messages]
  );
  
  const leftMessages = useMemo(() => 
    localizedMessages.filter(m => m.role === 'user' || m.modelId === multiChatConfig.leftModel || !m.modelId),
    [localizedMessages, multiChatConfig.leftModel]
  );
  
  const rightMessages = useMemo(() => 
    localizedMessages.filter(m => m.role === 'user' || m.modelId === multiChatConfig.rightModel || !m.modelId),
    [localizedMessages, multiChatConfig.rightModel]
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
        isAdmin={isAdmin}
        onOpenAdmin={() => setIsAdminDashboardOpen(true)}
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
        <main 
          className={`flex-1 overflow-hidden relative flex flex-col ${theme === 'dark' ? 'bg-slate-950/20' : 'bg-slate-50'}`} 
          ref={scrollRef}
        >
          {aiModel !== 'multi' ? (
            <div className={`flex-1 overflow-y-auto px-3 sm:px-8 py-6 custom-scrollbar relative flex flex-col ${localizedMessages.length < 3 ? 'justify-center' : ''}`}>
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
                    selectedVoiceURI={selectedVoiceURI}
                    isAuthenticated={!!user}
                    onReusePrompt={(text) => {
                      setInputValue(text);
                      if (inputRef.current) {
                        inputRef.current.focus();
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
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden relative group/multi">
              {/* Left Column */}
              <div 
                ref={leftScrollRef}
                className="h-full overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar border-r border-white/5" 
                style={{ width: `${multiChatConfig.dividerPosition}%` }}
              >
                <div className="max-w-xl mx-auto space-y-4">
                  <div className={`mb-6 p-3 rounded-2xl border flex items-center justify-between backdrop-blur-md transition-all group/choice
                    ${theme === 'dark' 
                      ? 'bg-slate-900/40 border-white/5 shadow-2xl shadow-blue-500/5 hover:bg-slate-900/60' 
                      : 'bg-white/80 border-slate-100 shadow-lg hover:bg-white'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-[10px] text-white font-black uppercase">
                        {multiChatConfig.leftModel[0]}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{multiChatConfig.leftModel}</span>
                    </div>
                    <select 
                      value={multiChatConfig.leftModel}
                      onChange={(e) => setMultiChatConfig(prev => ({ ...prev, leftModel: e.target.value as any }))}
                      className={`bg-transparent text-[9px] font-black uppercase tracking-[0.2em] outline-none cursor-pointer border-none focus:ring-0
                        ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                    >
                      <option value="groq" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Groq</option>
                      <option value="gemini" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Gemini</option>
                      <option value="research" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Research</option>
                    </select>
                  </div>
                  {leftMessages.map((msg) => (
                    <ChatMessageItem 
                      key={msg.id} 
                      message={msg as any} 
                      theme={theme}
                      selectedVoiceURI={selectedVoiceURI}
                      isAuthenticated={!!user}
                    />
                  ))}
                </div>
              </div>

              {/* Enhanced Resizer */}
              <div 
                className={`absolute top-0 bottom-0 w-1.5 cursor-col-resize z-50 transition-all hover:bg-blue-500/50 flex items-center justify-center
                  ${isResizing ? 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : ''}`}
                style={{ left: `calc(${multiChatConfig.dividerPosition}% - 0.75px)` }}
                onMouseDown={startResizing}
              >
                <div className={`w-[2px] h-12 rounded-full transition-all ${isResizing ? 'bg-white' : 'bg-slate-500 opacity-20'}`} />
              </div>

              {/* Right Column */}
              <div 
                ref={rightScrollRef}
                className="h-full overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar" 
                style={{ width: `${100 - multiChatConfig.dividerPosition}%` }}
              >
                <div className="max-w-xl mx-auto space-y-4">
                  <div className={`mb-6 p-3 rounded-2xl border flex items-center justify-between backdrop-blur-md transition-all group/choice
                    ${theme === 'dark' 
                      ? 'bg-slate-900/40 border-white/5 shadow-2xl shadow-blue-500/5 hover:bg-slate-900/60' 
                      : 'bg-white/80 border-slate-100 shadow-lg hover:bg-white'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] text-white font-black uppercase">
                        {multiChatConfig.rightModel[0]}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{multiChatConfig.rightModel}</span>
                    </div>
                    <select 
                      value={multiChatConfig.rightModel}
                      onChange={(e) => setMultiChatConfig(prev => ({ ...prev, rightModel: e.target.value as any }))}
                      className={`bg-transparent text-[9px] font-black uppercase tracking-[0.2em] outline-none cursor-pointer border-none focus:ring-0
                        ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                    >
                      <option value="groq" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Groq</option>
                      <option value="gemini" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Gemini</option>
                      <option value="research" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>Research</option>
                    </select>
                  </div>
                  {rightMessages.map((msg) => (
                    <ChatMessageItem 
                      key={msg.id} 
                      message={msg as any} 
                      theme={theme}
                      selectedVoiceURI={selectedVoiceURI}
                      isAuthenticated={!!user}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
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
                        onClick={() => { 
                          if (!isPro) { 
                            setStatus(prev => ({ ...prev, error: "Multi-Chat is a Pro feature. Level up your account to access it!" }));
                            setIsModelMenuOpen(false);
                            return; 
                          }
                          setAiModel('multi'); setIsModelMenuOpen(false); 
                        }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group/multi-btn relative overflow-hidden cursor-pointer
                          ${aiModel === 'multi' ? (theme === 'dark' ? 'bg-amber-600/20' : 'bg-amber-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                        role="button"
                        tabIndex={0}
                      >
                        {/* Video Preview on Hover with Fullscreen trigger */}
                        <div className="absolute inset-0 opacity-0 group-hover/multi-btn:opacity-100 transition-opacity duration-500 pointer-events-none">
                          <video 
                            src="/pre.webm" 
                            autoPlay 
                            muted 
                            loop 
                            playsInline
                            className="w-full h-full object-cover scale-110 group-hover/multi-btn:scale-100 transition-transform duration-700 brightness-[0.3]"
                          />
                        </div>

                        {/* Fullscreen Expand Icon - Accessible to everyone */}
                        <div 
                          className="absolute bottom-2 right-2 w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover/multi-btn:opacity-100 transition-all z-20 hover:bg-white/30 hover:scale-110 active:scale-90 border border-white/10"
                          onClick={(e) => {
                            e.stopPropagation(); // Stop selection logic from firing
                            setIsPreviewVideoOpen(true);
                          }}
                        >
                          <i className="fas fa-expand text-[12px]"></i>
                        </div>

                        <div className="relative z-10 flex items-start gap-4 w-full">
                          {!isPro && <i className="fas fa-crown text-[8px] absolute top-0 right-0 text-amber-500"></i>}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90
                            ${aiModel === 'multi' ? 'bg-amber-600 text-white shadow-lg' : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                            <i className="fas fa-columns text-sm"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-[11px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Multi Chat</p>
                              <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">PRO</span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight mt-1 group-hover/multi-btn:text-slate-300">Dual-AI mode. Compare responses side-by-side in real-time.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex flex-col flex-1 pl-1">
                    {selectedImage && !isPromptDisabled && (
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
                      <img 
                        src="/assets/logo.webp" 
                        alt="Logo" 
                        className={`w-12 h-12 rounded-xl shadow-lg shrink-0 mr-1 object-cover cursor-pointer transition-all active:scale-95 hover:brightness-110 ${isPromptDisabled ? 'ring-2 ring-blue-500/50' : ''}`} 
                        onClick={() => {
                          setIsPromptDisabled(!isPromptDisabled);
                          setIsModelMenuOpen(false);
                        }}
                        title={isPromptDisabled ? "Enable Prompt Box" : "Disable Prompt Box"}
                      />

                      {!isPromptDisabled && (
                        <>
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
                        </>
                      )}
                    </div>

                    {!isPromptDisabled && (
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
                    )}
                  </div>

                  {!isPromptDisabled && (
                    <button 
                      type="submit"
                      disabled={!inputValue.trim() || status.isTyping}
                      className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:opacity-30 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
                    >
                      <i className={`fas ${status.isTyping ? 'fa-spinner fa-spin' : 'fa-arrow-up'} text-xs`}></i>
                    </button>
                  )}
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
        selectedVoiceURI={selectedVoiceURI}
        onSelectVoice={handleSelectVoice}
      />
      <UserProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        theme={theme}
      />
      <AdminDashboardModal 
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
        theme={theme}
      />

      {/* Fullscreen Video Preview Modal */}
      {isPreviewVideoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="relative w-full max-w-5xl aspect-video mx-4 overflow-hidden rounded-[32px] border border-white/10 shadow-[0_0_100px_rgba(59,130,246,0.3)] group">
            <video 
              src="/pre.webm" 
              autoPlay 
              controls 
              className="w-full h-full object-contain"
            />
            <button 
              onClick={() => setIsPreviewVideoOpen(false)}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


export default App;
