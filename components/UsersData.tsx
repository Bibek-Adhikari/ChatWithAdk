import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../services/adminService';
import { chatStorageService } from '../services/chatStorageService';
import { ChatSession, ChatMessage } from '../types';
import { auth } from '../services/firebase';

interface User {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  lastLogin: string | null;
  createdAt?: string;
}

const ADMIN_EMAILS = ['crazybibek4444@gmail.com', 'geniusbibek4444@gmail.com'];

// Helper component for stat cards
const StatCard: React.FC<{
  theme: 'light' | 'dark';
  label: string;
  value: string | number;
  color: 'indigo' | 'blue' | 'emerald' | 'slate';
}> = ({ theme, label, value, color }) => {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600',
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    slate: 'from-slate-500 to-slate-600'
  };

  return (
    <div className={`p-4 rounded-2xl border backdrop-blur-sm
      ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</p>
      <p className={`text-xl font-black bg-gradient-to-r ${colors[color]} bg-clip-text text-transparent`}>
        {value}
      </p>
    </div>
  );
};

// Message bubble component for clean display
const MessageBubble: React.FC<{
  message: ChatMessage;
  theme: 'light' | 'dark';
  index: number;
}> = ({ message, theme, index }) => {
  const isUser = message.role === 'user';
  const textContent = message.parts.find(p => p.type === 'text')?.content || '';
  const hasImage = message.parts.some(p => p.type === 'image');
  const hasCode = textContent.includes('```') || textContent.includes('`');

  return (
    <div 
      className={`flex gap-4 ${isUser ? 'flex-row' : 'flex-row-reverse'} mb-6 animate-in slide-in-from-bottom-2 duration-300`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-lg
        ${isUser 
          ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white' 
          : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'}`}>
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-start' : 'items-end'} flex flex-col`}>
        <div className={`px-5 py-4 rounded-2xl shadow-sm border relative overflow-hidden
          ${isUser 
            ? (theme === 'dark' 
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-100 rounded-tl-sm' 
                : 'bg-blue-50 border-blue-200 text-blue-900 rounded-tl-sm')
            : (theme === 'dark' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100 rounded-tr-sm' 
                : 'bg-slate-100 border-slate-200 text-slate-800 rounded-tr-sm')}`}>
          
          {/* Role Badge */}
          <div className="flex items-center gap-2 mb-2 opacity-60">
            <span className={`w-2 h-2 rounded-full ${isUser ? 'bg-blue-500' : 'bg-emerald-500'} animate-pulse`} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">
              {isUser ? 'User Prompt' : 'AI Response'}
            </span>
            {hasImage && <span className="text-[9px] bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full">📎 Image</span>}
            {hasCode && <span className="text-[9px] bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded-full">💻 Code</span>}
          </div>

          {/* Content */}
          <div className="prose prose-sm max-w-none">
            {textContent ? (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium">
                {textContent}
              </p>
            ) : hasImage ? (
              <div className={`p-3 rounded-lg border-2 border-dashed text-center
                ${theme === 'dark' ? 'border-white/20 text-white/50' : 'border-slate-300 text-slate-400'}`}>
                <span className="text-2xl mb-1 block">🖼️</span>
                <span className="text-[10px] font-bold uppercase">Image Attachment</span>
              </div>
            ) : (
              <span className="text-[12px] opacity-50 italic">No text content</span>
            )}
          </div>

          {/* Timestamp */}
          <div className={`mt-3 text-[9px] font-bold uppercase tracking-wider opacity-40 text-right`}>
            {new Date(message.timestamp).toLocaleTimeString()} • {new Date(message.timestamp).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

const UsersData: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state for full conversation view
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email || !ADMIN_EMAILS.includes(currentUser.email)) {
        setError("Unauthorized: Admin access required");
        setLoading(false);
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const users = await adminService.getLatestUsers(100);
        const foundUser = users.find(u => u.id === userId);
        
        if (foundUser) {
          setUser(foundUser);
          const userSessions = await chatStorageService.getUserSessions(userId);
          // Sort by newest first
          setSessions(userSessions.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          ));
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

  // Filter sessions based on search and date
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = searchQuery === '' || 
      session.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.messages.some(m => 
        m.parts.some(p => p.content?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    
    const sessionDate = new Date(session.updatedAt);
    const now = new Date();
    let matchesDate = true;
    
    if (dateFilter === 'today') {
      matchesDate = sessionDate.toDateString() === now.toDateString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = sessionDate >= weekAgo;
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      matchesDate = sessionDate >= monthAgo;
    }
    
    return matchesSearch && matchesDate;
  });

  // Calculate stats
  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);
  const userMessages = sessions.reduce((acc, s) => acc + s.messages.filter(m => m.role === 'user').length, 0);
  const aiMessages = totalMessages - userMessages;

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30 border-t-blue-500" />
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fas fa-shield-alt text-blue-500 text-xs" />
          </div>
        </div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] opacity-50 animate-pulse">Verifying Admin Credentials...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20 animate-bounce">
          <i className="fas fa-exclamation-triangle text-red-500 text-3xl" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-widest mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm mb-8 font-medium">{error || "User data unavailable"}</p>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black tracking-widest transition-all active:scale-95 shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40"
        >
          RETURN TO DASHBOARD
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 sm:p-8 ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <button 
            onClick={() => navigate('/?admin=true')}
            className={`group flex items-center gap-3 px-5 py-3 rounded-2xl transition-all active:scale-95 border
              ${theme === 'dark' ? 'hover:bg-white/5 text-slate-400 border-white/10' : 'hover:bg-slate-200 text-slate-600 border-slate-200'}`}
          >
            <i className="fas fa-arrow-left text-xs group-hover:-translate-x-1 transition-transform" />
            <span className="text-[11px] font-black uppercase tracking-widest">Admin Panel</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live User Data
            </div>
          </div>
        </div>

        {/* Profile Hero Section */}
        <div className={`relative overflow-hidden p-8 sm:p-12 rounded-[40px] border mb-8 
          ${theme === 'dark' 
            ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-white/5' 
            : 'bg-gradient-to-br from-white to-slate-50 border-slate-200'} shadow-2xl`}>
          
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_2px_2px,_currentColor_1px,_transparent_0)] bg-[length:24px_24px]" />
          
          <div className="relative flex flex-col md:flex-row items-center gap-8">
            {/* Avatar */}
            <div className="relative">
              <div className={`w-36 h-36 rounded-[36px] overflow-hidden border-4 shadow-2xl
                ${theme === 'dark' ? 'border-white/10' : 'border-white'} ring-4 ring-blue-500/20`}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                    <span className="text-5xl font-black text-white">{user.displayName?.[0] || '?'}</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg border-4 border-slate-900">
                <i className="fas fa-user-shield text-xs" />
              </div>
            </div>
            
            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className={`text-4xl font-black mb-2 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {user.displayName || 'Anonymous User'}
              </h1>
              <p className="text-blue-500 font-bold text-lg mb-6 tracking-tight flex items-center justify-center md:justify-start gap-2">
                <i className="fas fa-envelope text-xs opacity-50" />
                {user.email || 'No email'}
              </p>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard theme={theme} label="Total Chats" value={sessions.length} color="indigo" />
                <StatCard theme={theme} label="User Msgs" value={userMessages} color="blue" />
                <StatCard theme={theme} label="AI Responses" value={aiMessages} color="emerald" />
                <StatCard theme={theme} label="Last Active" value={user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'} color="slate" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search messages or session titles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all
                ${theme === 'dark' 
                  ? 'bg-slate-900 border-white/10 text-white placeholder-slate-500' 
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
            />
          </div>
          
          <div className="flex gap-2">
            {(['all', 'today', 'week', 'month'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border
                  ${dateFilter === filter 
                    ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/25' 
                    : theme === 'dark' 
                      ? 'bg-slate-900 border-white/10 text-slate-400 hover:text-white' 
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'}`}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-3">
              Chat Sessions
              <span className={`px-3 py-1 rounded-full text-[10px] ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                {filteredSessions.length}
              </span>
            </h3>
          </div>

          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => {
              const lastMessage = session.messages[session.messages.length - 1];
              const previewMsg = lastMessage?.parts.find(p => p.type === 'text')?.content || 'Media message';
              const isLastFromUser = lastMessage?.role === 'user';
              
              return (
                <div 
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`group p-6 rounded-3xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]
                    ${theme === 'dark' 
                      ? 'bg-slate-900/50 border-white/5 hover:border-white/20 hover:bg-slate-900' 
                      : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-xl'}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg
                        ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-50 text-blue-600'}`}>
                        <i className="fas fa-comment-alt" />
                      </div>
                      <div>
                        <h4 className={`text-[15px] font-black mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                          {session.title || 'Untitled Conversation'}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span className="flex items-center gap-1">
                            <i className="fas fa-clock" />
                            {new Date(session.updatedAt).toLocaleDateString()}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-400" />
                          <span>{session.messages.length} messages</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border
                      ${isLastFromUser 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' 
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'}`}>
                      {isLastFromUser ? 'Awaiting Response' : 'Completed'}
                    </div>
                  </div>
                  
                  {/* Last Message Preview */}
                  <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${isLastFromUser ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                        Last {isLastFromUser ? 'User Prompt' : 'AI Response'}
                      </span>
                    </div>
                    <p className={`text-[13px] line-clamp-2 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      {previewMsg}
                    </p>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-2">
                      {session.messages.some(m => m.parts.some(p => p.type === 'image')) && (
                        <span className="text-[9px] bg-orange-500/10 text-orange-500 px-3 py-1.5 rounded-lg font-bold border border-orange-500/20">
                          <i className="fas fa-image mr-1" /> Images
                        </span>
                      )}
                      {session.messages.some(m => 
                        m.parts.some(p => p.content?.includes('```'))
                      ) && (
                        <span className="text-[9px] bg-purple-500/10 text-purple-500 px-3 py-1.5 rounded-lg font-bold border border-purple-500/20">
                          <i className="fas fa-code mr-1" /> Code
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest transition-colors
                      ${theme === 'dark' ? 'text-slate-500 group-hover:text-white' : 'text-slate-400 group-hover:text-blue-600'}`}>
                      View Full Conversation <i className="fas fa-arrow-right ml-1" />
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={`py-20 text-center rounded-3xl border ${theme === 'dark' ? 'bg-slate-900/30 border-white/5' : 'bg-white border-slate-200'}`}>
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl">
                <i className="fas fa-search text-slate-400" />
              </div>
              <p className="text-[12px] font-black uppercase tracking-widest text-slate-500 mb-2">No sessions found</p>
              <p className="text-sm text-slate-400">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Full Conversation Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setSelectedSession(null)} 
          />
          <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[32px] shadow-2xl flex flex-col
            ${theme === 'dark' ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'}`}>
            
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-white/10 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
              <div>
                <h3 className={`text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {selectedSession.title || 'Conversation Details'}
                </h3>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                  {selectedSession.messages.length} messages • {new Date(selectedSession.updatedAt).toLocaleString()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedSession(null)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95
                  ${theme === 'dark' ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'}`}>
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className={`flex-1 overflow-y-auto p-6 space-y-2 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
              {selectedSession.messages.map((message, index) => (
                <MessageBubble 
                  key={message.id} 
                  message={message} 
                  theme={theme} 
                  index={index}
                />
              ))}
              
              {/* End of conversation marker */}
              <div className="flex items-center justify-center gap-4 py-8 opacity-30">
                <div className="h-px flex-1 bg-current" />
                <span className="text-[10px] font-black uppercase tracking-widest">End of Conversation</span>
                <div className="h-px flex-1 bg-current" />
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t flex justify-between items-center text-[10px] font-bold uppercase tracking-widest
              ${theme === 'dark' ? 'border-white/10 text-slate-500 bg-slate-800/30' : 'border-slate-100 text-slate-400 bg-slate-50/50'}`}>
              <span>Session ID: <span className="font-mono text-blue-500">{selectedSession.id}</span></span>
              <button 
                onClick={() => {
                  // Export functionality placeholder
                  alert('Export conversation feature - implement as needed');
                }}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors">
                <i className="fas fa-download mr-2" /> Export Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersData;