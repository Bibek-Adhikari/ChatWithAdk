
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Code2,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  Zap,
  ArrowRight
} from 'lucide-react';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChatMessage, ChatSession, GenerationState, MessagePart } from './types';
import ChatMessageItem from './components/ChatMessageItem';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import Plans from './components/Plans';
import SettingsModal from './components/SettingsModal';
import UserProfileModal from './components/UserProfileModal';
import { generateTextResponse } from './services/geminiService';
import { generateGroqResponse } from './services/groqService';
import { generateResearchResponse } from './services/openRouterService';
import { generateImageResponse } from './services/imageService';
import { searchYouTubeVideo, getVideoDetails } from './services/youtubeService';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut, User, getRedirectResult } from 'firebase/auth';
import { chatStorageService } from './services/chatStorageService';
import { storageAggregator } from './services/storageAggregator';
import AdminDashboardModal from './components/AdminDashboardModal';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { adminService } from './services/adminService'; 
import { fetchLatestNews, shouldFetchNews } from './services/newsService';
import VSCodeCompiler from './components/VSCodeCompiler'
import LanguageConverter from './components/LanguageConverter'
import PhotoAdk from './components/PhotoAdk'
import { VOICE_LIBRARY } from './services/voiceLibrary';
import { readBoolean, readJson, readNumber, readString, removeKey, writeJson, writeString } from './services/storage';


const ADMIN_EMAILS = [
  "crazybibek4444@gmail.com",
  "geniusbibek4444@gmail.com"
];


const STORAGE_KEY = 'chat_with_adk_history';

const App: React.FC<{ initialTool?: 'codeadk' | 'photoadk' | 'converteradk' }> = ({ initialTool }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = readString('theme', 'dark');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const overlayPaths = React.useMemo(() => ['codeadk', 'converteradk', 'photoadk', 'converteradk/history'], []);

  const { sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    // Initial load from Guest cache to prevent race conditions during boot
    const key = `${STORAGE_KEY}_guest`;
    return readJson<ChatSession[]>(key, [], { prefer: 'local' });
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    if (urlSessionId) return urlSessionId;
    return ''; // Start with empty, will be initialized in syncSessions or handleNewChat
  });

  const lastUserUidRef = useRef<string | null>(null);
  const initialSyncRef = useRef(false);

  const [inputValue, setInputValue] = useState(() => {
    // Pick up any message typed on the landing page
    const pending = readString('pending_message', '', { prefer: 'session', fallbackToOther: false });
    if (pending) removeKey('pending_message', { persist: 'session' });
    return pending || '';
  });
  const [status, setStatus] = useState<GenerationState>({
    isTyping: false,
    error: null,
    isSyncing: false,
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return readBoolean('isSidebarOpen', false);
  });

  useEffect(() => {
    writeString('isSidebarOpen', String(isSidebarOpen), { persist: 'both' });
  }, [isSidebarOpen]);
  const [user, setUser] = useState<User | null>(null);
  const [isProUser, setIsProUser] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'signin' | 'signup' }>({
    open: false,
    mode: 'signin'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState<{ open: boolean; showPricing: boolean }>({ open: false, showPricing: false });
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [isCompilerOpen, setIsCompilerOpen] = useState(() => initialTool === 'codeadk');
  const [isConverterOpen, setIsConverterOpen] = useState(() => initialTool === 'converteradk');
  const [isPhotoAdkOpen, setIsPhotoAdkOpen] = useState(() => initialTool === 'photoadk');
  const [showConverterHistory, setShowConverterHistory] = useState(false);
  const [previousSessionId, setPreviousSessionId] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    const savedId = readString('selectedVoiceId', '');
    if (savedId && VOICE_LIBRARY.some(v => v.id === savedId)) return savedId;
    const legacy = readString('selectedVoiceURI', '');
    return VOICE_LIBRARY.some(v => v.id === legacy) ? legacy : '';
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
  const [usageCount, setUsageCount] = useState<number>(() => {
    const saved = readNumber('daily_usage_count', 0);
    const lastDate = readString('daily_usage_date', '');
    const today = new Date().toDateString();
    
    if (lastDate !== today) {
      writeString('daily_usage_date', today, { persist: 'both' });
      writeString('daily_usage_count', '0', { persist: 'both' });
      return 0;
    }
    return saved;
  });

  const [systemConfig, setSystemConfig] = useState<any>(null);

  const handleMagicPasteFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    const isJs = name.endsWith('.js');
    const isJpg = name.endsWith('.jpg') || name.endsWith('.jpeg');

    if (!isJs && !isJpg) return;

    if (location.pathname.startsWith('/chat/') && currentSessionId && !overlayPaths.includes(currentSessionId)) {
      setPreviousSessionId(currentSessionId);
    }

    if (isJs && location.pathname !== '/codeadk') {
      navigate('/codeadk');
    } else if (isJpg && location.pathname !== '/photoadk') {
      navigate('/photoadk');
    }
  }, [currentSessionId, location.pathname, navigate, overlayPaths]);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => {
      const types = Array.from(e.dataTransfer?.types || []);
      return types.includes('Files');
    };

    const handleDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleMagicPasteFile(file);
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleMagicPasteFile]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await adminService.getModelConfig();
        setSystemConfig(config);
      } catch (err) {
        console.error("Failed to fetch system config:", err);
      }
    };
    fetchConfig();
  }, [isAdminDashboardOpen]); // Re-fetch when dashboard closes in case of changes

  const [dailyLimit] = useState(20); // Free limit: 20 messages
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const [isResizing, setIsResizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writeString('theme', theme, { persist: 'both' });
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    writeString('selectedVoiceId', voiceId, { persist: 'both' });
  };

  const currentSession = useMemo(() => 
    sessions.find(s => s.id === currentSessionId), 
    [sessions, currentSessionId]
  );

  // Get storage key for current user
  const getUserStorageKey = () => {
    return user ? `${STORAGE_KEY}_${user.uid}` : `${STORAGE_KEY}_guest`;
  };

  // Real-time listener for user sessions
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const syncSessions = async () => {
      const key = getUserStorageKey();
      
      // If user is logged in, we need to switch from guest data to user data
      if (user) {
        // Load user-specific local cache first for speed
        const loadedSessions = readJson<ChatSession[]>(key, [], { prefer: 'local' });
        if (loadedSessions.length > 0) {
          setSessions(loadedSessions);
          
          // On fresh login or mount, if no URL session, we might want a new one 
          // but let's wait for cloud sync to be sure
          if (urlSessionId && loadedSessions.some((s: any) => s.id === urlSessionId)) {
            setCurrentSessionId(urlSessionId);
          }
        }
      }

      if (user) {
        // Migrate Guest -> User Cloud if guest data exists
        const guestKey = `${STORAGE_KEY}_guest`;
        const guestSessions = readJson<ChatSession[]>(guestKey, [], { prefer: 'local' });
        if (guestSessions.length > 0) {
          setStatus(prev => ({ ...prev, isSyncing: true }));
          // Save each guest session to cloud
          for (const s of guestSessions) {
            await storageAggregator.saveSession(user.uid, s);
          }
          removeKey(guestKey, { persist: 'both' });
        }

        // Subscribe to real-time updates from cloud
        unsubscribe = chatStorageService.subscribeToUserSessions(user.uid, (cloudSessions) => {
          setSessions(prev => {
            const cloudMap = new Map(cloudSessions.map(s => [s.id, s]));
            const merged = [...cloudSessions];
            
            prev.forEach(local => {
              const cloud = cloudMap.get(local.id);
              if (!cloud) {
                merged.push(local);
              } else if (local.updatedAt > ((cloud as ChatSession).updatedAt || 0)) {
                const index = merged.findIndex(s => s.id === local.id);
                if (index !== -1) merged[index] = local;
              }
            });

            const finalSessions = merged.sort((a, b) => b.updatedAt - a.updatedAt);
            writeJson(key, finalSessions, { persist: 'both' });
            return finalSessions;
          });

          // Handle initial current session selection or new chat on login
          if (!initialSyncRef.current) {
            initialSyncRef.current = true;
            if (urlSessionId) {
              setCurrentSessionId(urlSessionId);
            } else {
              // If we're on a tool route, we need a session ID but shouldn't navigate away from the tool URL
              const isToolRoute = overlayPaths.includes(location.pathname.slice(1));
              handleNewChat(!isToolRoute);
            }
          } else if (!currentSessionId && cloudSessions.length > 0) {
            setCurrentSessionId(cloudSessions[0].id);
          }
          
          setStatus(prev => ({ ...prev, isSyncing: false }));
        });
      } else {
        // Guest mode
        if (!initialSyncRef.current) {
          initialSyncRef.current = true;
          if (urlSessionId) {
            setCurrentSessionId(urlSessionId);
          } else if (!currentSessionId) {
            const isToolRoute = overlayPaths.includes(location.pathname.slice(1));
            handleNewChat(!isToolRoute);
          }
        }
      }
    };

    syncSessions();
    return () => unsubscribe();
  }, [user?.uid]);

  // URL → Overlay Sync: When navigating with browser back/forward, sync overlay open state
  useEffect(() => {
    const path = location.pathname;
    const isPathCode = path === '/codeadk';
    const isPathConverter = path === '/converteradk';
    const isPathConverterHistory = path === '/converteradk/history';
    const isPathPhoto = path === '/photoadk';

    setIsCompilerOpen(isPathCode);
    setIsConverterOpen(isPathConverter || isPathConverterHistory);
    setShowConverterHistory(isPathConverterHistory);
    setIsPhotoAdkOpen(isPathPhoto);

    // Also sync session from URL param
    if (urlSessionId && !overlayPaths.includes(urlSessionId) && urlSessionId !== currentSessionId) {
      setCurrentSessionId(urlSessionId);
    }
  }, [location.pathname, urlSessionId]);

  // Persist last active session to local/session storage 
  useEffect(() => {
    if (currentSessionId && !overlayPaths.includes(currentSessionId)) {
      const key = user ? `${STORAGE_KEY}_last_session_id_${user.uid}` : `${STORAGE_KEY}_last_session_id_guest`;
      writeString(key, currentSessionId, { persist: 'both' });
    }
  }, [currentSessionId, overlayPaths, user]);

  // Handle "relogin" (auth change) to reset sync state and trigger new chat
  useEffect(() => {
    if (user?.uid !== lastUserUidRef.current) {
      initialSyncRef.current = false;
      lastUserUidRef.current = user?.uid || null;
    }
  }, [user?.uid]);

  // 3. Cleanup logic for missing sessions
  useEffect(() => {
    if (!status.isSyncing && currentSessionId && sessions.length > 0 && initialSyncRef.current) {
      const exists = sessions.some(s => s.id === currentSessionId);
      const isVirtual = currentSessionId.startsWith('new_');
      
      // Only auto-redirect if we are at a chat URL that doesn't exist anymore AND it's not a virtual session
      if (!exists && !isVirtual && !status.isTyping && location.pathname.startsWith('/chat/') && location.pathname !== '/chat/codeadk' && location.pathname !== '/chat/converteradk' && location.pathname !== '/chat/photoadk') {
         console.warn("Session not found, starting handleNewChat...");
         handleNewChat();
      }
    }
  }, [sessions.length, currentSessionId, status.isSyncing]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('admin') === 'true') {
      setIsAdminDashboardOpen(true);
      // Clean up the URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    // Handle redirect result (primarily for mobile)
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          await adminService.syncUser(result.user);
        }
      } catch (err: any) {
        console.error("Redirect login error:", err);
        setStatus(prev => ({ ...prev, error: `Login failed: ${err.message}` }));
      } finally {
        removeKey('auth_redirect_pending', { persist: 'both' });
      }
    };
    handleRedirect();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsProUser(false);
        setPlanId(null);
      }
      if (currentUser) {
        setAuthModal(prev => ({ ...prev, open: false }));
        // Ensure user is synced
        adminService.syncUser(currentUser);
      }
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

  useEffect(() => {
    let isActive = true;
    const loadClaims = async () => {
      if (!user) {
        if (isActive) {
          setIsProUser(false);
          setPlanId(null);
        }
        return;
      }

      try {
        const tokenResult = await user.getIdTokenResult(true);
        const claims = tokenResult.claims as { pro?: boolean; planId?: string };
        if (isActive) {
          setIsProUser(!!claims.pro);
          setPlanId(claims.planId ?? null);
        }
      } catch (err) {
        console.error('Failed to load user claims:', err);
        if (isActive) {
          setIsProUser(false);
          setPlanId(null);
        }
      }
    };

    loadClaims();
    return () => {
      isActive = false;
    };
  }, [user?.uid]);

  const isPro = useMemo(() => {
    return isAdmin || isProUser;
  }, [isAdmin, isProUser]);

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
        setIsProfileOpen(prev => ({ ...prev, open: false }));
        setIsAdminDashboardOpen(false);
        setIsModelMenuOpen(false);
        setIsCompilerOpen(false);
        setIsConverterOpen(false);
        setIsPhotoAdkOpen(false);
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

    const handleOpenAdminPlans = () => {
      setIsPlansOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('open-auth-modal', handleAuthEvent);
    window.addEventListener('open-admin-plans', handleOpenAdminPlans);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('open-auth-modal', handleAuthEvent);
      window.removeEventListener('open-admin-plans', handleOpenAdminPlans);
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

  const handleNewChat = (shouldNavigate = true) => {
    // Just set a fresh ID and clear state. 
    // We DON'T add to sessions or save to cloud yet to avoid cluttering history with empty greetings.
    const newId = `new_${Date.now()}`;
    setCurrentSessionId(newId);
    setInputValue('');
    setStatus(prev => ({ ...prev, error: null, isTyping: false }));
    if (shouldNavigate) {
      navigate(`/chat/${newId}`);
    }
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
        await storageAggregator.deleteSession(id);
      } catch (err) {
        console.error("Failed to delete session from cloud:", err);
      }
    }
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, title: newTitle, updatedAt: Date.now() };
        if (user) {
          storageAggregator.saveSession(user.uid, updated).catch(err => 
            console.error("Failed to sync rename to cloud:", err)
          );
        }
        return updated;
      }
      return s;
    }));
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

    // Enforce daily limit for free users
    if (!isPro && usageCount >= dailyLimit) {
      setStatus(prev => ({ 
        ...prev, 
        error: "Daily message limit reached! Upgrade to Pro for unlimited messages." 
      }));
      navigate('/plans');
      return;
    }

    let sessionId = currentSessionId;
    let currentSess = currentSession;

    // If this is a virtual session (not yet in 'sessions'), create it now
    if (!currentSess) {
      const newId = sessionId?.startsWith('new_') ? sessionId : Date.now().toString();
      
      const currentDisplayName = user?.displayName || auth.currentUser?.displayName;
      const firstName = currentDisplayName ? currentDisplayName.split(' ')[0] : '';
      const greeting = firstName ? `Hello, ${firstName}!` : 'Hello!';

      const newSession: ChatSession = {
        id: newId,
        title: inputValue.trim().slice(0, 30) + (inputValue.length > 30 ? '...' : ''),
        messages: [{
          id: `welcome_${newId}`,
          role: 'assistant',
          parts: [{ type: 'text', content: `${greeting} I am ChatAdk. How can I help you today?` }],
          timestamp: new Date(Date.now() - 1000).toISOString(), // Set greeting slightly in past
        }],
        updatedAt: Date.now(),
      };
      
      if (user) {
        storageAggregator.saveSession(user.uid, newSession).catch(err => 
          console.error("Failed to create initial session in cloud:", err)
        );
      }

      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newId);
      sessionId = newId;
      currentSess = newSession;
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
    
    // Increment usage count
    if (!isPro) {
      const newCount = usageCount + 1;
      setUsageCount(newCount);
      writeString('daily_usage_count', newCount.toString(), { persist: 'both' });
    }

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
      
      let responseText = '';
      let generatedImageUrl = '';

      if (aiModel === 'imagine' || currentInput.toLowerCase().startsWith('/image')) {
        if (!user) {
          addAssistantMessage(sessionId, [{ type: 'text', content: "Please sign in to ChatADK to generate images and access premium features." }]);
          handleAuthClick('signin');
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
              try {
                const aiSummary = await generateTextResponse(
                  `The user searched for "${query}" on YouTube. I found a video titled "${video.title}" by "${video.channelTitle}". 
                   Description: ${video.description || 'No description available.'}. 
                   Briefly (1-2 sentences) explain why this is a good match and what the user can expect from it.`,
                  []
                );

                addAssistantMessage(sessionId, [
                  { type: 'text', content: aiSummary },
                  { 
                    type: 'youtube', 
                    content: video.id,
                    metadata: {
                      title: video.title,
                      thumbnail: video.thumbnail,
                      channelTitle: video.channelTitle
                    }
                  }
                ]);
              } catch (aiErr) {
                addAssistantMessage(sessionId, [
                  { type: 'text', content: `🎬 I found a relevant video: **${video.title}**` },
                  { 
                    type: 'youtube', 
                    content: video.id,
                    metadata: {
                      title: video.title,
                      thumbnail: video.thumbnail,
                      channelTitle: video.channelTitle
                    }
                  }
                ]);
              }
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
      } else {
        const currentDate = new Date().toLocaleString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short' 
        });
        const dateContext = `[SERVER TIME] Today is ${currentDate}. YOUR INTERNAL KNOWLEDGE CUT-OFF IS EARLY 2024. YOU ARE CURRENTLY IN 2026.`;

        if (aiModel === 'multi') {
          let finalInput = `${dateContext}\n\nUSER QUESTION: ${currentInput}`;
          if (shouldFetchNews(currentInput)) {
            console.log("Fetching latest news for multi-chat context...");
            try {
              const news = await fetchLatestNews(currentInput);
              if (news && news.length > 0) {
                const newsContext = news.map((n, i) => `[STORY ${i+1}] (Source: ${n.url})\nCONTENT: ${n.text}`).join('\n\n');
                finalInput = `${dateContext}\n\n!!!!! MANDATORY TRUTH OVERRIDE !!!!!\nToday is Feb 2026. Your 2024 training (PM Dahal) is OLD. \n\nCHECK THE NEWS BELOW FOR A NAME. If you see "PM [Name]" or "Nepal Prime Minister [Name]", use it. If no name is mentioned, say "The news confirms a 2026 update but does not mention the name."\n\n[LATEST NEWS]:\n${newsContext}\n\nUSER QUESTION: ${currentInput}\n(Instructions: PLEASE CITE THE SOURCE URLS FROM THE NEWS ABOVE AT THE END OF YOUR RESPONSE.)`;
              } else {
                finalInput = `${dateContext}\n\n[SYSTEM NOTE: No news found for this specific query. Answer based on 2024 knowledge but warn the user it might be outdated.]\n\nUSER QUESTION: ${currentInput}`;
              }
            } catch (newsErr) {
              console.error("Multi-chat news fetch error:", newsErr);
              finalInput = `${dateContext}\n\n[SYSTEM NOTE: News service unavailable.]\n\nUSER QUESTION: ${currentInput}`;
            }
          }

          const [leftResponse, rightResponse] = await Promise.all([
            generateModelResponse(multiChatConfig.leftModel, finalInput, history, selectedImage || undefined),
            generateModelResponse(multiChatConfig.rightModel, finalInput, history, selectedImage || undefined)
          ]);
          
          await processAssistantResponse(sessionId, leftResponse, multiChatConfig.leftModel);
          await processAssistantResponse(sessionId, rightResponse, multiChatConfig.rightModel);
        } else {
          let finalInput = `${dateContext}\n\nUSER QUESTION: ${currentInput}`;
          
          if (shouldFetchNews(currentInput)) {
            console.log("Fetching latest news for context...");
            try {
              const news = await fetchLatestNews(currentInput);
              if (news && news.length > 0) {
                const newsContext = news.map((n, i) => `[STORY ${i+1}] (Source: ${n.url})\nCONTENT: ${n.text}`).join('\n\n');
                finalInput = `${dateContext}\n\n!!!!! MANDATORY TRUTH OVERRIDE !!!!!\nToday is Feb 2026. Your 2024 training (PM Dahal) is OLD. \n\nCHECK THE NEWS BELOW FOR A NAME. If you see "PM [Name]" or "Nepal Prime Minister [Name]", use it. If no name is mentioned, say "The news confirms a 2026 update but does not mention the name."\n\n[LATEST NEWS]:\n${newsContext}\n\nUSER QUESTION: ${currentInput}\n(Instructions: PLEASE CITE THE SOURCE URLS FROM THE NEWS ABOVE AT THE END OF YOUR RESPONSE.)`;
              } else {
                finalInput = `${dateContext}\n\n[SYSTEM NOTE: No news found for this specific query. Answer based on 2024 knowledge but warn the user it might be outdated.]\n\nUSER QUESTION: ${currentInput}`;
              }
            } catch (newsErr) {
              console.error("News fetch error:", newsErr);
              finalInput = `${dateContext}\n\n[SYSTEM NOTE: News service unavailable.]\n\nUSER QUESTION: ${currentInput}`;
            }
          }

          const responseText = await generateModelResponse(aiModel, finalInput, history, selectedImage || undefined);
          await processAssistantResponse(sessionId, responseText);
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

  const updateSessionMessages = async (sessionId: string, updater: (prev: ChatMessage[]) => ChatMessage[], firstInput?: string) => {
    let latestSession: ChatSession | null = null;
    
    setSessions(prev => {
      const updatedSessions = prev.map(s => {
        if (s.id === sessionId) {
          const newMessages = updater(s.messages);
          const newTitle = (s.title === 'New Conversation' && firstInput) 
            ? (firstInput.slice(0, 30) + (firstInput.length > 30 ? '...' : '')) 
            : s.title;
          
          latestSession = { 
            ...s, 
            messages: newMessages, 
            updatedAt: Date.now(),
            title: newTitle
          };
          return latestSession;
        }
        return s;
      });
      
      writeJson(getUserStorageKey(), updatedSessions, { persist: 'both' });
      return updatedSessions;
    });

    // Use a small delay to ensure latestSession was populated by the setSessions callback
    if (user) {
      setTimeout(() => {
        if (latestSession) {
          setStatus(prev => ({ ...prev, isSyncing: true }));
          storageAggregator.saveSession(user.uid, latestSession)
            .catch(err => console.error("Cloud sync failed:", err))
            .finally(() => setStatus(prev => ({ ...prev, isSyncing: false })));
        }
      }, 50);
    }
  };

  const addAssistantMessage = (sessionId: string, parts: MessagePart[], modelId?: string) => {
    const newMessage: ChatMessage = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
      role: 'assistant',
      parts,
      timestamp: new Date().toISOString(),
      modelId
    };
    updateSessionMessages(sessionId, prev => [...prev, newMessage]);
  };

  const processAssistantResponse = async (sessionId: string, text: string, modelId?: string) => {
    // 1. Detect if the response contains a /youtube [query] command
    const youtubeSearchMatch = text.match(/\/youtube\s+([^\n]+)/i);
    // 2. Detect if the response contains a direct YouTube URL
    const youtubeUrlMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);

    let parts: MessagePart[] = [];
    let cleanText = text;

    // Handle Search Command (/youtube ...)
    if (youtubeSearchMatch) {
      const query = youtubeSearchMatch[1].trim();
      cleanText = text.replace(youtubeSearchMatch[0], '').trim();
      
      parts.push({ type: 'text', content: cleanText });
      
      try {
        const video = await searchYouTubeVideo(query);
        if (video) {
          parts.push({ 
            type: 'youtube', 
            content: video.id,
            metadata: { title: video.title, thumbnail: video.thumbnail, channelTitle: video.channelTitle }
          });
        }
      } catch (e) {
        console.error("Auto YouTube Search failed:", e);
      }
    } 
    // Handle Direct URL
    else if (youtubeUrlMatch) {
      const videoId = youtubeUrlMatch[1];
      // Keep the URL in text but also add the card
      parts.push({ type: 'text', content: cleanText });
      
      try {
        const video = await getVideoDetails(videoId);
        if (video) {
          parts.push({ 
            type: 'youtube', 
            content: videoId,
            metadata: { title: video.title, thumbnail: video.thumbnail, channelTitle: video.channelTitle }
          });
        }
      } catch (e) {
        console.error("Auto YouTube Detail Fetch failed:", e);
      }
    }
    // Default: Just text
    else {
      parts.push({ type: 'text', content: text });
    }

    addAssistantMessage(sessionId, parts, modelId);
  };

  const generateModelResponse = async (model: string, input: string, history: any[], image?: any) => {
    // Map the UI Mode to the Configured Engine
    let engine = model;
    if (systemConfig) {
      if (model === 'groq') engine = systemConfig.fast;
      else if (model === 'research') engine = systemConfig.research;
      else if (model === 'gemini') engine = systemConfig.detail;
    }

    if (engine === 'groq') {
      const textOnlyHistory = history.map(h => ({
        ...h,
        parts: h.parts.filter(p => 'text' in p) as { text: string }[]
      }));
      return await generateGroqResponse(input, textOnlyHistory);
    } else if (engine === 'research') {
      const textOnlyHistory = history.map(h => ({
        ...h,
        parts: h.parts.filter(p => 'text' in p) as { text: string }[]
      }));
      return await generateResearchResponse(input, textOnlyHistory);
    } else if (engine === 'imagine') {
      return `[Imagine Model Placeholder] I cannot yet generate images inside multi-chat logic cleanly. Use the standalone Imagine mode.`;
    } else if (engine === 'openrouter') {
      // Fallback to research/openrouter service
      const textOnlyHistory = history.map(h => ({
        ...h,
        parts: h.parts.filter(p => 'text' in p) as { text: string }[]
      }));
      return await generateResearchResponse(input, textOnlyHistory);
    } else {
      // Default to Gemini (for 'gemini' engine or unknown)
      return await generateTextResponse(input, history, image);
    }
  };

  // Convert ISO timestamp string back to Date for the component
  const localizedMessages = useMemo(() => {
    return (currentSession?.messages || []).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }));
  }, [currentSession, currentSessionId, user?.uid]);
  
  const leftMessages = useMemo(() => 
    localizedMessages.filter(m => m.role === 'user' || m.modelId === multiChatConfig.leftModel || !m.modelId),
    [localizedMessages, multiChatConfig.leftModel]
  );
  
  const rightMessages = useMemo(() => 
    localizedMessages.filter(m => m.role === 'user' || m.modelId === multiChatConfig.rightModel || !m.modelId),
    [localizedMessages, multiChatConfig.rightModel]
  );

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-500 relative ${theme === 'dark' ? 'bg-[#020617] text-white' : 'bg-white text-slate-900'}`}>
      {/* Global Background Decor - Unified Blue Theme for Dark Mode */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className={`absolute top-[-20%] left-[-10%] w-[60%] h-[70%] rounded-full blur-[120px] opacity-20 transition-colors duration-1000 ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-300'}`}></div>
        <div className={`absolute bottom-[-20%] right-[-10%] w-[60%] h-[70%] rounded-full blur-[120px] opacity-20 transition-colors duration-1000 ${theme === 'dark' ? 'bg-indigo-600' : 'bg-blue-200'}`}></div>
      </div>

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
        onOpenProfile={() => {
          if (!user) {
            handleAuthClick('signin');
            return;
          }
          setIsProfileOpen({ open: true, showPricing: false });
        }}
        onOpenPlans={() => {
          navigate('/plans');
        }}
        isAdmin={isAdmin}
        onOpenAdmin={() => setIsAdminDashboardOpen(true)}
        usageCount={usageCount}
        dailyLimit={isPro ? 1000 : dailyLimit}
        isPro={isPro}
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
          
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 -ml-8 transition-transform active:scale-95"
          >
            <img src="/assets/logo.webp" alt="ChatADK" className="w-9 h-9 rounded-xl shadow-xl object-cover border border-white/5" />
            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>ChatADK</span>
          </button>

          {user ? (
            <button 
              onClick={() => setIsProfileOpen({ open: true, showPricing: false })}
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-500/20"
              onClick={() => handleAuthClick('signin')}
            >
              SIGN IN
            </button>
          )}
        </div>

        {/* Desktop Standalone Floating Controls (Hidden on mobile) */}
        <div className="hidden lg:flex fixed top-0 left-0 right-0 z-30 pointer-events-none items-center justify-between p-6">
          <div className="flex items-center gap-3 pointer-events-auto">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-xl transition-all active:scale-90 group
                ${theme === 'dark' ? 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/5 backdrop-blur-xl' : 'bg-white/90 text-slate-500 hover:text-slate-900 border border-slate-200 backdrop-blur-xl'}`}
              title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars-staggered'} group-hover:scale-110 transition-transform text-sm`}></i>
            </button>
            <button 
              onClick={() => navigate('/')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-xl transition-all active:scale-90 group
                ${theme === 'dark' ? 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/5 backdrop-blur-xl' : 'bg-white/90 text-slate-500 hover:text-slate-900 border border-slate-200 backdrop-blur-xl'}`}
              title="Home"
            >
              <img src="/assets/logo.webp" alt="Home" className="w-5 h-5 rounded-lg object-cover" />
            </button>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            {user ? (
              <button 
                onClick={() => setIsProfileOpen({ open: true, showPricing: false })}
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
          className="flex-1 overflow-hidden relative flex flex-col bg-transparent" 
          ref={scrollRef}
        >
          {aiModel !== 'multi' ? (
            <div className={`flex-1 overflow-y-auto px-3 sm:px-8 py-6 custom-scrollbar relative flex flex-col ${localizedMessages.length < 3 ? 'justify-center' : ''}`}>
              <div className={`max-w-3xl mx-auto space-y-2 w-full ${localizedMessages.length < 3 ? 'flex-1 flex flex-col justify-center' : ''}`}>
                {localizedMessages.length === 0 && !currentSession && (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 py-10 opacity-50">
                    <img src="/assets/logo.webp" alt="ChatADK" className="w-16 h-16 rounded-2xl object-cover opacity-40" />
                    <p className={`text-[11px] font-black uppercase tracking-[0.3em] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Select a chat or start a new one</p>
                  </div>
                )}

                {currentSessionId && !currentSession && !currentSessionId.startsWith('new_') && (
                  <div className="flex flex-col items-center justify-center h-full py-20 animate-pulse">
                    <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin mb-4"></div>
                    <p className="text-sm text-slate-500 font-medium uppercase tracking-widest">Loading Conversation...</p>
                  </div>
                )}
                
                {localizedMessages.map((msg) => (
                  <ChatMessageItem 
                    key={msg.id} 
                    message={msg as any} 
                    theme={theme}
                    selectedVoiceId={selectedVoiceId}
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
                        <p className={`text-xs font-bold leading-relaxed truncate ${theme === 'dark' ? 'text-red-200' : 'text-red-900'}`}>{status.error}</p>
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
                        selectedVoiceId={selectedVoiceId}
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
                        selectedVoiceId={selectedVoiceId}
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
                        onClick={() => { 
                          setAiModel('groq'); 
                          setIsModelMenuOpen(false); 
                        }}
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
                          if (!user) {
                            handleAuthClick('signin');
                            setIsModelMenuOpen(false);
                            return;
                          }
                          setAiModel('research'); 
                          setIsModelMenuOpen(false); 
                        }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group relative
                          ${aiModel === 'research' ? (theme === 'dark' ? 'bg-emerald-600/20' : 'bg-emerald-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                      >
                        {!user && (
                          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-500 text-white text-[8px] font-black tracking-widest uppercase">
                            <i className="fas fa-lock text-[7px]"></i> LOGIN
                          </div>
                        )}
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
                          if (!user) {
                            handleAuthClick('signin');
                            setIsModelMenuOpen(false);
                            return;
                          }
                          setAiModel('imagine'); 
                          setIsModelMenuOpen(false); 
                        }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group relative
                          ${aiModel === 'imagine' ? (theme === 'dark' ? 'bg-pink-600/20' : 'bg-pink-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                      >
                        {!user && (
                          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-500 text-white text-[8px] font-black tracking-widest uppercase">
                            <i className="fas fa-lock text-[7px]"></i> LOGIN
                          </div>
                        )}
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
                          if (!user) {
                            handleAuthClick('signin');
                            setIsModelMenuOpen(false);
                            return;
                          }
                          setAiModel('gemini'); 
                          setIsModelMenuOpen(false); 
                        }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group relative
                          ${aiModel === 'gemini' ? (theme === 'dark' ? 'bg-indigo-600/20' : 'bg-indigo-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                      >
                        {!user && (
                          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-500 text-white text-[8px] font-black tracking-widest uppercase">
                            <i className="fas fa-lock text-[7px]"></i> LOGIN
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90
                          ${aiModel === 'gemini' ? 'bg-indigo-600 text-white shadow-lg' : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                          <i className="fas fa-brain text-sm"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Detail</p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-1">Advanced multimodal analysis and technical breakdown.</p>
                        </div>
                      </button>

                      <button 
                        type="button"
                        onClick={() => { 
                          if (!user) {
                            handleAuthClick('signin');
                            setIsModelMenuOpen(false);
                            return;
                          }
                          if (!isPro) { 
                            navigate('/plans');
                            setIsModelMenuOpen(false);
                            return; 
                          }
                          setAiModel('motion'); setIsModelMenuOpen(false); 
                        }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group relative
                          ${aiModel === 'motion' ? (theme === 'dark' ? 'bg-orange-600/20' : 'bg-orange-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                        title={!user ? "Sign in to use Motion" : (!isPro ? "Upgrade to Pro to use Motion Mode" : "")}
                      >
                        {!user ? (
                          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-500 text-white text-[8px] font-black tracking-widest uppercase">
                            <i className="fas fa-lock text-[7px]"></i> LOGIN
                          </div>
                        ) : !isPro && (
                          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-orange-500 text-white text-[8px] font-black tracking-widest uppercase">
                            <i className="fas fa-lock text-[7px]"></i> PRO
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90
                          ${aiModel === 'motion' ? 'bg-orange-600 text-white shadow-lg' : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                          <i className="fas fa-video text-sm"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Motion</p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-1">Generate dynamic videos from prompts.</p>
                        </div>
                      </button>

                      <div 
                        onClick={() => { 
                          if (!user) {
                            handleAuthClick('signin');
                            setIsModelMenuOpen(false);
                            return;
                          }
                          if (!isPro) { 
                            navigate('/plans');
                            setIsModelMenuOpen(false);
                            return; 
                          }
                          setAiModel('multi'); setIsModelMenuOpen(false); 
                        }}
                        className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group/multi-btn relative overflow-hidden cursor-pointer
                          ${aiModel === 'multi' ? (theme === 'dark' ? 'bg-amber-600/20' : 'bg-amber-50') : (theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
                        role="button"
                        tabIndex={0}
                        title={!user ? "Sign in to use Multi Chat" : (!isPro ? "Upgrade to Pro to use Multi Chat" : "")}
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
                          {!user ? (
                            <div className="absolute top-0 right-0 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-500 text-white text-[8px] font-black tracking-widest uppercase shadow-lg">
                              <i className="fas fa-lock text-[7px]"></i> LOGIN
                            </div>
                          ) : !isPro && (
                            <div className="absolute top-0 right-0 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[8px] font-black tracking-widest uppercase shadow-lg">
                              <i className="fas fa-lock text-[7px]"></i> PRO
                            </div>
                          )}
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
                                aiModel === 'motion' ? 'fa-video' :
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
                            onClick={() => {
                              if (!user) {
                                handleAuthClick('signin');
                                return;
                              }
                              fileInputRef.current?.click();
                            }}
                            className={`w-8 h-8 shrink-0 flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'} relative`}
                            title={user ? "Attach Image" : "Sign in to attach images"}
                          >
                            <i className="fas fa-image text-base"></i>
                            {!user && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center border-2 border-slate-900">
                                <i className="fas fa-lock text-[6px] text-white"></i>
                              </div>
                            )}
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
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={handleSelectVoice}
      />
      <UserProfileModal 
        isOpen={isProfileOpen.open}
        onClose={() => setIsProfileOpen({ open: false, showPricing: false })}
        initialShowPricing={isProfileOpen.showPricing}
        user={user}
        theme={theme}
      />
      <AdminDashboardModal 
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
        theme={theme}
      />
      
      {isAdmin && isPlansOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-300">
           <Plans theme={theme} onClose={() => setIsPlansOpen(false)} />
        </div>
      )}

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

      <AnimatePresence>
        {isCompilerOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-[200] bg-slate-950/40"
          >
            <VSCodeCompiler onClose={() => {
              const fallback = previousSessionId || currentSessionId;
              setPreviousSessionId(null);
              if (fallback && !['codeadk','photoadk','converteradk'].includes(fallback)) {
                navigate(`/chat/${fallback}`);
              } else {
                handleNewChat();
              }
            }} />
          </motion.div>
        )}

        {isConverterOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-[200] bg-slate-950/40"
          >
            <LanguageConverter 
              theme={theme === 'dark' ? 'vs-dark' : 'vs'} 
              showHistory={showConverterHistory}
              onClose={() => {
                const fallback = previousSessionId || currentSessionId;
                setPreviousSessionId(null);
                if (fallback && !['codeadk','photoadk','converteradk'].includes(fallback)) {
                  navigate(`/chat/${fallback}`);
                } else {
                  handleNewChat();
                }
              }} 
            />
          </motion.div>
        )}

        {isPhotoAdkOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-[200] bg-slate-950/40"
          >
            <PhotoAdk onClose={() => {
              const fallback = previousSessionId || currentSessionId;
              setPreviousSessionId(null);
              if (fallback && !['codeadk','photoadk','converteradk'].includes(fallback)) {
                navigate(`/chat/${fallback}`);
              } else {
                handleNewChat();
              }
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {status.isSyncing && (
        <div className="fixed bottom-24 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`px-4 py-2 rounded-full border shadow-2xl flex items-center gap-3 backdrop-blur-xl transition-all
            ${theme === 'dark' ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' : 'bg-white/90 border-blue-100 text-blue-600'}`}>
            <i className="fas fa-cloud-upload-alt animate-pulse"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">Cloud Syncing...</span>
          </div>
        </div>
      )}
    </div>
  );
};


export default App;
