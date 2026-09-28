import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect, 
  GoogleAuthProvider,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { adminService } from '../services/adminService';
import { isDisposableEmail } from '../services/disposableEmails';
import { X, Mail, Lock, User, Loader2 } from 'lucide-react';
import { readString, removeKey, writeString } from '../services/storage';

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

  // Check for pending redirects
  useEffect(() => {
    const wasRedirecting = readString('auth_redirect_pending', 'false');
    if (wasRedirecting === 'true' && isOpen) {
      setIsRedirecting(true);
      
      // Safety timeout: if login doesn't happen in 10s, clear it
      const timeout = setTimeout(() => {
        setIsRedirecting(false);
        removeKey('auth_redirect_pending', { persist: 'both' });
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Block temporary / disposable emails before hitting Firebase
    if (isDisposableEmail(email.trim())) {
      setError('Temporary or disposable email addresses are not allowed. Please use a permanent email.');
      return;
    }

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
      // Create a fresh provider instance
      const provider = new GoogleAuthProvider();
      
      // Removed forced 'select_account' to allow automatic sign-in as requested
      // provider.setCustomParameters({ prompt: 'select_account' });

      try {
        // Try popup first (even on mobile). Modern mobile browsers often handle this 
        // as a new tab, which Google considers MORE SECURE than a redirect.
        const result = await signInWithPopup(auth, provider);
        if (result.user) {
          await adminService.syncUser(result.user);
          onClose();
        }
      } catch (popupErr: any) {
        // Fallback to redirect ONLY if the popup was blocked or failed
        if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user') {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          const isSmallScreen = window.innerWidth < 1024;
          
          if (isMobile || isSmallScreen) {
            writeString('auth_redirect_pending', 'true', { persist: 'both' });
            setIsRedirecting(true);
            setError(null);
            
            await signInWithRedirect(auth, provider);
            return;
          }
        }
        
        // If it's not a blockable error or not on mobile, throw it to the outer catch
        throw popupErr;
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
      removeKey('auth_redirect_pending', { persist: 'both' });
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
  const fg = isDark ? 'text-neutral-100' : 'text-neutral-900';
  const muted = isDark ? 'text-neutral-500' : 'text-neutral-400';
  const cardCls = isDark ? 'bg-[#2f2f2f] border-white/10' : 'bg-white border-black/10';
  const inputCls = isDark
    ? 'bg-white/[0.04] border-white/10 text-neutral-100 placeholder:text-neutral-600 focus:border-white/25'
    : 'bg-neutral-50 border-black/10 text-neutral-900 placeholder:text-neutral-400 focus:border-black/25';

  // Show full-screen loading overlay during redirect
  if (isRedirecting) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-fadeIn p-4">
        <div className={`rounded-2xl px-8 py-7 flex flex-col items-center gap-3 shadow-2xl border ${cardCls}`}>
          <Loader2 size={26} className="animate-spin opacity-60" />
          <h3 className={`text-[14px] font-medium ${fg}`}>Completing sign in…</h3>
          <p className={`text-[12.5px] ${muted}`}>Please wait while we redirect you back</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm my-auto rounded-2xl shadow-2xl border ${cardCls} animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-7 relative">
          <button
            onClick={onClose}
            disabled={loading}
            className={`absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:bg-white/10 hover:text-neutral-200' : 'text-neutral-400 hover:bg-black/5 hover:text-neutral-700'}`}
            title="Close"
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <img src="/assets/logo.webp" alt="Tufan" className="w-11 h-11 rounded-2xl object-cover mb-3 shadow-lg" />
            <h2 className={`text-[17px] font-semibold tracking-tight ${fg}`}>
              {mode === 'signin' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className={`text-[13px] mt-1 ${muted}`}>
              {mode === 'signin' ? 'Log in to sync your chats everywhere' : 'Sign up to save chats and unlock more'}
            </p>
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full border font-medium py-2.5 rounded-xl transition-all text-[13.5px] flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-50 mb-4 ${isDark ? 'border-white/15 text-neutral-100 hover:bg-white/[0.06]' : 'border-black/15 text-neutral-800 hover:bg-black/[0.03]'}`}
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
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
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
            <span className={`text-[11.5px] ${muted}`}>or with email</span>
            <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="animate-fadeIn">
                <div className="relative">
                  <User size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
                  <input
                    type="text"
                    required={mode === 'signup'}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-3.5 text-[13.5px] transition-colors outline-none ${inputCls}`}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div className="relative">
              <Mail size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full border rounded-xl py-2.5 pl-10 pr-3.5 text-[13.5px] transition-colors outline-none ${inputCls}`}
                placeholder="Email address"
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <Lock size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full border rounded-xl py-2.5 pl-10 pr-3.5 text-[13.5px] transition-colors outline-none ${inputCls}`}
                placeholder="Password"
                autoComplete={mode === 'signin' ? "current-password" : "new-password"}
              />
            </div>

            {error && (
              <div className={`px-3.5 py-2.5 rounded-xl text-[12.5px] leading-snug border animate-fadeIn ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full text-[13.5px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {mode === 'signin' ? 'Log in' : 'Sign up'}
            </button>
          </form>

          <p className={`mt-5 text-center text-[13px] ${muted}`}>
            {mode === 'signin' ? "New here?" : "Already have an account?"}
            <button
              type="button"
              onClick={handleModeSwitch}
              disabled={loading}
              className={`ml-1.5 font-semibold disabled:opacity-50 ${isDark ? 'text-neutral-100 hover:underline' : 'text-neutral-900 hover:underline'}`}
            >
              {mode === 'signin' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
