import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, RefreshCw, Check, ChevronRight, ChevronLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import { adminService } from '../services/adminService';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { codeExplanationService, CodeExplanation } from '../services/codeExplanationService';
import { API_DEFS, checkApi, maskedKey, isConfigured, ApiDef, ApiStatus, HealthResult } from '../services/apiHealthService';

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

// Minimal stat card
interface StatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  theme: 'light' | 'dark';
}

const StatCard = memo(({ label, value, subtext, theme }: StatCardProps) => (
  <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/[0.07]' : 'bg-neutral-50 border-black/[0.07]'}`}>
    <p className={`text-[12px] font-medium ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>{label}</p>
    <h3 className={`text-[28px] font-semibold tracking-tight mt-1 ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{value}</h3>
    <p className={`text-[11.5px] mt-0.5 ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>{subtext}</p>
  </div>
));

const apiDot: Record<ApiStatus, string> = {
  online: 'bg-emerald-500',
  offline: 'bg-red-500',
  unknown: 'bg-amber-500',
  unconfigured: 'bg-neutral-400',
};

const apiStatusLabel: Record<ApiStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  unknown: 'Unknown',
  unconfigured: 'No key',
};

// Memoized user list item
interface UserListItemProps {
  user: User;
  theme: 'light' | 'dark';
  isAdmin: boolean;
  onSelect: (userId: string) => void;
}

const UserListItem = memo(({ user, theme, isAdmin, onSelect }: UserListItemProps) => {
  const isDark = theme === 'dark';
  const initials = user.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0].toUpperCase() || '?';

  return (
    <div
      onClick={() => onSelect(user.id)}
      className={`px-4 py-3 flex items-center justify-between transition-colors group cursor-pointer ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-[12px] font-semibold ${isDark ? 'bg-white/10 text-neutral-300' : 'bg-neutral-200 text-neutral-600'}`}>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : initials}
        </span>
        <div className="min-w-0">
          <p className={`text-[13.5px] font-medium truncate ${isDark ? 'text-neutral-100' : 'text-neutral-800'}`}>
            {user.displayName || 'Anonymous'}
            {user.email && <span className={`font-normal ml-2 hidden sm:inline ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>{user.email}</span>}
          </p>
          <p className={`text-[11.5px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            {user.lastLogin
              ? new Date(user.lastLogin).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Never logged in'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isAdmin && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-neutral-300' : 'bg-neutral-900 text-white'}`}>Admin</span>
        )}
        <ChevronRight size={15} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`} />
      </div>
    </div>
  );
});

// API detail panel — shown only after clicking a name in the list
interface ApiDetailProps {
  def: ApiDef;
  result?: HealthResult;
  checking: boolean;
  theme: 'light' | 'dark';
  onCheck: (id: string) => void;
  onBack?: () => void;
}

const ApiDetail = memo(({ def, result, checking, theme, onCheck, onBack }: ApiDetailProps) => {
  const isDark = theme === 'dark';
  const muted = isDark ? 'text-neutral-500' : 'text-neutral-400';
  const fg = isDark ? 'text-neutral-100' : 'text-neutral-900';
  const status: ApiStatus = result?.status || (isConfigured(def) ? 'unknown' : 'unconfigured');
  const pct = result?.usedPct ?? null;

  return (
    <div className="animate-fadeIn">
      {onBack && (
        <button onClick={onBack} className={`flex items-center gap-1 text-[12.5px] font-medium mb-3 md:hidden ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          <ChevronLeft size={15} /> All APIs
        </button>
      )}
      <div className="flex items-center gap-2.5 mb-1">
        <span className={`w-2 h-2 rounded-full ${apiDot[status]}`} />
        <h4 className={`text-[15px] font-semibold ${fg}`}>{def.name}</h4>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isDark ? 'border-white/10 text-neutral-400' : 'border-black/10 text-neutral-500'}`}>
          {checking ? 'Checking…' : apiStatusLabel[status]}
        </span>
        <span className={`text-[11px] capitalize ${muted}`}>{def.cost}</span>
      </div>
      <p className={`text-[12px] font-mono mb-3 ${muted}`}>{maskedKey(...def.envKeys)}</p>

      <p className={`text-[13px] leading-relaxed mb-3 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
        {checking ? 'Probing provider…' : (result?.detail || (isConfigured(def) ? 'Not checked yet.' : 'Key missing in .env.'))}
      </p>

      {result?.credits && (
        <p className={`text-[13px] font-medium mb-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{result.credits}</p>
      )}

      {pct !== null && pct !== undefined ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[12px] ${muted}`}>Usage</span>
            <span className={`text-[12px] font-semibold ${pct > 80 ? 'text-red-500' : pct > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>{pct.toFixed(1)}%</span>
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/[0.07]'}`}>
            <div
              className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        </div>
      ) : (
        <p className={`text-[12px] mb-4 ${muted}`}>Usage % is not exposed by this provider.</p>
      )}

      <p className={`text-[12px] font-medium mb-1.5 ${muted}`}>Capabilities</p>
      <ul className="space-y-1 mb-4">
        {def.powers.map(p => (
          <li key={p} className={`text-[13px] flex items-start gap-2 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
            <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />{p}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 mb-3">
        <a
          href={def.dashboard}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium border transition-colors ${isDark ? 'border-white/15 text-neutral-200 hover:bg-white/[0.06]' : 'border-black/15 text-neutral-700 hover:bg-black/[0.04]'}`}
        >
          Provider console <ExternalLink size={13} />
        </a>
        <button
          onClick={() => onCheck(def.id)}
          disabled={checking}
          className="px-3.5 py-2 rounded-full text-[12.5px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {checking ? 'Checking…' : def.cost === 'paid' ? 'Test (uses credit)' : def.cost === 'none' ? 'Refresh' : 'Test'}
        </button>
      </div>
      <p className={`text-[11.5px] leading-relaxed ${muted}`}>{def.quotaNote}</p>
    </div>
  );
});

// Admin emails - move to config or env in production
const ADMIN_EMAILS = ['crazybibek4444@gmail.com', 'geniusbibek4444@gmail.com'];

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'models', label: 'System' },
  { id: 'apis', label: 'APIs' },
  { id: 'history', label: 'History' },
] as const;

const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  theme
}) => {
  const isDark = theme === 'dark';
  const muted = isDark ? 'text-neutral-500' : 'text-neutral-400';
  const fg = isDark ? 'text-neutral-100' : 'text-neutral-900';
  const card = isDark ? 'bg-white/[0.02] border-white/[0.07]' : 'bg-neutral-50 border-black/[0.07]';
  const divider = isDark ? 'border-white/[0.06]' : 'border-black/[0.06]';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'apis' | 'history'>('overview');
  const [apiResults, setApiResults] = useState<Record<string, HealthResult>>({});
  const [apiChecking, setApiChecking] = useState<Record<string, boolean>>({});
  const [apisAutoChecked, setApisAutoChecked] = useState(false);
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);

  const runApiCheck = useCallback(async (id: string) => {
    setApiChecking(prev => ({ ...prev, [id]: true }));
    try {
      const res = await checkApi(id);
      setApiResults(prev => ({ ...prev, [id]: res }));
    } finally {
      setApiChecking(prev => ({ ...prev, [id]: false }));
    }
  }, []);

  // Auto-probe the free checks the first time the APIS tab opens.
  // Paid checks only run on manual tap to save credits.
  useEffect(() => {
    if (activeTab === 'apis' && !apisAutoChecked) {
      setApisAutoChecked(true);
      API_DEFS.filter(d => d.cost === 'free').forEach(d => runApiCheck(d.id));
    }
  }, [activeTab, apisAutoChecked, runApiCheck]);
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

  const selectedApi = API_DEFS.find(d => d.id === selectedApiId) || null;
  const onlineCount = Object.values(apiResults).filter(r => r.status === 'online').length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dashboard-title"
        className={`relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl border flex flex-col animate-slide-up ${isDark ? 'bg-[#2f2f2f] border-white/10' : 'bg-white border-black/10'}`}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b shrink-0 ${divider}`}>
          <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10 text-neutral-200' : 'bg-neutral-900 text-white'}`}>
              <ShieldCheck size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 id="admin-dashboard-title" className={`text-[15px] font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                Admin dashboard
              </h2>
              <p className={`text-[11.5px] ${muted}`}>
                Real-time system management{lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
            <button
              onClick={loadAdminData}
              disabled={loading}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:bg-white/10 hover:text-neutral-200' : 'text-neutral-400 hover:bg-black/5 hover:text-neutral-700'} disabled:opacity-50`}
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:bg-white/10 hover:text-neutral-200' : 'text-neutral-400 hover:bg-black/5 hover:text-neutral-700'}`}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${activeTab === t.id
                  ? (isDark ? 'bg-white/[0.09] text-white' : 'bg-neutral-900 text-white')
                  : (isDark ? 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]' : 'text-neutral-500 hover:text-neutral-800 hover:bg-black/[0.04]')}`}
              >
                {t.label}
                {t.id === 'apis' && <span className={`ml-1.5 text-[11px] ${activeTab === 'apis' ? 'opacity-70' : muted}`}>{onlineCount}/{API_DEFS.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-5 overflow-y-auto custom-scrollbar flex-1">
          {error ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <p className="text-[14px] font-medium text-red-500">Couldn't load admin data</p>
              <p className={`text-[12.5px] max-w-xs ${muted}`}>{error}</p>
              <button
                onClick={loadAdminData}
                className="px-4 py-2 rounded-full text-[12.5px] font-medium bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-all active:scale-[0.98]"
              >
                Try again
              </button>
            </div>
          ) : loading && latestUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={22} className={`animate-spin ${muted}`} />
              <p className={`text-[12.5px] ${muted}`}>Loading…</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
                    <StatCard label="Users" value={stats.totalUsers.toLocaleString()} subtext="Profiles in Firestore" theme={theme} />
                    <StatCard label="Chat sessions" value={stats.totalSessions.toLocaleString()} subtext="Synced across devices" theme={theme} />
                    <StatCard label="System" value="Active" subtext="Privileged access granted" theme={theme} />
                  </div>

                  {(() => {
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

                    const groups = [
                      { label: 'Active today', users: latestUsers.filter(u => u.lastLogin && new Date(u.lastLogin) >= today) },
                      { label: 'Past 7 days', users: latestUsers.filter(u => u.lastLogin && new Date(u.lastLogin) < today && new Date(u.lastLogin) >= lastWeek) },
                      { label: 'This month', users: latestUsers.filter(u => u.lastLogin && new Date(u.lastLogin) < lastWeek && new Date(u.lastLogin) >= lastMonth) },
                      { label: 'Earlier', users: latestUsers.filter(u => !u.lastLogin || new Date(u.lastLogin) < lastMonth) }
                    ].filter(g => g.users.length > 0);

                    if (groups.length === 0) return (
                      <p className={`text-center text-[13px] py-10 ${muted}`}>No users tracked yet.</p>
                    );

                    return groups.map(group => (
                      <div key={group.label} className="mb-5 last:mb-0">
                        <p className={`px-1 mb-1.5 text-[12px] font-medium ${muted}`}>{group.label} · {group.users.length}</p>
                        <div className={`rounded-2xl border overflow-hidden divide-y ${card} ${isDark ? 'divide-white/[0.05]' : 'divide-black/[0.05]'}`}>
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
              )}

              {activeTab === 'models' && (
                <div className="animate-fadeIn space-y-4">
                  <div className={`p-5 rounded-2xl border ${card}`}>
                    <h3 className={`text-[14px] font-semibold ${fg}`}>Model configuration</h3>
                    <p className={`text-[12px] mb-5 ${muted}`}>Map UI modes to AI engines.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { id: 'fast', label: 'Fast mode' },
                        { id: 'research', label: 'Research mode' },
                        { id: 'detail', label: 'Detail mode' }
                      ].map(item => (
                        <div key={item.id}>
                          <label className={`block text-[12px] font-medium mb-1.5 ${muted}`}>{item.label}</label>
                          <select
                            value={modelConfig?.[item.id] || 'groq'}
                            onChange={(e) => setModelConfig((prev: any) => ({ ...prev, [item.id]: e.target.value }))}
                            className={`w-full px-3 py-2.5 rounded-xl border text-[13px] outline-none cursor-pointer appearance-none ${isDark ? 'bg-[#212121] border-white/10 text-neutral-200' : 'bg-white border-black/10 text-neutral-800'}`}
                          >
                            <option value="groq">Groq (Llama 3 70B)</option>
                            <option value="gemini">Gemini (2.0 Flash)</option>
                            <option value="research">DeepSeek (R1 Research)</option>
                            <option value="openrouter">OpenRouter (Auto)</option>
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex items-center justify-end gap-3">
                      {saveSuccess && <span className="text-[12px] text-emerald-500">Saved</span>}
                      <button
                        onClick={async () => {
                          setIsSaving(true);
                          try {
                            await adminService.updateModelConfig(modelConfig);
                            setSaveSuccess(true);
                            setTimeout(() => setSaveSuccess(false), 3000);
                          } catch (e) {
                            setError('Failed to save configuration');
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                        disabled={isSaving}
                        className="px-5 py-2 rounded-full text-[12.5px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                      >
                        {isSaving ? 'Saving…' : 'Apply changes'}
                      </button>
                    </div>
                  </div>
                  <p className={`text-[11.5px] leading-relaxed px-1 ${muted}`}>
                    Changes apply to all users immediately. Active sessions may need a refresh to pick them up.
                  </p>
                </div>
              )}

              {activeTab === 'apis' && (
                <div className="animate-fadeIn">
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-[12px] ${muted}`}>
                      {onlineCount}/{API_DEFS.length} online · free checks auto-run · paid need a tap
                    </p>
                    <button
                      onClick={() => API_DEFS.filter(d => d.cost === 'free').forEach(d => runApiCheck(d.id))}
                      className={`text-[12px] font-medium ${isDark ? 'text-neutral-300 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
                    >
                      Recheck free
                    </button>
                  </div>

                  <div className="grid md:grid-cols-[220px_1fr] gap-3 items-start">
                    {/* Name list — detail opens only on click */}
                    <div className={`${selectedApi ? 'hidden md:block' : 'block'} rounded-2xl border overflow-hidden ${card} ${isDark ? 'divide-white/[0.05]' : 'divide-black/[0.05]'} divide-y`}>
                      {API_DEFS.map(def => {
                        const st: ApiStatus = apiResults[def.id]?.status || (isConfigured(def) ? 'unknown' : 'unconfigured');
                        const active = selectedApiId === def.id;
                        return (
                          <button
                            key={def.id}
                            onClick={() => setSelectedApiId(def.id)}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition-colors ${active
                              ? (isDark ? 'bg-white/[0.06] text-white' : 'bg-black/[0.05] text-neutral-900')
                              : (isDark ? 'text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200' : 'text-neutral-600 hover:bg-black/[0.02] hover:text-neutral-900')}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${apiDot[st]}`} />
                            <span className="flex-1 truncate font-medium">{def.name}</span>
                            <ChevronRight size={14} className={muted} />
                          </button>
                        );
                      })}
                    </div>

                    {/* Detail — only after selection */}
                    <div className={`${selectedApi ? 'block' : 'hidden md:block'} rounded-2xl border p-4 sm:p-5 min-h-[200px] ${card}`}>
                      {selectedApi ? (
                        <ApiDetail
                          def={selectedApi}
                          result={apiResults[selectedApi.id]}
                          checking={!!apiChecking[selectedApi.id]}
                          theme={theme}
                          onCheck={runApiCheck}
                          onBack={() => setSelectedApiId(null)}
                        />
                      ) : (
                        <p className={`text-[13px] text-center py-14 ${muted}`}>Select an API to see its status and details.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="animate-fadeIn space-y-6">
                  <div>
                    <p className={`px-1 mb-1.5 text-[12px] font-medium ${muted}`}>Sessions · Supabase backup</p>
                    <div className={`rounded-2xl border overflow-hidden ${card}`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[520px]">
                          <thead>
                            <tr className={`text-[11px] ${muted}`}>
                              <th className="px-4 py-2.5 font-medium">Title</th>
                              <th className="px-4 py-2.5 font-medium">User</th>
                              <th className="px-4 py-2.5 font-medium">Msgs</th>
                              <th className="px-4 py-2.5 font-medium">Active</th>
                            </tr>
                          </thead>
                          <tbody className={isDark ? 'divide-white/[0.05]' : 'divide-black/[0.05]'}>
                            {sessionHistory.length === 0 ? (
                              <tr><td colSpan={4} className={`px-4 py-8 text-center text-[12.5px] ${muted}`}>No history in backup storage.</td></tr>
                            ) : (
                              sessionHistory.map((sess) => (
                                <tr key={sess.id} className={isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'}>
                                  <td className={`px-4 py-2.5 text-[13px] font-medium truncate max-w-[180px] ${fg}`}>{sess.title || 'Untitled'}</td>
                                  <td className={`px-4 py-2.5 text-[11.5px] font-mono ${muted}`}>{sess.user_id.slice(0, 8)}…</td>
                                  <td className="px-4 py-2.5"><span className={`text-[11px] font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>{sess.messages?.[0]?.count || 0}</span></td>
                                  <td className={`px-4 py-2.5 text-[11.5px] whitespace-nowrap ${muted}`}>
                                    {new Date(sess.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className={`px-1 mb-1.5 text-[12px] font-medium ${muted}`}>Code analyses</p>
                    <div className="space-y-2.5">
                      {explanationHistory.length === 0 ? (
                        <p className={`rounded-2xl border p-8 text-center text-[12.5px] ${card} ${muted}`}>No code analysis history yet.</p>
                      ) : (
                        explanationHistory.map((exp, idx) => (
                          <div key={idx} className={`p-4 rounded-2xl border ${card}`}>
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-neutral-300' : 'bg-neutral-900 text-white'}`}>{exp.language}</span>
                                <span className={`text-[11px] font-mono truncate ${muted}`}>{exp.user_id.slice(0, 8)}…</span>
                              </div>
                              <span className={`text-[11px] whitespace-nowrap ${muted}`}>
                                {new Date(exp.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className={`text-[11.5px] font-mono truncate p-2.5 rounded-xl mb-2 ${isDark ? 'bg-black/30 text-neutral-400' : 'bg-black/[0.03] text-neutral-500'}`}>
                              {exp.code.trim().slice(0, 150)}…
                            </p>
                            <p className={`text-[12.5px] leading-relaxed line-clamp-2 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{exp.explanation}</p>
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
        <div className={`px-5 py-3.5 border-t flex items-center justify-between shrink-0 ${divider}`}>
          <button
            onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('open-admin-plans')); }}
            className={`px-4 py-2 rounded-full text-[12.5px] font-medium transition-colors ${isDark ? 'text-neutral-300 hover:bg-white/[0.06]' : 'text-neutral-600 hover:bg-black/[0.04]'}`}
          >
            Manage plans
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-[12.5px] font-medium bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-all active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(AdminDashboardModal);
