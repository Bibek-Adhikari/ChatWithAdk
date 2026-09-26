import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Code2, Image as ImageIcon, RefreshCw, ArrowRight } from 'lucide-react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import AuthModal from './AuthModal';
import Sidebar from './Sidebar';
import SettingsModal from './SettingsModal';
import UserProfileModal from './UserProfileModal';
import AdminDashboardModal from './AdminDashboardModal';
import Plans from './Plans';
import { chatStorageService } from '../services/chatStorageService';
import { adminService } from '../services/adminService';
import { ChatSession } from '../types';
import { VOICE_LIBRARY } from '../services/voiceLibrary';
import { readBoolean, readJson, readString, writeString } from '../services/storage';

const ADMIN_EMAILS = [
  "crazybibek4444@gmail.com",
  "bibekadhikari0763@gmail.com"
];

const STORAGE_KEY = 'chat_with_adk_history';

const PRODUCT_STYLES: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-500',
  emerald: 'bg-emerald-500/10 text-emerald-500',
  purple: 'bg-purple-500/10 text-purple-500',
};

const ProductCard = memo(({ product, theme, onNavigate }: {
  product: typeof PRODUCTS[number];
  theme: 'light' | 'dark';
  onNavigate: (path: string) => void;
}) => {
  const isDark = theme === 'dark';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -2 }}
      onClick={() => onNavigate(product.path)}
      className={`group relative p-5 rounded-2xl border cursor-pointer transition-colors text-left
        ${isDark ? 'bg-white/[0.02] border-white/[0.07] hover:bg-white/[0.05]' : 'bg-neutral-50 border-black/[0.07] hover:bg-neutral-100'}`}
    >
      <div className={`w-9 h-9 rounded-xl mb-3 flex items-center justify-center ${PRODUCT_STYLES[product.color]}`}>
        <product.icon size={18} strokeWidth={1.8} />
      </div>
      <h4 className={`text-[13.5px] font-medium tracking-tight ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
        {product.name}
      </h4>
      <p className={`text-[12px] mt-0.5 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>{product.desc}</p>
      <div className={`absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity ${PRODUCT_STYLES[product.color]}`}>
        <ArrowRight size={15} />
      </div>
    </motion.div>
  );
});

const PRODUCTS = [
  { id: 'c', name: 'CodeAdk', icon: Code2, color: 'blue', path: '/codeadk', desc: 'Advanced Compiler' },
  { id: 'p', name: 'PhotoAdk', icon: ImageIcon, color: 'emerald', path: '/photoadk', desc: 'AI Image Editor' },
  { id: 'v', name: 'ConverterAdk', icon: RefreshCw, color: 'purple', path: '/converteradk', desc: 'Polyglot System' },
] as const;

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (readString('theme', 'dark') as 'light' | 'dark') || 'dark'
  );

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      writeString('theme', next, { persist: 'both' });
      return next;
    });
  }, []);

  const handleSelectVoice = useCallback((voiceId: string) => {
    setSelectedVoiceId(voiceId);
    writeString('selectedVoiceId', voiceId, { persist: 'both' });
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return readBoolean('isSidebarOpen', false);
  });

  useEffect(() => {
    writeString('isSidebarOpen', String(isSidebarOpen), { persist: 'both' });
  }, [isSidebarOpen]);

  const [prompt, setPrompt] = useState('');
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'signin' | 'signup' }>({ open: false, mode: 'signin' });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState<{ open: boolean; showPricing: boolean }>({ open: false, showPricing: false });
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    const savedId = readString('selectedVoiceId', '');
    if (savedId && VOICE_LIBRARY.some(v => v.id === savedId)) return savedId;
    const legacy = readString('selectedVoiceURI', '');
    return VOICE_LIBRARY.some(v => v.id === legacy) ? legacy : '';
  });
  const [isProUser, setIsProUser] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const syncSessions = async (currentUser: User) => {
      unsubscribe = chatStorageService.subscribeToUserSessions(currentUser.uid, (cloudSessions) => {
        setSessions(cloudSessions.sort((a, b) => b.updatedAt - a.updatedAt));
      });
    };

    const unsubAuth = onAuthStateChanged(auth, u => {
      setUser(u);
      if (u) {
        // Login completed (even if the popup promise never resolved) — close the modal
        setAuthModal(prev => ({ ...prev, open: false }));
        syncSessions(u);
      } else {
        const guestSessions = readJson<ChatSession[]>(`${STORAGE_KEY}_guest`, [], { prefer: 'local' });
        if (guestSessions.length > 0) {
          setSessions(guestSessions);
        }
      }
    });

    return () => {
      unsubAuth();
      unsubscribe();
    };
  }, []);

  const isAdmin = useMemo(() => {
    return user && user.email && ADMIN_EMAILS.includes(user.email);
  }, [user]);

  useEffect(() => {
    let isActive = true;
    const loadClaims = async () => {
      if (!user) {
        if (isActive) setIsProUser(false);
        return;
      }
      try {
        const tokenResult = await user.getIdTokenResult(true);
        const claims = tokenResult.claims as { pro?: boolean };
        if (isActive) setIsProUser(!!claims.pro);
      } catch (err) {
        console.error('Failed to load user claims:', err);
        if (isActive) setIsProUser(false);
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

  const startChat = useCallback((message?: string) => {
    const id = `new_${Date.now()}`;
    if (message?.trim()) {
      writeString('pending_message', message.trim(), { persist: 'session' });
    }
    navigate(`/chat/${id}`);
  }, [navigate]);

  const handleSelectSession = useCallback((id: string) => {
    navigate(`/chat/${id}`);
  }, [navigate]);

  const handleDeleteSession = useCallback(async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title, updatedAt: Date.now() } : s));
  }, []);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    startChat(prompt);
  }, [prompt, startChat]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleAuthClick = useCallback((mode: 'signin' | 'signup') => {
    setAuthModal({ open: true, mode });
  }, []);

  // Auto-resize textarea
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-[#212121]' : 'bg-white';
  const text = isDark ? 'text-[#ececec]' : 'text-neutral-900';
  const muted = isDark ? 'text-neutral-500' : 'text-neutral-500';

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-500 relative ${bg} ${text}`} style={{ height: '100dvh' }}>
      
      <Sidebar 
        sessions={sessions}
        currentSessionId=""
        onSelectSession={handleSelectSession}
        onNewChat={() => startChat()}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onAuthClick={handleAuthClick}
        theme={theme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen({ open: true, showPricing: false })}
        isAdmin={isAdmin}
        onOpenAdmin={() => setIsAdminDashboardOpen(true)}
        onOpenPlans={() => navigate('/plans')}
        usageCount={0}
        dailyLimit={20}
        isPro={isPro}
      />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative">

      {/* Fixed Header — slim, matches chat */}
      <header className={`flex fixed top-0 left-0 right-0 z-20 items-center justify-between h-14 px-3 sm:px-4 border-b ${isDark ? 'border-white/[0.06] bg-[#212121]/90 backdrop-blur-md' : 'border-black/[0.06] bg-white/90 backdrop-blur-md'}`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-400 hover:bg-white/[0.06] hover:text-white' : 'text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-900'}`}
            title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars-staggered'} text-sm`}></i>
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 group px-1.5"
            aria-label="Home"
          >
            <img
              src="/assets/logo.webp"
              alt="Tufan"
              className="w-7 h-7 rounded-lg object-cover"
            />
            <span className="text-[14px] font-semibold tracking-tight">
              Tufan
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => startChat()}
                className="hidden sm:block px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors"
              >
                New chat
              </button>
              <button
                onClick={() => setIsProfileOpen({ open: true, showPricing: false })}
                className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden text-[13px] font-semibold ${isDark ? 'bg-white/10 text-neutral-200' : 'bg-neutral-200 text-neutral-700'}`}
                title="Profile"
              >
                {user.photoURL && !imageError ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                ) : (user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleAuthClick('signin')}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${isDark ? 'text-neutral-300 hover:bg-white/[0.06]' : 'text-neutral-600 hover:bg-black/[0.05]'}`}
              >
                Log in
              </button>
              <button
                onClick={() => handleAuthClick('signup')}
                className="px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content — scrollable, centered */}
      <main className="flex-1 overflow-y-auto px-4 pt-24 pb-10 z-10 relative flex flex-col items-center custom-scrollbar">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center text-center gap-5 max-w-2xl w-full"
        >
          <img
            src="/assets/logo.webp"
            alt="Tufan"
            className="w-14 h-14 rounded-2xl object-cover shadow-lg"
          />

          <div className="space-y-2">
            <h1 className="text-[28px] sm:text-[36px] font-medium tracking-tight leading-tight">
              How can I help you today?
            </h1>
            <p className={`text-[14.5px] max-w-md mx-auto leading-relaxed ${muted}`}>
              Chat, code, create images, and explore ideas — all in one place.
            </p>
          </div>
        </motion.div>

        {/* Products Grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          className="w-full max-w-[768px] mt-8"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PRODUCTS.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                theme={theme}
                onNavigate={(path) => navigate(path)}
              />
            ))}
          </div>
        </motion.div>
      </main>

      {/* Input Section — matches chat */}
      <footer className={`p-3 sm:p-4 shrink-0 z-10 pb-safe sticky bottom-0 ${isDark ? 'bg-[#212121]' : 'bg-white'}`}>
        <div className="max-w-[768px] mx-auto w-full">
          <form onSubmit={handleSubmit} className="relative">
            <div className={`rounded-[26px] border transition-all focus-within:shadow-lg ${isDark ? 'bg-[#2f2f2f] border-transparent focus-within:border-white/20' : 'bg-[#f4f4f4] border-transparent focus-within:border-black/15 focus-within:bg-white'}`}>
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                placeholder="Message Tufan…"
                rows={1}
                className={`w-full bg-transparent border-none outline-none px-4 sm:px-5 pt-3.5 pb-1 text-[15px] leading-relaxed resize-none overflow-y-auto max-h-[200px] custom-scrollbar ${isDark ? 'text-neutral-100 placeholder:text-neutral-500' : 'text-neutral-900 placeholder:text-neutral-400'}`}
              />
              <div className="flex items-center px-2.5 pb-2.5 pt-1">
                <span className="flex-1" />
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  <ArrowRight size={15} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </form>

          <p className={`mt-2.5 text-center text-[11px] ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Tufan can make mistakes. Verify important information.
          </p>
        </div>
      </footer>

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

      </div>
    </div>
  );
};

export default LandingPage;
