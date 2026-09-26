
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  Zap,
  ArrowUp,
  PanelLeft,
  SquarePen,
  ChevronDown,
  Check,
  Paperclip,
  X,
  Globe,
  Lightbulb,
  PenLine,
  GraduationCap,
  Bot,
  List
} from 'lucide-react';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChatMessage, ChatSession, GenerationState, MessagePart } from './types';
import ChatMessageItem from './components/ChatMessageItem';
import PromptTreePanel from './components/PromptTreePanel';
import { supabaseStorageService } from './services/supabaseStorageService';
import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import Plans from './components/Plans';
import SettingsModal from './components/SettingsModal';
import UserProfileModal from './components/UserProfileModal';
import { generateTextResponse } from './services/geminiService';
import { generateGroqResponse } from './services/groqService';
import { generateResearchResponse } from './services/openRouterService';
import { generateCodecraftResponse } from './services/codecraftService';
import { CODECRAFT_MODELS, CODECRAFT_FAMILIES, isCodecraftModel, craftModelLabel, DEFAULT_CRAFT_MODEL } from './services/codecraftModels';
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
  "bibekadhikari0763@gmail.com"
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
  const [aiModel, setAiModel] = useState<'gemini' | 'groq' | 'research' | 'craft' | 'imagine' | 'motion' | 'multi'>('groq');
  const [multiChatConfig, setMultiChatConfig] = useState({
    leftModel: 'groq' as const,
    rightModel: 'gemini' as const,
    dividerPosition: 50,
  });
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  // Craft sub-selector: which of the 33 CodeCraft models backs Craft mode
  const [craftModel, setCraftModel] = useState<string>(() => {
    const saved = readString('craft_model_id', DEFAULT_CRAFT_MODEL);
    return isCodecraftModel(saved) ? saved : DEFAULT_CRAFT_MODEL;
  });
  const [isCraftMenuOpen, setIsCraftMenuOpen] = useState(false);
  const [craftQuery, setCraftQuery] = useState('');
  const craftMenuRef = useRef<HTMLDivElement>(null);
  const selectCraftModel = (id: string) => {
    if (!isCodecraftModel(id)) return;
    setCraftModel(id);
    writeString('craft_model_id', id, { persist: 'both' });
    setIsCraftMenuOpen(false);
  };
  // Grouped + searchable view of the 33 CodeCraft models for the sub-selector
  const craftMenuGroups = useMemo(() => {
    const q = craftQuery.trim().toLowerCase();
    if (q) {
      const flat = CODECRAFT_MODELS.filter(m =>
        m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q) || m.family.toLowerCase().includes(q)
      );
      return [{ family: `${flat.length} match${flat.length === 1 ? '' : 'es'}`, items: flat }];
    }
    return (CODECRAFT_FAMILIES as readonly string[]).map(family => ({
      family,
      items: CODECRAFT_MODELS.filter(m => m.family === family),
    })).filter(g => g.items.length > 0);
  }, [craftQuery]);
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

  const [dailyLimit, setDailyLimit] = useState(20); // Free limit: 20 messages (server quota wins when available)
  const [quotaServerActive, setQuotaServerActive] = useState(false);
  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

  // Server quota is the source of truth when reachable (per-user, per-day,
  // enforced server-side — the localStorage count is only a fallback for
  // guests / unreachable-server mode).
  const refreshServerQuota = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      if (!token) {
        setQuotaServerActive(false);
        return;
      }
      const r = await fetch(`${API_BASE_URL}/api/proxy/quota`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setQuotaServerActive(false);
        return;
      }
      const q = await r.json();
      if (typeof q?.used?.chat === 'number') setUsageCount(q.used.chat);
      if (typeof q?.limits?.chat === 'number') setDailyLimit(q.limits.chat);
      setQuotaServerActive(true);
    } catch {
      setQuotaServerActive(false);
    }
  }, []);
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

  // Prompt tree (DeepSeek-style jump-to-question panel, Supabase-backed)
  const [promptTreeOpen, setPromptTreeOpen] = useState(false);
  const [supabasePrompts, setSupabasePrompts] = useState<{ id: string; text: string }[]>([]);

  const treePrompts = useMemo(() => {
    const live = (currentSession?.messages || [])
      .filter(m => m.role === 'user')
      .map(m => {
        const text = (m.parts || []).filter(p => p.type === 'text').map(p => p.content).join('\n').trim();
        return { id: m.id, text: text || '[image]' };
      });
    if (live.length > 0) return live;
    // Fallback to the Supabase mirror (e.g. history still loading into state)
    return supabasePrompts.map(p => ({ id: p.id, text: p.text }));
  }, [currentSession, supabasePrompts]);

  const jumpToPrompt = useCallback((id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Backfill the tree from Supabase when live state has no prompts yet
  useEffect(() => {
    let cancelled = false;
    setSupabasePrompts([]);
    if (!currentSessionId || !user || currentSessionId.startsWith('new_')) return;
    supabaseStorageService.getSessionPrompts(currentSessionId).then(list => {
      if (!cancelled) setSupabasePrompts(list);
    });
    return () => { cancelled = true; };
  }, [currentSessionId, user]);

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
        // Migrate Guest -> User Cloud if guest data exists.
        // The local guest cache is cleared ONLY after every session is
        // confirmed present in the cloud. Previously removeKey ran even when
        // the (allSettled, never-throwing) saves failed, permanently deleting
        // guest chats that existed nowhere else.
        const guestKey = `${STORAGE_KEY}_guest`;
        const guestSessions = readJson<ChatSession[]>(guestKey, [], { prefer: 'local' });
        if (guestSessions.length > 0) {
          setStatus(prev => ({ ...prev, isSyncing: true }));
          // Save each guest session to cloud
          for (const s of guestSessions) {
            await storageAggregator.saveSession(user.uid, s);
          }
          // Verify before clearing: re-read the cloud and keep anything missing.
          const cloudNow = await chatStorageService.getUserSessions(user.uid).catch(() => []);
          const cloudIds = new Set(cloudNow.map(s => s.id));
          const missing = guestSessions.filter(s => !cloudIds.has(s.id));
          if (missing.length === 0) {
            removeKey(guestKey, { persist: 'both' });
          } else {
            console.warn(`Guest migration incomplete — ${missing.length} session(s) kept locally:`, missing.map(s => s.id));
            setStatus(prev => ({
              ...prev,
              error: `Cloud backup failed for ${missing.length} chat(s) — they are kept on this device. Check your connection and reload.`,
            }));
          }
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
        }, (syncError) => {
          // A dead listener looks exactly like "no chats" — surface it so a
          // permissions/network failure can't silently empty the sidebar.
          console.error('Sidebar sync failed:', syncError);
          setStatus(prev => ({
            ...prev,
            isSyncing: false,
            error: `Chat history sync failed (${syncError.message || 'connection error'}). Your local chats are untouched — check connection and reload.`,
          }));
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
        // Pull server-side chat quota (source of truth when reachable)
        refreshServerQuota();
      } else {
        setQuotaServerActive(false);
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
        setIsCraftMenuOpen(false);
        setIsCompilerOpen(false);
        setIsConverterOpen(false);
        setIsPhotoAdkOpen(false);
      }

    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
      if (craftMenuRef.current && !craftMenuRef.current.contains(e.target as Node)) {
        setIsCraftMenuOpen(false);
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
          parts: [{ type: 'text', content: `${greeting} I am Tufan. How can I help you today?` }],
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
    
    // Local usage count only when the server quota is not authoritative
    // (guests / server unreachable). The server counts metered messages itself.
    if (!isPro && !quotaServerActive) {
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
        // Only real model inputs go back as context: text as-is, images as
        // inline data. Thinking traces, video cards, etc. are skipped —
        // sending them as image payloads corrupts the request.
        parts: (m.parts || [])
          .filter(p => p && p.content && (p.type === 'text' || p.type === 'image'))
          .map(p => {
            if (p.type === 'text') return { text: p.content };
            return { inlineData: { data: p.content, mimeType: p.mimeType || 'image/jpeg' } };
          })
      }));
      
      let responseText = '';
      let generatedImageUrl = '';

      if (aiModel === 'imagine' || currentInput.toLowerCase().startsWith('/image')) {
        if (!user) {
          addAssistantMessage(sessionId, [{ type: 'text', content: "Please sign in to Tufan to generate images and access premium features." }]);
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
          
          await processAssistantResponse(sessionId, leftResponse.text, multiChatConfig.leftModel, leftResponse.thinking);
          await processAssistantResponse(sessionId, rightResponse.text, multiChatConfig.rightModel, rightResponse.thinking);
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

          const response = await generateModelResponse(aiModel, finalInput, history, selectedImage || undefined);
          await processAssistantResponse(sessionId, response.text, undefined, response.thinking);
        }
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setStatus(prev => ({ ...prev, error: err.message || "Connection lost. Please try again." }));
    } finally {
      setStatus(prev => ({ ...prev, isTyping: false }));
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Re-sync server quota display after each message (no-op when unreachable)
      void refreshServerQuota();
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

  const processAssistantResponse = async (sessionId: string, text: string, modelId?: string, thinking?: string) => {
    // 1. Detect if the response contains a /youtube [query] command
    const youtubeSearchMatch = text.match(/\/youtube\s+([^\n]+)/i);
    // 2. Detect if the response contains a direct YouTube URL
    const youtubeUrlMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);

    let parts: MessagePart[] = [];
    let cleanText = text;

    // Reasoning trace first (when the model provides one) — rendered as a
    // collapsible block and persisted with the message for per-user history.
    if (thinking && thinking.trim()) {
      parts.push({ type: 'thinking', content: thinking.trim() });
    }

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

  const generateModelResponse = async (model: string, input: string, history: any[], image?: any): Promise<{ text: string; thinking?: string }> => {
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
    } else if (engine === 'craft') {
      const textOnlyHistory = history.map(h => ({
        ...h,
        parts: h.parts.filter(p => 'text' in p) as { text: string }[]
      }));
      return await generateCodecraftResponse(input, textOnlyHistory, craftModel);
    } else if (engine === 'imagine') {
      return { text: `[Imagine Model Placeholder] I cannot yet generate images inside multi-chat logic cleanly. Use the standalone Imagine mode.` };
    } else if (engine === 'openrouter') {
      // Fallback to research/openrouter service
      const textOnlyHistory = history.map(h => ({
        ...h,
        parts: h.parts.filter(p => 'text' in p) as { text: string }[]
      }));
      return await generateResearchResponse(input, textOnlyHistory);
    } else {
      // Default to Gemini (for 'gemini' engine or unknown — no thinking trace)
      return { text: await generateTextResponse(input, history, image) };
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
    <div
      className={`flex h-screen overflow-hidden transition-colors duration-300 relative ${theme === 'dark' ? 'bg-[#212121] text-[#ececec]' : 'bg-white text-neutral-900'}`}
      style={{ height: '100dvh' }}
    >
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


      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${theme === 'dark' ? 'bg-[#212121]' : 'bg-white'}`}>

        {/* Unified slim top bar — DeepSeek / Claude style */}
        <header className={`flex items-center justify-between h-14 px-3 sm:px-4 shrink-0 sticky top-0 z-20 border-b ${theme === 'dark' ? 'border-white/[0.06] bg-[#212121]/90 backdrop-blur-md' : 'border-black/[0.06] bg-white/90 backdrop-blur-md'}`}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${theme === 'dark' ? 'text-neutral-400 hover:bg-white/[0.06] hover:text-white' : 'text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-900'}`}
              title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <PanelLeft size={18} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => handleNewChat()}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${theme === 'dark' ? 'text-neutral-400 hover:bg-white/[0.06] hover:text-white' : 'text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-900'}`}
              title="New chat (Ctrl+K)"
            >
              <SquarePen size={17} strokeWidth={1.8} />
            </button>
          </div>

          {/* Center: model picker pill */}
          <button
            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium transition-colors ${theme === 'dark' ? 'text-neutral-200 hover:bg-white/[0.06]' : 'text-neutral-700 hover:bg-black/[0.05]'}`}
          >
            Tufan {aiModel === 'gemini' ? 'Detail' : aiModel === 'groq' ? 'Flash' : aiModel === 'craft' ? 'Craft' : aiModel === 'research' ? 'Reasoning' : aiModel === 'imagine' ? 'Imagine' : aiModel === 'motion' ? 'Motion' : 'Multi'}
            <ChevronDown size={15} className={`opacity-50 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex items-center gap-1.5">
            {user ? (
              <button
                onClick={() => setIsProfileOpen({ open: true, showPricing: false })}
                className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden text-[13px] font-semibold transition-transform hover:scale-105 ${theme === 'dark' ? 'bg-white/10 text-neutral-200' : 'bg-neutral-200 text-neutral-700'}`}
                title="Profile"
              >
                {user.photoURL && !imageError ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={() => setImageError(true)} />
                ) : (user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U')}
              </button>
            ) : (
              <>
                <button onClick={() => handleAuthClick('signin')} className={`hidden sm:block px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${theme === 'dark' ? 'text-neutral-300 hover:bg-white/[0.06]' : 'text-neutral-600 hover:bg-black/[0.05]'}`}>
                  Log in
                </button>
                <button onClick={() => handleAuthClick('signup')} className="px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors">
                  Sign up
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Chat Area */}
        <main
          className="flex-1 overflow-hidden relative flex flex-col"
          ref={scrollRef}
        >
          {aiModel !== 'multi' ? (
            <>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar relative flex flex-col">
              <div className="max-w-[768px] mx-auto w-full flex-1 flex flex-col">
                {localizedMessages.length === 0 && !currentSession && (
                  <div className="flex flex-col items-center justify-center flex-1 text-center py-10 min-h-[50vh]">
                    <img src="/assets/logo.webp" alt="Tufan" className="w-14 h-14 rounded-2xl object-cover mb-5 shadow-lg" />
                    <h1 className={`text-[26px] sm:text-[32px] font-medium tracking-tight mb-2 ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
                      How can I help you today?
                    </h1>
                    <p className={`text-[14px] mb-8 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-500'}`}>
                      Ask anything — code, writing, research, or ideas.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-xl">
                      {[
                        { icon: PenLine, label: 'Write', hint: 'Draft an email', prompt: 'Help me draft a professional email' },
                        { icon: Code2, label: 'Code', hint: 'Debug or build', prompt: 'Help me write clean, efficient code for ' },
                        { icon: GraduationCap, label: 'Learn', hint: 'Explain simply', prompt: 'Explain like I am a beginner: ' },
                        { icon: Lightbulb, label: 'Ideas', hint: 'Brainstorm', prompt: 'Brainstorm creative ideas for ' },
                      ].map(s => (
                        <button
                          key={s.label}
                          onClick={() => { setInputValue(s.prompt); inputRef.current?.focus(); }}
                          className={`flex flex-col items-start gap-1 p-3.5 rounded-2xl border text-left transition-all hover-lift ${theme === 'dark' ? 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]' : 'border-black/[0.07] bg-neutral-50 hover:bg-neutral-100'}`}
                        >
                          <s.icon size={17} strokeWidth={1.8} className={theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'} />
                          <span className={`text-[13px] font-medium mt-1 ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>{s.label}</span>
                          <span className={`text-[11.5px] ${theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400'}`}>{s.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentSessionId && !currentSession && !currentSessionId.startsWith('new_') && (
                  <div className="flex flex-col items-center justify-center h-full py-20">
                    <div className={`w-8 h-8 rounded-full border-2 animate-spin mb-4 ${theme === 'dark' ? 'border-white/10 border-t-white/60' : 'border-black/10 border-t-black/60'}`}></div>
                    <p className={`text-[13px] ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>Loading conversation…</p>
                  </div>
                )}
                
                {localizedMessages.map((msg) => (
                  <ChatMessageItem
                    key={msg.id}
                    anchorId={`msg-${msg.id}`}
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
                  <div className="flex items-start gap-3 mb-6">
                    <img src="/assets/logo.webp" alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                    <div className={`flex items-center gap-1.5 py-2 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current thinking-dot" />
                      <span className="w-1.5 h-1.5 rounded-full bg-current thinking-dot" />
                      <span className="w-1.5 h-1.5 rounded-full bg-current thinking-dot" />
                    </div>
                  </div>
                )}

                {status.error && (
                  <div className="max-w-xl mx-auto mb-6 w-full animate-slide-up">
                    <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 border ${theme === 'dark' ? 'bg-red-500/[0.07] border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      <span className="text-[13px] flex-1">{status.error}</span>
                      <button
                        onClick={() => setStatus(prev => ({ ...prev, error: null }))}
                        className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Prompt tree toggle + panel (single-chat only, like DeepSeek) */}
            {treePrompts.length > 0 && !promptTreeOpen && (
              <button
                onClick={() => setPromptTreeOpen(true)}
                title="Jump to prompt"
                className={`absolute right-3 top-3 z-10 w-9 h-9 flex items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all active:scale-95 ${
                  theme === 'dark'
                    ? 'bg-[#2a2a2a]/90 border-white/10 text-neutral-400 hover:text-neutral-100'
                    : 'bg-white/90 border-black/10 text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <List size={16} />
              </button>
            )}
            {treePrompts.length > 0 && promptTreeOpen && (
              <PromptTreePanel
                prompts={treePrompts}
                theme={theme}
                onJump={jumpToPrompt}
                onClose={() => setPromptTreeOpen(false)}
              />
            )}
            </>
          ) : (
            <div className="flex-1 flex overflow-hidden relative group/multi">
              {/* Left Column */}
              <div
                ref={leftScrollRef}
                className={`h-full overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar border-r ${theme === 'dark' ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}
                style={{ width: `${multiChatConfig.dividerPosition}%` }}
              >
                <div className="max-w-xl mx-auto">
                  <div className={`mb-5 px-3 py-2.5 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-neutral-50 border-black/[0.07]'}`}>
                    <span className={`text-[13px] font-medium ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>{multiChatConfig.leftModel}</span>
                    <select
                      value={multiChatConfig.leftModel}
                      onChange={(e) => setMultiChatConfig(prev => ({ ...prev, leftModel: e.target.value as any }))}
                      className={`bg-transparent text-[12px] outline-none cursor-pointer ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}
                    >
                      <option value="groq">Groq</option>
                      <option value="gemini">Gemini</option>
                      <option value="research">Research</option>
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
                className={`absolute top-0 bottom-0 w-1 cursor-col-resize z-50 transition-colors ${isResizing ? (theme === 'dark' ? 'bg-white/30' : 'bg-black/30') : 'hover:bg-neutral-400/40'}`}
                style={{ left: `calc(${multiChatConfig.dividerPosition}% - 0.5px)` }}
                onMouseDown={startResizing}
              >
              </div>

              {/* Right Column */}
              <div
                ref={rightScrollRef}
                className="h-full overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar"
                style={{ width: `${100 - multiChatConfig.dividerPosition}%` }}
              >
                <div className="max-w-xl mx-auto">
                  <div className={`mb-5 px-3 py-2.5 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-neutral-50 border-black/[0.07]'}`}>
                    <span className={`text-[13px] font-medium ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>{multiChatConfig.rightModel}</span>
                    <select
                      value={multiChatConfig.rightModel}
                      onChange={(e) => setMultiChatConfig(prev => ({ ...prev, rightModel: e.target.value as any }))}
                      className={`bg-transparent text-[12px] outline-none cursor-pointer ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}
                    >
                      <option value="groq">Groq</option>
                      <option value="gemini">Gemini</option>
                      <option value="research">Research</option>
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

        {/* Input Section — pinned to viewport bottom, never scrolls away */}
        <footer className={`p-3 sm:p-4 shrink-0 z-10 pb-safe sticky bottom-0 ${theme === 'dark' ? 'bg-[#212121]' : 'bg-white'}`}>
          <div className="max-w-[768px] mx-auto w-full relative">
            {/* Model menu */}
            {isModelMenuOpen && (
              <div
                ref={modelMenuRef}
                onClick={(e) => e.stopPropagation()}
                className={`absolute bottom-[calc(100%+10px)] left-0 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border p-1.5 animate-slide-up z-50 shadow-2xl ${theme === 'dark' ? 'bg-[#2f2f2f] border-white/10' : 'bg-white border-black/10'}`}
              >
                <p className={`px-3 pt-2 pb-1 text-[11px] font-medium ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>Choose a mode</p>
                {[
                  { id: 'groq', name: 'Flash', desc: 'Fast answers for everyday tasks', icon: Zap, lock: false },
                  { id: 'craft', name: 'Craft', desc: '33 models via CodeCraft — login required', icon: Bot, lock: !user },
                  { id: 'research', name: 'Reasoning', desc: 'Deep analysis with DeepSeek R1', icon: Globe, lock: !user },
                  { id: 'gemini', name: 'Detail', desc: 'Multimodal, technical breakdowns', icon: Sparkles, lock: !user },
                  { id: 'imagine', name: 'Imagine', desc: 'Generate images from words', icon: ImageIcon, lock: !user },
                  { id: 'motion', name: 'Motion', desc: 'Generate video — Pro', icon: RefreshCw, lock: !user || !isPro },
                  { id: 'multi', name: 'Multi Chat', desc: 'Compare two models — Pro', icon: Code2, lock: !user || !isPro },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (m.lock) {
                        if (!user) handleAuthClick('signin');
                        else navigate('/plans');
                        setIsModelMenuOpen(false);
                        return;
                      }
                      setAiModel(m.id as any);
                      setIsModelMenuOpen(false);
                      setIsCraftMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${aiModel === m.id ? (theme === 'dark' ? 'bg-white/[0.07]' : 'bg-black/[0.05]') : (theme === 'dark' ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]')}`}
                  >
                    <m.icon size={16} strokeWidth={1.8} className={theme === 'dark' ? 'text-neutral-400 shrink-0' : 'text-neutral-500 shrink-0'} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[13.5px] font-medium leading-tight ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>{m.name}</span>
                      <span className={`block text-[11.5px] truncate ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>{m.desc}</span>
                    </span>
                    {m.lock && <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${theme === 'dark' ? 'bg-white/10 text-neutral-400' : 'bg-black/[0.06] text-neutral-500'}`}>{!user ? 'LOGIN' : 'PRO'}</span>}
                    {aiModel === m.id && <Check size={15} className="text-[#4d6bfe] shrink-0" />}
                  </button>
                ))}
                {(aiModel === 'multi') && (
                  <button type="button" onClick={() => setIsPreviewVideoOpen(true)} className={`w-full text-left px-3 py-2 text-[11.5px] ${theme === 'dark' ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'}`}>
                    ▶ Preview how Multi Chat works
                  </button>
                )}
              </div>
            )}

            {/* Craft model selector — grouped by provider family */}
            {isCraftMenuOpen && aiModel === 'craft' && (
              <div
                ref={craftMenuRef}
                onClick={(e) => e.stopPropagation()}
                className={`absolute bottom-[calc(100%+10px)] left-0 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border animate-slide-up z-50 shadow-2xl flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-[#2f2f2f] border-white/10' : 'bg-white border-black/10'}`}
              >
                <p className={`px-3 pt-2.5 pb-1 text-[11px] font-medium ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>Choose a CodeCraft model · 33 verified</p>
                <div className="px-2 pb-1.5">
                  <input
                    type="text"
                    value={craftQuery}
                    onChange={(e) => setCraftQuery(e.target.value)}
                    placeholder="Search models…"
                    className={`w-full px-3 py-2 rounded-xl border text-[12.5px] outline-none ${theme === 'dark' ? 'bg-black/20 border-white/10 text-neutral-100 placeholder:text-neutral-600 focus:border-white/25' : 'bg-neutral-50 border-black/10 text-neutral-900 placeholder:text-neutral-400 focus:border-black/25'}`}
                  />
                </div>
                <div className="overflow-y-auto custom-scrollbar max-h-[46vh] p-1.5 pt-0">
                  {craftMenuGroups.map(g => (
                    <div key={g.family}>
                      <p className={`px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>{g.family}</p>
                      {g.items.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => selectCraftModel(m.id)}
                          title={m.id}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${craftModel === m.id ? (theme === 'dark' ? 'bg-white/[0.07]' : 'bg-black/[0.05]') : (theme === 'dark' ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]')}`}
                        >
                          <span className="flex-1 min-w-0">
                            <span className={`block text-[13px] font-medium leading-tight ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>{m.label}</span>
                            {m.hint ? <span className={`block text-[11px] truncate ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>{m.hint}</span> : null}
                          </span>
                          {craftModel === m.id && <Check size={15} className="text-[#4d6bfe] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  ))}
                  {craftMenuGroups.length === 0 && (
                    <p className={`px-3 py-4 text-[12px] text-center ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>No models match.</p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSend} className="relative">
              <div className={`relative rounded-[26px] border transition-all focus-within:border-neutral-400 ${theme === 'dark' ? 'bg-[#2f2f2f] border-transparent focus-within:border-white/20' : 'bg-[#f4f4f4] border-transparent focus-within:border-black/15 focus-within:bg-white focus-within:shadow-lg'}`}>
                {selectedImage && !isPromptDisabled && (
                  <div className="px-4 pt-3">
                    <div className="relative inline-block group/img">
                      <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} alt="Selected" className="h-16 w-auto rounded-xl object-cover" />
                      <button type="button" onClick={removeSelectedImage} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shadow">
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                )}
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
                    placeholder={aiModel === 'imagine' ? 'Describe the image you want…' : aiModel === 'research' ? 'Ask a hard question…' : aiModel === 'craft' ? `Ask ${craftModelLabel(craftModel)} anything…` : 'Message Tufan…'}
                    className={`w-full bg-transparent border-none outline-none px-4 sm:px-5 pt-3.5 pb-1 text-[15px] leading-relaxed resize-none overflow-y-auto max-h-[200px] custom-scrollbar ${theme === 'dark' ? 'text-neutral-100 placeholder:text-neutral-500' : 'text-neutral-900 placeholder:text-neutral-400'}`}
                    disabled={status.isTyping}
                  />
                )}
                <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
                  {!isPromptDisabled && (
                    <>
                      <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
                      <button
                        type="button"
                        onClick={() => { if (!user) handleAuthClick('signin'); else fileInputRef.current?.click(); }}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${theme === 'dark' ? 'text-neutral-400 hover:bg-white/10 hover:text-white' : 'text-neutral-500 hover:bg-black/[0.06] hover:text-neutral-900'}`}
                        title="Attach image"
                      >
                        <Paperclip size={17} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsModelMenuOpen(!isModelMenuOpen); }}
                        className={`flex items-center gap-1 pl-2 pr-2.5 py-1.5 rounded-full border text-[12px] font-medium transition-colors ${theme === 'dark' ? 'border-white/10 text-neutral-300 hover:bg-white/[0.06]' : 'border-black/10 text-neutral-600 hover:bg-black/[0.04]'}`}
                      >
                        <Zap size={12} />
                        {aiModel === 'gemini' ? 'Detail' : aiModel === 'groq' ? 'Flash' : aiModel === 'craft' ? 'Craft' : aiModel === 'research' ? 'Reasoning' : aiModel === 'imagine' ? 'Imagine' : aiModel === 'motion' ? 'Motion' : 'Multi'}
                        <ChevronDown size={12} className="opacity-50" />
                      </button>
                      {aiModel === 'craft' && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsModelMenuOpen(false); setIsCraftMenuOpen(!isCraftMenuOpen); }}
                          title="Choose CodeCraft model (33 available)"
                          className={`flex items-center gap-1 pl-2 pr-2.5 py-1.5 rounded-full border text-[12px] font-medium transition-colors max-w-[180px] ${theme === 'dark' ? 'border-[#4d6bfe]/40 text-neutral-200 hover:bg-white/[0.06]' : 'border-[#4d6bfe]/40 text-neutral-700 hover:bg-black/[0.04]'}`}
                        >
                          <Bot size={12} className="shrink-0" />
                          <span className="truncate">{craftModelLabel(craftModel)}</span>
                          <ChevronDown size={12} className="opacity-50 shrink-0" />
                        </button>
                      )}
                    </>
                  )}
                  <span className="flex-1" />
                  {!isPromptDisabled && (
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || status.isTyping}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                      title="Send"
                    >
                      <ArrowUp size={16} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              </div>
            </form>

            <p className={`mt-2.5 text-center text-[11px] ${theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400'}`}>
                Tufan can make mistakes. Verify important information.
            </p>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-4xl aspect-video mx-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video
              src="/pre.webm"
              autoPlay
              controls
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => setIsPreviewVideoOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
            >
              <X size={16} />
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
            className={`fixed inset-0 z-[200] ${theme === 'dark' ? 'bg-black/60' : 'bg-black/30'}`}
          >
            <VSCodeCompiler theme={theme} onClose={() => {
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
            className={`fixed inset-0 z-[200] ${theme === 'dark' ? 'bg-black/60' : 'bg-black/30'}`}
          >
            <PhotoAdk theme={theme} onClose={() => {
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
        <div className="fixed bottom-24 right-6 z-50 animate-fadeIn">
          <div className={`px-3.5 py-2 rounded-full border shadow-lg flex items-center gap-2 text-[12px] ${theme === 'dark' ? 'bg-[#2f2f2f] border-white/10 text-neutral-300' : 'bg-white border-black/10 text-neutral-600'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current thinking-dot" />
            <span className="w-1.5 h-1.5 rounded-full bg-current thinking-dot" />
            <span className="w-1.5 h-1.5 rounded-full bg-current thinking-dot" />
            Syncing…
          </div>
        </div>
      )}
    </div>
  );
};


export default App;
