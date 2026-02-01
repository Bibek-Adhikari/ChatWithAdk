
import React from 'react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewChat, 
  onDeleteSession,
  isOpen,
  onClose
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 lg:hidden" 
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-white/5 flex flex-col transition-transform duration-300 transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-4 border-b border-white/5 shrink-0">
          <button 
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/10 active:scale-95"
          >
            <i className="fas fa-plus"></i>
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          <h2 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Recent Chats</h2>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs italic">
              No chat history yet
            </div>
          ) : (
            sessions.sort((a, b) => b.updatedAt - a.updatedAt).map(session => (
              <div 
                key={session.id}
                className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  currentSessionId === session.id 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`}
                onClick={() => {
                  onSelectSession(session.id);
                  if (window.innerWidth < 1024) onClose();
                }}
              >
                <i className={`fas ${currentSessionId === session.id ? 'fa-comment-dots' : 'fa-comment'} shrink-0 text-sm opacity-70`}></i>
                <span className="flex-1 text-sm truncate font-medium">{session.title}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-red-400 transition-all"
                >
                  <i className="fas fa-trash-alt text-[10px]"></i>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/5 text-[10px] text-slate-600 font-medium tracking-tight">
          <div className="flex items-center justify-between">
            <span>v1.2.0 Stable</span>
            <span>By ADK</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
