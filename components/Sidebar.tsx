
import React, { useState } from 'react';
import { ChatSession } from '../types';
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
  onOpenSettings
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">History</h2>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={onOpenSettings}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800/50 text-slate-500 transition-all"
                  title="Settings"
                >
                  <i className="fas fa-cog text-xs"></i>
                </button>
                <button 
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800/50 text-slate-500 transition-all"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </div>
            </div>
            
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
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/20 border border-white/5 hover:bg-slate-800/40 transition-all cursor-default">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <i className="fas fa-user-astronaut text-blue-400"></i>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-black truncate leading-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.displayName || user.email?.split('@')[0]}</p>
                    <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest leading-none mt-1">Online</p>
                  </div>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 transition-all"
                  title="Secure Logout"
                >
                  <i className="fas fa-power-off text-xs"></i>
                </button>
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
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
