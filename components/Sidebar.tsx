
import { ChatSession } from '../types';
import { User, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onAuthClick: (mode: 'signin' | 'signup') => void;
  theme: 'light' | 'dark';
}

const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewChat, 
  onDeleteSession,
  isOpen,
  onClose,
  user,
  onAuthClick,
  theme
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
        fixed inset-y-0 left-0 z-40 w-72 border-r flex flex-col transition-transform duration-300 transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
        ${theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'}
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
                  ? 'bg-blue-600/10 text-blue-500 border border-blue-600/20' 
                  : theme === 'dark' 
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
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

        <div className="p-4 border-t border-white/5">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    <i className="fas fa-user text-blue-400 text-xs"></i>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-[10px] font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.displayName || user.email?.split('@')[0] || 'User'}</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Active Now</p>
                </div>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                title="Sign Out"
              >
                <i className="fas fa-sign-out-alt text-xs"></i>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button 
                  onClick={() => onAuthClick('signin')}
                  className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-[10px] font-bold transition-all border border-white/5 active:scale-95"
                >
                  SIGN IN
                </button>
                <button 
                  onClick={() => onAuthClick('signup')}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-lg shadow-blue-500/10 active:scale-95"
                >
                  SIGN UP
                </button>
              </div>
              <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em] mt-1">Smart Chat & Studio</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};


export default Sidebar;
