
import React, { useState } from 'react';
import { ChatSession } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

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
  isPro
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [imageError, setImageError] = useState(false);

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditValue(session.title);
  };

  const handleSaveEdit = (id: string) => {
    if (editValue.trim()) {
      onRenameSession(id, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Desktop/Mobile Backdrop - Hidden on LG to allow interaction */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-30 transition-all duration-300 cursor-pointer lg:hidden" 
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-40 sidebar-transition flex flex-col shrink-0 overflow-hidden
        ${isOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full lg:translate-x-0'}
        ${theme === 'dark' ? 'bg-[#0f172a] border-r border-white/5' : 'bg-[#ffffff] border-r border-slate-200'}
        ${isOpen && window.innerWidth < 1024 ? 'shadow-[0_0_40px_rgba(0,0,0,0.5)]' : ''}
      `}>
        {/* Fixed width inner container to prevent content compression */}
        <div className="w-72 h-full flex flex-col shrink-0">
          <div className="p-6 flex flex-col gap-6 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/assets/logo.webp" alt="ChatADK" className="w-12 h-12 rounded-xl shadow-2xl object-cover mb-1" />
                <div className="flex flex-col">
                  <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-white">ChatADK</h2>
                  <p className="text-[8px] font-bold text-blue-500 uppercase tracking-widest opacity-80">Intelligence App</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link 
                  to="/notifications"
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800/50 text-slate-500 transition-all relative"
                  title="Updates"
                >
                  <i className="fas fa-bell text-xs"></i>
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#0f172a]"></span>
                </Link>
                <button 
                  onClick={onOpenPlans}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800/50 text-slate-500 transition-all"
                  title="Plans"
                >
                  <i className="fas fa-gem text-xs"></i>
                </button>
                <button 
                  onClick={onOpenSettings}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800/50 text-slate-500 transition-all"
                  title="Settings"
                >
                  <i className="fas fa-cog text-xs"></i>
                </button>
                <button 
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800/50 text-slate-500 transition-all lg:hidden"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </div>
            </div>

            {/* Daily Limit Tracker - Hidden for Pro/Admin */}
            {!isPro && (
              <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Daily Limit</span>
                  <span className={`text-[10px] font-black tracking-widest ${usageCount >= dailyLimit ? 'text-red-500' : 'text-blue-500'}`}>
                    {usageCount}/{dailyLimit}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800/20 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${usageCount >= dailyLimit ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min((usageCount / dailyLimit) * 100, 100)}%` }}
                  />
                </div>
                <button 
                  onClick={onOpenPlans}
                  className="mt-3 w-full text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-1"
                >
                  Upgrade for more <i className="fas fa-arrow-right text-[8px]"></i>
                </button>
              </div>
            )}
            
            <button 
              onClick={onNewChat}
              className="group relative w-full overflow-hidden flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95"
            >
              <i className="fas fa-plus-circle text-lg opacity-80 group-hover:scale-110 transition-transform"></i>
              <span>New Thread</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2 space-y-2">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-30 select-none">
                <i className="fas fa-feather-alt text-3xl mb-4"></i>
                <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Start a new conversation</p>
              </div>
            ) : (
              sessions.sort((a, b) => b.updatedAt - a.updatedAt).map((session, index) => (
                <div 
                  key={session.id}
                  style={{ animationDelay: `${index * 40}ms` }}
                  className={`group relative flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-300 border animate-slide-in
                    ${currentSessionId === session.id 
                      ? 'bg-blue-600/10 text-blue-500 border-blue-500/30' 
                      : theme === 'dark' 
                        ? 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-100 border-transparent'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'}`}
                  onClick={() => {
                    if (editingId !== session.id) {
                      onSelectSession(session.id);
                      if (window.innerWidth < 1024) onClose();
                    }
                  }}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${currentSessionId === session.id ? 'bg-blue-500/20 rotate-12' : 'bg-slate-800/30 group-hover:scale-110'}`}>
                     <i className={`fas ${currentSessionId === session.id ? 'fa-comment-dots text-blue-400' : 'fa-comment opacity-30 text-xs'}`}></i>
                  </div>

                  {editingId === session.id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSaveEdit(session.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(session.id)}
                      className="flex-1 bg-transparent border-none outline-none text-[13px] font-semibold text-white p-0"
                    />
                  ) : (
                    <span className="flex-1 text-[13px] truncate font-semibold tracking-tight">{session.title}</span>
                  )}

                  <div className={`flex items-center gap-1 transition-all duration-300 
                    ${currentSessionId === session.id 
                      ? 'opacity-100 translate-x-0' 
                      : 'opacity-0 lg:group-hover:opacity-100 translate-x-2 lg:group-hover:translate-x-0'}`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(session); }}
                      className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors"
                    >
                      <i className="fas fa-pen text-[10px]"></i>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <i className="fas fa-trash-alt text-[10px]"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 border-t border-white/5 bg-black/5">
            {user ? (
              <div 
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/20 border border-white/5 hover:bg-slate-800/40 transition-all cursor-pointer group/user"
                onClick={onOpenProfile}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 group-hover/user:scale-105 transition-transform">
                    {user.photoURL && !imageError ? (
                      <img 
                        src={user.photoURL} 
                        alt="" 
                        className="w-full h-full rounded-xl object-cover" 
                        referrerPolicy="no-referrer"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <i className="fas fa-user-astronaut text-blue-400"></i>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-[11px] font-black truncate leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.displayName || user.email?.split('@')[0]}</p>
                      {isPro && (
                        <span className="shrink-0 px-1 py-0.5 rounded-[4px] bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[6px] font-black uppercase tracking-widest">
                          PRO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-1 h-1 rounded-full ${isPro ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`}></div>
                      <p className={`text-[9px] font-bold uppercase tracking-widest leading-none ${isPro ? 'text-emerald-500' : 'text-slate-500'}`}>
                        {isPro ? 'Pro Member' : 'Basic Plan'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 flex items-center justify-center text-slate-500 group-hover/user:text-blue-400 transition-all">
                  <i className="fas fa-chevron-right text-[10px]"></i>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => onAuthClick('signin')}
                  className="w-full py-3 bg-slate-800/50 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black tracking-widest border border-white/5 transition-all active:scale-95"
                >
                  SIGN IN
                </button>
                <button 
                  onClick={() => onAuthClick('signup')}
                  className="w-full py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-[10px] font-black tracking-widest transition-all shadow-xl active:scale-95"
                >
                  GET STARTED
                </button>
              </div>
            )}
            
            {isAdmin && (
              <button 
                onClick={onOpenAdmin}
                className="w-full mt-4 py-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-xl text-[10px] font-black tracking-widest border border-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <i className="fas fa-shield-alt"></i>
                ADMIN DASHBOARD
              </button>
            )}
          </div>

        </div>
      </aside>
    </>
  );
};

export default Sidebar;
