import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/adminService';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { codeExplanationService, CodeExplanation } from '../services/codeExplanationService';

// Proper TypeScript interfaces
interface User {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  lastLogin: string | null;
}

interface SystemStats {
  totalUsers: number;
  totalSessions: number;
}

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

// Memoized stat card for better performance
interface StatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  color: 'blue' | 'indigo' | 'pink' | 'emerald';
  theme: 'light' | 'dark';
}

const colorMap = {
  blue: 'text-blue-500 bg-blue-500/20 border-blue-500/30',
  indigo: 'text-indigo-500 bg-indigo-500/20 border-indigo-500/30',
  pink: 'text-pink-500 bg-pink-500/20 border-pink-500/30',
  emerald: 'text-emerald-500 bg-emerald-500/20 border-emerald-500/30',
};

const bgMap = {
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  pink: 'bg-pink-500',
  emerald: 'bg-emerald-500',
};

const StatCard = memo(({ label, value, subtext, color, theme }: StatCardProps) => (
  <div className={`
    p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02]
    ${theme === 'dark' 
      ? 'bg-slate-800/40 border-white/5 hover:border-white/10' 
      : 'bg-slate-50 border-slate-100 hover:border-slate-200 shadow-sm'}
  `}>
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
      {label}
    </p>
    <h3 className={`text-4xl font-black ${colorMap[color].split(' ')[0]}`}>
      {value}
    </h3>
    <p className={`text-[10px] font-bold mt-2 ${colorMap[color].split(' ')[0].replace('text-', 'text-')}`}>
      {subtext}
    </p>
  </div>
));

// Memoized user list item
interface UserListItemProps {
  user: User;
  theme: 'light' | 'dark';
  isAdmin: boolean;
  onSelect: (userId: string) => void;
}

const UserListItem = memo(({ user, theme, isAdmin, onSelect }: UserListItemProps) => {
  const initials = user.displayName 
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0].toUpperCase() || '?';

  return (
    <div 
      onClick={() => onSelect(user.id)}
      className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group cursor-pointer"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`
          w-10 h-10 rounded-xl border overflow-hidden flex items-center justify-center shrink-0
          ${theme === 'dark' ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}
        `}>
          {user.photoURL ? (
            <img 
              src={user.photoURL} 
              alt={user.displayName || 'User'} 
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className={`
              text-xs font-bold
              ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}
            `}>
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className={`
            text-[13px] font-bold truncate flex items-center gap-2
            ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}
          `}>
            {user.displayName || 'Anonymous User'}
            <span className={`
              text-[10px] font-normal opacity-50 hidden sm:inline truncate
              ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}
            `}>
              {user.email}
            </span>
          </p>
          <p className="text-[10px] text-slate-500">
            {user.lastLogin 
              ? new Date(user.lastLogin).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Never logged in'
            }
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isAdmin && (
          <span className={`
            px-2 py-0.5 rounded-lg text-[8px] font-black tracking-widest uppercase
            ${theme === 'dark' 
              ? 'bg-indigo-500/20 text-indigo-400' 
              : 'bg-indigo-100 text-indigo-700'}
          `}>
            Admin
          </span>
        )}
        <i className="fas fa-chevron-right text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
});

// Admin emails - move to config or env in production
const ADMIN_EMAILS = ['crazybibek4444@gmail.com', 'geniusbibek4444@gmail.com'];

const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({ 
  isOpen, 
  onClose, 
  theme 
}) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats>({ totalUsers: 0, totalSessions: 0 });
  
  const handleUserSelect = (userId: string) => {
    onClose();
    navigate(`/admin/usersData/${userId}`);
  };
  const [latestUsers, setLatestUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'history'>('overview');
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [explanationHistory, setExplanationHistory] = useState<CodeExplanation[]>([]);
  const [modelConfig, setModelConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadAdminData = useCallback(async () => {
    if (!isOpen) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [systemStats, users, config, supabaseSessions, supabaseExplanations] = await Promise.all([
        adminService.getSystemStats(),
        adminService.getLatestUsers(10),
        adminService.getModelConfig(),
        supabaseStorageService.getAllSessionsForAdmin(),
        codeExplanationService.getLatestExplanations(20)
      ]);
      
      setStats(systemStats);
      setLatestUsers(users);
      setModelConfig(config);
      setSessionHistory(supabaseSessions);
      setExplanationHistory(supabaseExplanations);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load admin data';
      setError(errorMessage);
      console.error('Admin data fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen, loadAdminData]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isUserAdmin = (email: string | null) => 
    email ? ADMIN_EMAILS.includes(email) : false;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop with improved animation */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Content with improved accessibility */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dashboard-title"
        className={`
          relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[32px] 
          shadow-2xl border flex flex-col animate-in zoom-in-95 duration-300
          ${theme === 'dark' 
            ? 'bg-slate-900 border-white/10' 
            : 'bg-white border-slate-200'}
        `}
      >
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className={`
              w-12 h-12 rounded-2xl border flex items-center justify-center
              ${theme === 'dark' 
                ? 'bg-indigo-600/20 border-indigo-500/30' 
                : 'bg-indigo-100 border-indigo-200'}
            `}>
              <i className={`
                fas fa-shield-alt text-xl
                ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}
              `} />
            </div>
            <div>
              <h2 
                id="admin-dashboard-title"
                className={`
                  text-lg sm:text-xl font-black uppercase tracking-wider
                  ${theme === 'dark' ? 'text-white' : 'text-slate-900'}
                `}
              >
                Admin Dashboard
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Real-time System Management
                </p>
                {lastUpdated && (
                  <span className="text-[9px] text-slate-400">
                    • Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`flex p-1 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
              <button 
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all
                  ${activeTab === 'overview' 
                    ? (theme === 'dark' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-600 shadow-sm')
                    : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
              >
                OVERVIEW
              </button>
              <button 
                onClick={() => setActiveTab('models')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all
                  ${activeTab === 'models' 
                    ? (theme === 'dark' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-600 shadow-sm')
                    : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
              >
                SYSTEM
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all
                  ${activeTab === 'history' 
                    ? (theme === 'dark' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-600 shadow-sm')
                    : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
              >
                HISTORY
              </button>
            </div>
            <button 
              onClick={loadAdminData}
              disabled={loading}
              className={`
                w-10 h-10 rounded-xl flex items-center justify-center transition-all
                ${theme === 'dark' 
                  ? 'hover:bg-white/5 text-slate-400' 
                  : 'hover:bg-slate-100 text-slate-600'}
                ${loading ? 'animate-spin' : ''}
                disabled:opacity-50
              `}
              aria-label="Refresh data"
            >
              <i className="fas fa-sync-alt" />
            </button>
            <button 
              onClick={onClose}
              className={`
                w-10 h-10 rounded-xl flex items-center justify-center transition-all
                ${theme === 'dark' 
                  ? 'hover:bg-white/5 text-slate-400 hover:text-white' 
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'}
              `}
              aria-label="Close modal"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-red-500 text-2xl" />
              </div>
              <div className="text-center">
                <p className={`
                  text-sm font-bold uppercase tracking-widest mb-1
                  ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}
                `}>
                  Connection Error
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {error}
                </p>
              </div>
              <button 
                onClick={loadAdminData}
                className={`
                  px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest
                  ${theme === 'dark' 
                    ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800'}
                  transition-all active:scale-95
                `}
              >
                Try Again
              </button>
            </div>
          ) : loading && latestUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
              <div className="relative">
                <i className="fas fa-circle-notch fa-spin text-4xl text-indigo-500" />
                <div className="absolute inset-0 blur-xl bg-indigo-500/30 rounded-full" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">
                Fetching Secure Data...
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' ? (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
                    <StatCard 
                      label="Total Managed Users"
                      value={stats.totalUsers.toLocaleString()}
                      subtext="Active Profiles in Firestore"
                      color="blue"
                      theme={theme}
                    />
                    <StatCard 
                      label="Cloud Chat Sessions"
                      value={stats.totalSessions.toLocaleString()}
                      subtext="Syncing across devices"
                      color="indigo"
                      theme={theme}
                    />
                    <StatCard 
                      label="System Status"
                      value="Active"
                      subtext="Privileged access granted"
                      color="pink"
                      theme={theme}
                    />
                  </div>

                  <div className="space-y-8">
                    {(() => {
                      const now = new Date();
                      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

                      const groups = [
                        { label: 'Active Today', users: latestUsers.filter(u => u.lastLogin && new Date(u.lastLogin) >= today), color: 'text-emerald-500 bg-emerald-500/10' },
                        { label: 'Past 7 Days', users: latestUsers.filter(u => u.lastLogin && new Date(u.lastLogin) < today && new Date(u.lastLogin) >= lastWeek), color: 'text-blue-500 bg-blue-500/10' },
                        { label: 'This Month', users: latestUsers.filter(u => u.lastLogin && new Date(u.lastLogin) < lastWeek && new Date(u.lastLogin) >= lastMonth), color: 'text-indigo-500 bg-indigo-500/10' },
                        { label: 'Earlier Activity', users: latestUsers.filter(u => !u.lastLogin || new Date(u.lastLogin) < lastMonth), color: 'text-slate-500 bg-slate-500/10' }
                      ].filter(g => g.users.length > 0);

                      if (groups.length === 0) return (
                        <div className="p-12 text-center">
                          <i className="fas fa-users text-4xl text-slate-600 mb-4 opacity-50" />
                          <p className="text-slate-500 text-[11px] uppercase tracking-widest font-bold">
                            No users tracked in Firestore yet
                          </p>
                        </div>
                      );

                      return groups.map(group => (
                        <div key={group.label}>
                          <div className="px-4 mb-4 flex items-center gap-3">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${group.color}`}>
                              {group.label}
                            </span>
                            <div className="h-[1px] flex-1 bg-white/5" />
                            <span className="text-[9px] font-bold opacity-30 uppercase">{group.users.length} Users</span>
                          </div>
                          <div className={`
                            rounded-3xl border overflow-hidden divide-y divide-white/5
                            ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100'}
                          `}>
                            {group.users.map(user => (
                              <UserListItem 
                                key={user.id} 
                                user={user} 
                                theme={theme}
                                isAdmin={isUserAdmin(user.email)}
                                onSelect={handleUserSelect}
                              />
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              ) : activeTab === 'models' ? (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className={`p-6 rounded-[32px] border ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">
                        <i className="fas fa-microchip" />
                      </div>
                      <div>
                        <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Model Configuration</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Map UI modes to AI engines</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { id: 'fast', label: 'Fast Mode', icon: 'fa-bolt', color: 'text-blue-400' },
                        { id: 'research', label: 'Research Mode', icon: 'fa-microscope', color: 'text-emerald-400' },
                        { id: 'detail', label: 'Detail Mode', icon: 'fa-brain', color: 'text-indigo-400' }
                      ].map(item => (
                        <div key={item.id} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <i className={`fas ${item.icon} text-[10px] ${item.color}`} />
                            <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                              {item.label}
                            </label>
                          </div>
                          <select 
                            value={modelConfig?.[item.id] || 'groq'}
                            onChange={(e) => setModelConfig((prev: any) => ({ ...prev, [item.id]: e.target.value }))}
                            className={`w-full px-4 py-3 rounded-2xl border outline-none text-xs font-bold transition-all
                              ${theme === 'dark' 
                                ? 'bg-slate-900 border-white/10 text-white focus:border-blue-500' 
                                : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 shadow-sm'}`}
                          >
                            <option value="groq">Groq (Llama 3 70B)</option>
                            <option value="gemini">Gemini (2.0 Flash)</option>
                            <option value="research">DeepSeek (R1 Research)</option>
                            <option value="openrouter">OpenRouter (Auto)</option>
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="mt-10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {saveSuccess && (
                          <span className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-in fade-in zoom-in">
                            <i className="fas fa-check-circle" /> Settings Saved
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={async () => {
                          setIsSaving(true);
                          try {
                            await adminService.updateModelConfig(modelConfig);
                            setSaveSuccess(true);
                            setTimeout(() => setSaveSuccess(false), 3000);
                          } catch (e) {
                            setError("Failed to save configuration");
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                        className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-3
                          ${theme === 'dark' 
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'}
                          ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSaving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}
                        Apply Changes
                      </button>
                    </div>
                  </div>

                  <div className={`p-6 rounded-[32px] border ${theme === 'dark' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                        <i className="fas fa-exclamation-triangle text-xs" />
                      </div>
                      <div>
                        <p className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-amber-500' : 'text-amber-600'} mb-1`}>Critical Update Info</p>
                        <p className={`text-[10px] leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          Changing these mappings will affect all users immediately. New chat sessions will use the updated engine, while active sessions may require a page refresh for complete synchronization.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                  {/* Chat History Section */}
                  <div>
                    <div className="flex items-center gap-3 px-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500">
                        <i className="fas fa-comments text-xs" />
                      </div>
                      <div>
                        <h3 className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Session History (Backup)</h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">Mirrored data from Supabase storage</p>
                      </div>
                    </div>
                    
                    <div className={`rounded-3xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-800/20 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className={`text-[9px] font-black uppercase tracking-[0.15em] ${theme === 'dark' ? 'bg-white/5 text-slate-400' : 'bg-slate-100/50 text-slate-500'}`}>
                            <th className="px-6 py-4">Title</th>
                            <th className="px-6 py-4">User ID</th>
                            <th className="px-6 py-4">Messages</th>
                            <th className="px-6 py-4">Last Activity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {sessionHistory.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-50">
                                No history found in backup storage
                              </td>
                            </tr>
                          ) : (
                            sessionHistory.map((sess) => (
                              <tr key={sess.id} className="hover:bg-white/5 transition-colors group cursor-default">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                      <i className="fas fa-paragraph text-[10px]" />
                                    </div>
                                    <span className={`text-[12px] font-bold truncate max-w-[180px] ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                      {sess.title || "Untitled Session"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-[10px] font-mono opacity-50 font-bold">{sess.user_id.slice(0, 8)}...</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                    {sess.messages?.[0]?.count || 0} MSGS
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {new Date(sess.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Code Explanations Section */}
                  <div>
                    <div className="flex items-center gap-3 px-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                        <i className="fas fa-code text-xs" />
                      </div>
                      <div>
                        <h3 className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Code Analysis History</h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">Tracked AI code explanations</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {explanationHistory.length === 0 ? (
                        <div className={`p-12 text-center rounded-3xl border ${theme === 'dark' ? 'bg-slate-800/20 border-white/5 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">No code analysis history tracked yet</p>
                        </div>
                      ) : (
                        explanationHistory.map((exp, idx) => (
                          <div 
                            key={idx}
                            className={`p-5 rounded-3xl border transition-all hover:scale-[1.01] ${theme === 'dark' ? 'bg-slate-800/40 border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {exp.language}
                                </span>
                                <span className="text-[10px] font-mono opacity-30 font-bold">USER: {exp.user_id.slice(0, 8)}...</span>
                              </div>
                              <span className="text-[9px] font-bold text-slate-500">
                                {new Date(exp.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className={`p-4 rounded-2xl mb-4 text-[11px] font-mono truncate whitespace-pre overflow-hidden ${theme === 'dark' ? 'bg-black/20 text-blue-300/80 border border-white/5' : 'bg-slate-50 text-blue-700/80 border border-slate-200'}`}>
                              {exp.code.trim().slice(0, 150)}...
                            </div>
                            <div className={`text-[11px] leading-relaxed line-clamp-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                              {exp.explanation}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`
          p-4 sm:p-6 border-t border-white/5 flex items-center justify-between shrink-0
          ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-50/50'}
        `}>
          <button 
            onClick={() => {
              onClose();
              // This is a bit tricky since setIsPlansOpen is in App.tsx
              // We can use a custom event or a prop
              window.dispatchEvent(new CustomEvent('open-admin-plans'));
            }}
            className={`
              px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest
              transition-all active:scale-95 flex items-center gap-2
              ${theme === 'dark' 
                ? 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20' 
                : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100'}
            `}
          >
            <i className="fas fa-gem"></i>
            MANAGE PLANS
          </button>
          
          <button 
            onClick={onClose}
            className={`
              px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest
              transition-all active:scale-95
              ${theme === 'dark' 
                ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                : 'bg-slate-800 hover:bg-slate-700 text-white'}
            `}
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(AdminDashboardModal);