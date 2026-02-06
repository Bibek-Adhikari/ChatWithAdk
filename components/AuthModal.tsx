import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect, 
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { adminService } from '../services/adminService';
import { X, Mail, Lock, User, Loader2, Chrome, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'signin' | 'signup';
  theme: 'light' | 'dark';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode, theme }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Handle redirect result when component mounts (for mobile redirect flow)
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        setLoading(true);
        const result = await getRedirectResult(auth);
        
        if (result) {
          // Successfully returned from redirect
          await adminService.syncUser(result.user);
          onClose();
        }
      } catch (err: any) {
        console.error("Redirect result error:", err);
        setError(err.message || "Failed to complete sign in.");
      } finally {
        setLoading(false);
        setIsRedirecting(false);
      }
    };

    if (isOpen) {
      handleRedirectResult();
    }
  }, [isOpen, onClose]);

  // Check if we were in the middle of a redirect (persisted in sessionStorage)
  useEffect(() => {
    const wasRedirecting = sessionStorage.getItem('auth_redirect_pending');
    if (wasRedirecting === 'true' && isOpen) {
      setIsRedirecting(true);
      sessionStorage.removeItem('auth_redirect_pending');
      
      // Safety timeout: if redirect result doesn't resolve in 5s, clear it
      const timeout = setTimeout(() => {
        setIsRedirecting(false);
        setLoading(false);
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await adminService.syncUser(userCredential.user);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        if (fullName.trim()) {
          await updateProfile(userCredential.user, {
            displayName: fullName.trim()
          });
          await userCredential.user.reload();
        }

        await adminService.syncUser(auth.currentUser || userCredential.user);
      }

      onClose();
    } catch (err: any) {
      console.error("Auth error:", err);
      // User-friendly error messages
      const errorMessages: Record<string, string> = {
        'auth/invalid-credential': 'Invalid email or password. Please try again.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/email-already-in-use': 'An account already exists with this email.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
      };
      
      const code = err.code || '';
      setError(errorMessages[code] || err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      // More reliable mobile detection
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // iOS Safari and many Android browsers work better with redirect
      const useRedirect = isMobile || window.innerWidth < 768;

      if (useRedirect) {
        // Set flag before redirect so we know to show loading state when we return
        sessionStorage.setItem('auth_redirect_pending', 'true');
        setIsRedirecting(true);
        
        // Clear any existing error to prevent confusion
        setError(null);
        
        // Force account selection for better mobile experience
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        
        await signInWithRedirect(auth, googleProvider);
        // Page will reload, no code executes after this
      } else {
        // Desktop: Use popup
        const result = await signInWithPopup(auth, googleProvider);
        await adminService.syncUser(result.user);
        onClose();
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      
      const errorMessages: Record<string, string> = {
        'auth/popup-blocked': 'Popup was blocked. Please allow popups or try again.',
        'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
        'auth/cancelled-popup-request': 'Another sign-in is already in progress.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
      };
      
      const code = err.code || '';
      setError(errorMessages[code] || err.message || "Failed to sign in with Google.");
      setIsRedirecting(false);
      sessionStorage.removeItem('auth_redirect_pending');
    } finally {
      if (!isRedirecting) {
        setLoading(false);
      }
    }
  };

  const handleModeSwitch = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setFullName('');
    setError(null);
  };

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-slate-900/95' : 'bg-white';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const subtextClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBgClass = isDark ? 'bg-slate-800/50 border-white/10' : 'bg-slate-50 border-slate-200';
  const dividerClass = isDark ? 'border-white/10' : 'border-slate-200';

  // Show full-screen loading overlay during redirect
  if (isRedirecting) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className={`${bgClass} rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl border ${dividerClass}`}>
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
            <Chrome className="absolute inset-0 m-auto text-blue-500" size={20} />
          </div>
          <div className="text-center">
            <h3 className={`text-lg font-bold ${textClass}`}>Completing Sign In...</h3>
            <p className={`text-sm ${subtextClass} mt-1`}>Please wait while we redirect you back</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[4px] animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-md my-auto rounded-3xl overflow-hidden shadow-2xl border ${dividerClass} ${bgClass} animate-slideUp`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className={`text-2xl font-bold tracking-tight ${textClass}`}>
                {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className={`text-xs ${subtextClass} mt-1`}>
                {mode === 'signin' ? 'Sign in to continue your session' : 'Start your journey with us'}
              </p>
            </div>
            <button 
              onClick={onClose}
              disabled={loading}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90
                ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Google Sign In First (Best for Mobile) */}
          <button 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full border font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mb-6 shadow-sm
              ${isDark 
                ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-sm font-bold tracking-tight">Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className={`absolute inset-0 flex items-center`}>
              <div className={`w-full border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}></div>
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className={`px-3 uppercase font-bold tracking-widest ${subtextClass} ${bgClass}`}>
                Or use email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name - Sign Up Only */}
            {mode === 'signup' && (
              <div className="animate-fadeIn space-y-1.5">
                <label className={`block text-[10px] font-bold uppercase tracking-widest ${subtextClass}`}>
                  Full Name
                </label>
                <div className="relative group">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${subtextClass} group-focus-within:text-blue-500`}>
                    <User size={18} />
                  </div>
                  <input 
                    type="text"
                    required={mode === 'signup'}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full border rounded-xl py-3 pl-11 pr-4 text-sm transition-all outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 ${inputBgClass} ${textClass}`}
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-widest ${subtextClass}`}>
                Email Address
              </label>
              <div className="relative group">
                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${subtextClass} group-focus-within:text-blue-500`}>
                  <Mail size={18} />
                </div>
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full border rounded-xl py-3 pl-11 pr-4 text-sm transition-all outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 ${inputBgClass} ${textClass}`}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-widest ${subtextClass}`}>
                Password
              </label>
              <div className="relative group">
                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${subtextClass} group-focus-within:text-blue-500`}>
                  <Lock size={18} />
                </div>
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border rounded-xl py-3 pl-11 pr-4 text-sm transition-all outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 ${inputBgClass} ${textClass}`}
                  placeholder="••••••••"
                  autoComplete={mode === 'signin' ? "current-password" : "new-password"}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-start gap-2 animate-shake">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          {/* Mobile Hint */}
          <p className={`mt-4 text-center text-[10px] ${subtextClass}`}>
            {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) 
              ? "You'll be redirected to Google for secure sign-in" 
              : "Secure popup sign-in"}
          </p>

          {/* Mode Switch */}
          <p className={`mt-6 text-center text-sm ${subtextClass}`}>
            {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}
            <button 
              type="button"
              onClick={handleModeSwitch}
              disabled={loading}
              className="ml-1.5 text-blue-500 font-bold hover:text-blue-400 transition-colors disabled:opacity-50"
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;