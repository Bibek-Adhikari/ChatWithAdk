import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../services/adminService';
import { chatStorageService } from '../services/chatStorageService';
import { ChatSession } from '../types';
import { auth } from '../services/firebase';

interface User {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  lastLogin: string | null;
}

const ADMIN_EMAILS = ['crazybibek4444@gmail.com', 'geniusbibek4444@gmail.com'];

const UsersData: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email || !ADMIN_EMAILS.includes(currentUser.email)) {
        setError("Unauthorized: Admin access required");
        setLoading(false);
        // Add a delay before redirecting so they can see the error
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        // Fetch user basic info
        const users = await adminService.getLatestUsers(100);
        const foundUser = users.find(u => u.id === userId);
        
        if (foundUser) {
          setUser(foundUser);
          // Fetch user sessions
          const userSessions = await chatStorageService.getUserSessions(userId);
          setSessions(userSessions);
        } else {
          setError("User not found");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndFetch();
  }, [userId, navigate]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Authorized Access Only...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
          <i className="fas fa-exclamation-triangle text-red-500 text-2xl" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-widest mb-2">Access Error</h2>
        <p className="text-slate-500 text-sm mb-8">{error || "User data could not be retrieved"}</p>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black tracking-widest transition-all active:scale-95 shadow-xl shadow-blue-500/20"
        >
          RETURN TO SAFETY
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 sm:p-8 ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      <div className="max-w-5xl mx-auto">
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={() => navigate('/?admin=true')}
            className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all active:scale-95 ${theme === 'dark' ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-200 text-slate-600'}`}
          >
            <i className="fas fa-arrow-left text-xs" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Admin Panel</span>
          </button>
          
          <div className="px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-widest">
            Admin View Enabled
          </div>
        </div>

        {/* Profile Card */}
        <div className={`p-8 rounded-[32px] border mb-8 flex flex-col md:flex-row items-center gap-8 ${theme === 'dark' ? 'bg-slate-900 border-white/5 shadow-2xl' : 'bg-white border-slate-200 shadow-xl'}`}>
          <div className={`w-32 h-32 rounded-[32px] overflow-hidden border-4 ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'} shadow-2xl`}>
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                <span className="text-4xl font-black text-white">{user.displayName?.[0] || 'U'}</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h1 className={`text-3xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {user.displayName || 'Anonymous'}
            </h1>
            <p className="text-blue-500 font-bold text-sm mb-4 tracking-tight">{user.email}</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">User ID</p>
                <p className="text-xs font-mono font-bold truncate">{user.id}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Chats</p>
                <p className="text-sm font-black text-indigo-500">{sessions.length}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'} col-span-2 sm:col-span-1`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Last seen</p>
                <p className="text-xs font-bold">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Sessions */}
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-3">
          User Interaction History
          <div className="h-[1px] flex-1 bg-current opacity-10" />
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <div 
                key={session.id}
                className={`group p-6 rounded-2xl border transition-all hover:scale-[1.01] ${theme === 'dark' ? 'bg-slate-900/50 border-white/5 hover:border-white/10' : 'bg-white border-slate-100 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <i className="fas fa-comment-alt text-xs" />
                    </div>
                    <h4 className={`text-[13px] font-black ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      {session.title || 'Untitled Session'}
                    </h4>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {session.messages.slice(-2).map((msg, i) => (
                    <div key={msg.id} className={`p-3 rounded-xl border text-[11px] ${msg.role === 'user' ? (theme === 'dark' ? 'bg-blue-600/10 border-blue-500/20 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-700') : (theme === 'dark' ? 'bg-slate-800 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600')}`}>
                      <span className="font-black uppercase tracking-widest text-[8px] opacity-50 block mb-1">{msg.role}</span>
                      <p className="line-clamp-2">{msg.parts.find(p => p.type === 'text')?.content}</p>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 flex justify-end">
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 opacity-60">
                    Session ID: {session.id}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center opacity-30">
              <i className="fas fa-folder-open text-3xl mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">No cloud sessions found for this user</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersData;
