import React, { useState, useMemo } from 'react';
import { ChatSession } from '../types';
import { useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import {
  Search, SquarePen, MessageSquare, Pencil, Trash2,
  Settings, PanelLeftClose, Code2, Image as ImageIcon,
  Repeat2, Gem, ShieldCheck, Check, X, Bell
} from 'lucide-react';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onAuthClick: (mode: 'signin' | 'signup') => void;
  theme: 'light' | 'dark';
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onOpenPlans: () => void;
  usageCount: number;
  dailyLimit: number;
  isPro: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  isOpen,
  onClose,
  user,
  onAuthClick,
  theme,
  onOpenSettings,
  onOpenProfile,
  isAdmin,
  onOpenAdmin,
  onOpenPlans,
  usageCount,
  dailyLimit,
  isPro,
}) => {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [query, setQuery] = useState('');
  const [imageError, setImageError] = useState(false);

  const isDark = theme === 'dark';

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditValue(session.title);
  };

  const handleSaveEdit = (id: string) => {
    if (editValue.trim()) onRenameSession(id, editValue.trim());
    setEditingId(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return list;
    return list.filter(s => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const groups = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    const today: ChatSession[] = [];
    const week: ChatSession[] = [];
    const older: ChatSession[] = [];
    filtered.forEach(s => {
      const age = now - s.updatedAt;
      if (age < day) today.push(s);
      else if (age < 7 * day) week.push(s);
      else older.push(s);
    });
    return [
      { label: 'Today', items: today },
      { label: 'Previous 7 days', items: week },
      { label: 'Older', items: older },
    ].filter(g => g.items.length > 0);
  }, [filtered]);

  const renderItem = (session: ChatSession) => {
    const active = currentSessionId === session.id;
    return (
      <div
        key={session.id}
        onClick={() => {
          if (editingId !== session.id) {
            onSelectSession(session.id);
            if (window.innerWidth < 1024) onClose();
          }
        }}
        className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-[13.5px] transition-colors
          ${active
            ? (isDark ? 'bg-white/[0.07] text-white' : 'bg-black/[0.05] text-neutral-900')
            : (isDark ? 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200' : 'text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900')}`}
      >
        <MessageSquare size={15} strokeWidth={1.8} className={`shrink-0 ${active ? 'opacity-80' : 'opacity-40'}`} />
        {editingId === session.id ? (
          <span className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => handleSaveEdit(session.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveEdit(session.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className={`flex-1 min-w-0 bg-transparent border-b outline-none text-[13.5px] px-0.5 ${isDark ? 'border-white/20 text-white' : 'border-black/20 text-neutral-900'}`}
            />
            <button onClick={() => handleSaveEdit(session.id)} className="p-1 opacity-70 hover:opacity-100"><Check size={13} /></button>
            <button onClick={() => setEditingId(null)} className="p-1 opacity-70 hover:opacity-100"><X size={13} /></button>
          </span>
        ) : (
          <span className="flex-1 truncate font-normal">{session.title || 'New conversation'}</span>
        )}
        {editingId !== session.id && (
          <span className={`items-center gap-0.5 shrink-0 ${active ? 'flex' : 'hidden group-hover:flex'}`}>
            <button
              onClick={e => { e.stopPropagation(); handleStartEdit(session); }}
              className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-white/10 text-neutral-500 hover:text-neutral-200' : 'hover:bg-black/5 text-neutral-400 hover:text-neutral-700'}`}
              title="Rename"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDeleteSession(session.id); }}
              className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-white/10 text-neutral-500 hover:text-red-400' : 'hover:bg-black/5 text-neutral-400 hover:text-red-500'}`}
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-30 lg:hidden animate-fadeIn"
          onClick={onClose}
        />
      )}

      {/* Desktop: in normal flow so the chat shifts. Mobile: fixed overlay. */}
      <aside
        className={`z-40 sidebar-transition flex flex-col shrink-0 overflow-hidden
          fixed inset-y-0 left-0 lg:static lg:h-auto
          ${isOpen ? 'w-[260px] translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0'}
          ${isDark ? 'bg-[#171717]' : 'bg-[#f9f9f9]'}
          ${isOpen ? `border-r ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}` : 'border-r-0'}`}
      >
        <div className="w-[260px] h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-opacity hover:opacity-80">
              <img src="/assets/logo.webp" alt="Tufan" className="w-7 h-7 rounded-lg object-cover" />
              <span className={`text-[14px] font-semibold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>Tufan</span>
            </button>
            <div className="flex items-center gap-0.5">
              <button
                onClick={onOpenSettings}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200' : 'text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800'}`}
                title="Settings & theme"
              >
                <Settings size={16} strokeWidth={1.8} />
              </button>
              <button
                onClick={onClose}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200' : 'text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800'}`}
                title="Close sidebar"
              >
                <PanelLeftClose size={17} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* New chat + search */}
          <div className="px-3 space-y-2 pb-3">
            <button
              onClick={onNewChat}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all active:scale-[0.98] border
                ${isDark
                  ? 'bg-transparent border-white/10 text-neutral-200 hover:bg-white/[0.06]'
                  : 'bg-white border-black/[0.08] text-neutral-800 hover:bg-neutral-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}
            >
              <SquarePen size={16} strokeWidth={1.8} />
              New chat
              <kbd className={`ml-auto hidden xl:flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${isDark ? 'border-white/10 text-neutral-500' : 'border-black/10 text-neutral-400'}`}>⌘K</kbd>
            </button>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors focus-within:border-neutral-400 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-black/[0.07]'}`}>
              <Search size={14} className={isDark ? 'text-neutral-600' : 'text-neutral-400'} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search chats"
                className={`flex-1 min-w-0 bg-transparent outline-none border-none text-[13px] ${isDark ? 'text-neutral-200 placeholder:text-neutral-600' : 'text-neutral-800 placeholder:text-neutral-400'}`}
              />
            </div>
          </div>

          {/* Tools */}
          <div className="px-3 pb-2">
            <p className={`px-1.5 mb-1 text-[11px] font-medium ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>Tools</p>
            <div className="space-y-0.5">
              {[
                { label: 'CodeAdk', icon: Code2, path: '/codeadk' },
                { label: 'PhotoAdk', icon: ImageIcon, path: '/photoadk' },
                { label: 'Converter', icon: Repeat2, path: '/converteradk' },
              ].map(t => (
                <button
                  key={t.path}
                  onClick={() => navigate(t.path)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${isDark ? 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200' : 'text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900'}`}
                >
                  <t.icon size={15} strokeWidth={1.8} className="opacity-60" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-1">
            {filtered.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-14 text-center select-none ${isDark ? 'text-neutral-700' : 'text-neutral-300'}`}>
                <MessageSquare size={26} strokeWidth={1.4} className="mb-3 opacity-60" />
                <p className="text-[12.5px]">{query ? 'No chats found' : 'No conversations yet'}</p>
              </div>
            ) : (
              groups.map(g => (
                <div key={g.label} className="mb-3">
                  <p className={`px-2.5 mb-1 text-[11px] font-medium ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>{g.label}</p>
                  <div className="space-y-0.5">{g.items.map(renderItem)}</div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className={`p-3 space-y-2 border-t ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}>
            {!isPro && (
              <div className={`rounded-xl px-3 py-2.5 ${isDark ? 'bg-white/[0.03]' : 'bg-white border border-black/[0.06]'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] font-medium ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>{usageCount}/{dailyLimit} free messages</span>
                  <button onClick={onOpenPlans} className="text-[11px] font-semibold text-[#4d6bfe] hover:underline flex items-center gap-1">
                    <Gem size={11} /> Upgrade
                  </button>
                </div>
                <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/[0.07]'}`}>
                  <div
                    className="h-full rounded-full bg-[#4d6bfe] transition-all duration-500"
                    style={{ width: `${Math.min((usageCount / dailyLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {isAdmin && (
              <button
                onClick={onOpenAdmin}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${isDark ? 'text-amber-400/90 hover:bg-amber-400/10' : 'text-amber-600 hover:bg-amber-50'}`}
              >
                <ShieldCheck size={15} /> Admin dashboard
              </button>
            )}

            {user ? (
              <div
                onClick={onOpenProfile}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer transition-colors ${isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.04]'}`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0 text-[13px] font-semibold ${isDark ? 'bg-white/10 text-neutral-200' : 'bg-neutral-200 text-neutral-700'}`}>
                  {user.photoURL && !imageError
                    ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={() => setImageError(true)} />
                    : (user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U')}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13px] font-medium truncate leading-tight ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>{isPro ? 'Pro plan' : 'Free plan'}</span>
                </span>
                {isPro && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#4d6bfe]/15 text-[#4d6bfe]">PRO</span>}
                <button
                  onClick={e => { e.stopPropagation(); onOpenSettings(); }}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:bg-white/10 hover:text-neutral-200' : 'text-neutral-400 hover:bg-black/5 hover:text-neutral-700'}`}
                  title="Settings"
                >
                  <Settings size={15} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={onOpenSettings}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${isDark ? 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200' : 'text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900'}`}
                >
                  <Settings size={15} strokeWidth={1.8} className="opacity-60" />
                  Settings & theme
                </button>
                <div className="flex gap-2">
                  <button onClick={() => onAuthClick('signin')} className={`flex-1 py-2 rounded-xl text-[12.5px] font-semibold border transition-all active:scale-[0.98] ${isDark ? 'border-white/10 text-neutral-200 hover:bg-white/[0.06]' : 'border-black/10 text-neutral-700 hover:bg-black/[0.04]'}`}>
                    Log in
                  </button>
                  <button onClick={() => onAuthClick('signup')} className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold bg-[#4d6bfe] hover:bg-[#3d5bef] text-white transition-all active:scale-[0.98]">
                    Sign up
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
