import React, { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({ isOpen, onClose, theme }) => {
  const [stats, setStats] = useState({ totalUsers: 0, totalSessions: 0 });
  const [latestUsers, setLatestUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [systemStats, users] = await Promise.all([
        adminService.getSystemStats(),
        adminService.getLatestUsers(10)
      ]);
      setStats(systemStats);
      setLatestUsers(users);
    } catch (error) {
      console.error("Failed to load admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={`relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[32px] shadow-2xl border animate-in zoom-in-95 duration-300 flex flex-col
        ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <i className="fas fa-shield-alt text-indigo-400 text-xl"></i>
            </div>
            <div>
              <h2 className={`text-xl font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Admin Dashboard</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Real-time System Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={loadAdminData}
              disabled={loading}
              className={`w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-400 transition-all ${loading ? 'animate-spin' : ''}`}
            >
              <i className="fas fa-sync-alt"></i>
            </button>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-400 transition-all"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {loading && latestUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
               <i className="fas fa-circle-notch fa-spin text-3xl text-indigo-500"></i>
               <p className="text-[10px] font-black uppercase tracking-widest">Fetching Secure Data...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Total Managed Users</p>
                  <h3 className="text-4xl font-black text-blue-500">{stats.totalUsers}</h3>
                  <p className="text-[10px] text-emerald-500 font-bold mt-2">Active Profiles in Firestore</p>
                </div>
                <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Cloud Chat Sessions</p>
                  <h3 className="text-4xl font-black text-indigo-500">{stats.totalSessions}</h3>
                  <p className="text-[10px] text-emerald-500 font-bold mt-2">Syncing across devices</p>
                </div>
                <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Active Admin Status</p>
                  <h3 className="text-4xl font-black text-pink-500">Active</h3>
                  <p className="text-[10px] text-pink-500 font-bold mt-2">Privileged access granted</p>
                </div>
              </div>

              <div className={`rounded-3xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Authenticated Users Log</h4>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Latest Activity</span>
                </div>
                <div className="divide-y divide-white/5">
                  {latestUsers.map((u) => (
                    <div key={u.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <i className="fas fa-user text-indigo-500"></i>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[13px] font-bold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                             {u.displayName || 'Anonymous User'} 
                             <span className="ml-2 text-[10px] font-normal opacity-50 hidden sm:inline">{u.email}</span>
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Last Login: {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         {(u.email === 'crazybibek4444@gmail.com' || u.email === 'geniusbibek4444@gmail.com') && (
                           <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-400 text-[8px] font-black tracking-widest uppercase">Admin</span>
                         )}
                         <i className="fas fa-chevron-right text-[10px] text-slate-600"></i>
                      </div>
                    </div>
                  ))}
                  {latestUsers.length === 0 && !loading && (
                    <div className="p-10 text-center text-slate-500 text-[11px] uppercase tracking-widest">No users tracked in Firestore yet</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};


export default AdminDashboardModal;
