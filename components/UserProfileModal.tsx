import React, { useState } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  theme: 'light' | 'dark';
  initialShowPricing?: boolean;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, user, theme }) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  if (!isOpen || !user) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[4px] cursor-pointer"
      onClick={onClose}
    >
      <div 
        className={`glass w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border animate-slide-up max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 flex flex-col items-center">
          <div className="flex justify-between items-center w-full mb-8">
             <h2 className={`text-xl font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Account</h2>
             <button 
              onClick={onClose}
              className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${theme === 'dark' ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-[32px] bg-gradient-to-tr from-blue-600 to-indigo-600 p-1 shadow-2xl">
              <div className="w-full h-full rounded-[28px] overflow-hidden bg-slate-900 flex items-center justify-center border-4 border-slate-900">
                {user.photoURL && !imageError ? (
                  <img 
                    src={user.photoURL} 
                    alt="" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <i className="fas fa-user-astronaut text-4xl text-blue-400"></i>
                )}
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-2xl bg-emerald-500 border-4 border-slate-900 flex items-center justify-center shadow-lg" title="Active">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
            </div>
          </div>

          <div className="text-center w-full mb-8">
            <h3 className={`text-xl font-bold truncate px-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {user.displayName || 'Anonymous Explorer'}
            </h3>
            <p className="text-sm text-slate-500 mt-1 truncate px-4">{user.email}</p>
          </div>

          <div className="w-full space-y-3 mb-8">
            <div className={`flex items-center justify-between p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <i className="fas fa-signal text-emerald-500 text-xs"></i>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Status</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Active Now</span>
            </div>

            <div 
              onClick={() => { onClose(); navigate('/plans'); }}
              className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] ${theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-crown text-amber-500 text-xs"></i>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Plan</span>
              </div>
              <div className="flex items-center gap-2 group">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Basic</span>
                <div className="w-1 h-3 bg-slate-700 rounded-full"></div>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 group-hover:text-blue-400 transition-colors`}>
                  Manage
                </span>
                <i className={`fas fa-chevron-right text-[10px] text-slate-400 transition-transform`}></i>
              </div>
            </div>
          </div>

          <button 
            onClick={() => { signOut(auth); onClose(); }}
            className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all active:scale-[0.98] border border-red-500/20"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
