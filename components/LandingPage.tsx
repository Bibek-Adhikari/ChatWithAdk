import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Code2, Image as ImageIcon, RefreshCw, ArrowRight } from 'lucide-react';
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
  "geniusbibek4444@gmail.com"
];

const STORAGE_KEY = 'chat_with_adk_history';

const ProductCard = memo(({ product, theme, onNavigate }: {
  product: typeof PRODUCTS[number];
  theme: 'light' | 'dark';
  onNavigate: (path: string) => void;
}) => {
  const isDark = theme === 'dark';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -6, scale: 1.02 }}
      onClick={() => onNavigate(product.path)}
      className={`group relative p-6 rounded-[1.5rem] border cursor-pointer transition-colors
        ${isDark ? 'bg-slate-900/50 border-white/5 hover:border-blue-500/30 hover:bg-slate-900/70' : 'bg-white border-slate-200 hover:border-blue-400/40'}
        shadow-xl`}
    >
      <div className={`w-11 h-11 rounded-xl mb-4 flex items-center justify-center
        bg-${product.color}-500/10 text-${product.color}-500
        group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
        <product.icon size={22} strokeWidth={1.5} />
      </div>
      <h4 className={`text-sm font-black tracking-tight mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {product.name}
      </h4>
      <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">{product.desc}</p>
      <div className={`absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity text-${product.color}-500`}>
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
  const bg = isDark ? 'bg-slate-950' : 'bg-slate-50';
  const text = isDark ? 'text-white' : 'text-slate-900';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-500 relative ${bg} ${text}`}>
      
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

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-500 relative">

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden pb-safe">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-600/5 blur-[140px] rounded-full" />
      </div>

      {/* Fixed Header — same as App.tsx */}
      <header className="flex fixed top-0 left-0 right-0 z-20 items-center justify-between px-6 py-5 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-xl transition-all active:scale-90 group
              ${isDark ? 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/5 backdrop-blur-xl' : 'bg-white/90 text-slate-500 hover:text-slate-900 border border-slate-200 backdrop-blur-xl'}`}
            title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars-staggered'} group-hover:scale-110 transition-transform text-sm`}></i>
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 group"
            aria-label="Home"
          >
            <img
              src="/assets/logo.webp"
              alt="ChatADK"
              className="w-8 h-8 rounded-xl object-cover border border-white/10 shadow-md group-hover:scale-105 transition-transform"
            />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80 group-hover:opacity-100 transition-opacity">
              ChatADK
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => startChat()}
                className="hidden sm:block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/20"
              >
                OPEN CHAT
              </button>
              <button 
                onClick={() => setIsProfileOpen({ open: true, showPricing: false })}
                className={`w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center transition-all overflow-hidden shadow-xl ${isDark ? 'bg-slate-900/80 hover:bg-slate-800' : 'bg-white/90 hover:bg-slate-50'}`}
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
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleAuthClick('signin')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${muted} hover:${text}`}
              >
                SIGN IN
              </button>
              <button
                onClick={() => handleAuthClick('signup')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 shadow-lg"
              >
                GET STARTED
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content — scrollable, centered */}
      <main className="flex-1 overflow-y-auto px-4 pt-32 pb-16 z-10 relative flex flex-col items-center custom-scrollbar">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center text-center gap-6 max-w-2xl w-full"
        >
          {/* Logo pulse */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150 pointer-events-none" />
            <img
              src="/assets/logo.webp"
              alt="ChatADK"
              className="relative w-16 h-16 rounded-2xl object-cover shadow-2xl border border-white/10"
            />
          </motion.div>

          <div className="space-y-3">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-none">
              Chat with <span className="text-blue-500">ChatADK</span>
            </h1>
            <p className={`text-base max-w-sm mx-auto font-medium leading-relaxed ${muted}`}>
              Your AI-powered assistant. Ask anything, build anything, create anything.
            </p>
          </div>

          {/* New Chat button */}
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(59,130,246,0.4)' }}
            whileTap={{ scale: 0.96 }}
            onClick={() => startChat()}
            className="group flex items-center gap-3 bg-slate-800/60 hover:bg-slate-800 border border-white/8 text-white px-8 py-3.5 mb-4 rounded-2xl text-sm font-black shadow-lg transition-all"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" strokeWidth={2.5} />
            New Chat
          </motion.button>
        </motion.div>

        {/* Products Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="w-full max-w-3xl space-y-6"
        >
          <div className="flex items-center gap-4 px-1">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />
            <span className="text-[10px] font-black uppercase tracking-[0.45em] text-blue-500/70">Feature Products</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-500/20 to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Input Section — Footer matching App.tsx */}
      <footer className="p-4 sm:p-6 shrink-0 z-10 pb-safe">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative group transition-all duration-300">
            {/* Outer Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[22px] blur-sm opacity-10 group-focus-within:opacity-25 transition duration-500"></div>
            
            <div className={`relative flex items-end gap-2 p-2 rounded-[24px] shadow-2xl transition-all border
              ${isDark 
                ? 'bg-slate-900/80 border-white/5 backdrop-blur-xl' 
                : 'bg-white/90 border-slate-200 backdrop-blur-xl'}`}>
              
              {/* Logo in Input Area */}
              <img 
                src="/assets/logo.webp" 
                alt="Logo" 
                className="w-12 h-12 rounded-xl shadow-lg shrink-0 object-cover" 
              />

              <textarea 
                ref={inputRef}
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className={`flex-1 bg-transparent border-none outline-none px-4 py-3 text-[14.5px] leading-relaxed resize-none overflow-y-auto max-h-[200px] placeholder:text-slate-500/60
                  ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
              />

              <button 
                type="submit"
                disabled={!prompt.trim()}
                className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:opacity-30 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
              >
                <i className="fas fa-arrow-up text-xs"></i>
              </button>
            </div>
          </form>
          
          <div className="mt-4 text-center select-none opacity-100 transition-opacity duration-500">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
              <i className="fas fa-shield-alt mr-2 text-blue-500/50"></i>
              chatAdk may produce inaccurate data. verify critical info.
            </p>
          </div>
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
