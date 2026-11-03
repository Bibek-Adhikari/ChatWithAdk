import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  Check, 
  Sparkles, 
  Zap, 
  Building2, 
  ArrowLeft, 
  Sun, 
  Moon, 
  CreditCard, 
  Landmark, 
  Wallet,
  X,
  Lock,
  ShieldCheck,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { readString, writeString } from '../services/storage';
import { auth } from '../services/firebase';
import { createPaymentIntent, confirmCardPayment, finalizePayment } from '../services/stripeService';
import AuthModal from './AuthModal';

// --- Types ---

type BillingCycle = 'monthly' | 'yearly';
type PaymentMethod = 'card' | 'paypal' | 'transfer';

// Billing contact for methods that are not self-serve yet.
const SUPPORT_EMAIL = 'crazybibek4444@gmail.com';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '15px',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      '::placeholder': { color: '#64748b' },
    },
    invalid: { color: '#f87171', iconColor: '#f87171' },
  },
  hidePostalCode: false,
};

interface PricingTier {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number; // Already discounted
  period: string;
  description: string;
  features: string[];
  gradient: string;
  icon: React.ReactNode;
  popular?: boolean;
}

// --- Data ---

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 0,
    priceYearly: 0,
    period: 'forever',
    description: 'Perfect for trying out Tufan capabilities.',
    features: [
      'Access to Basic Models',
      '20 Messages per Day',
      'Standard Support',
      '1MB Image/File Uploads',
      'Web-only Access'
    ],
    gradient: 'from-blue-400 to-cyan-300',
    icon: <Zap className="w-6 h-6" />,
  },
  {
    id: 'pro',
    name: 'Professional',
    priceMonthly: 2,
    priceYearly: 19, // ~20% off
    period: 'month',
    description: 'Advanced intelligence for daily power users.',
    features: [
      'Unlimited Messages',
      'Access to Gemini 2.0 Pro',
      'Research Mode (DeepSeek R1)',
      'Multi-Chat Dual AI Mode',
      'Priority Response Time',
      'Image Generation (Imagine)',
      '10GB Cloud Storage'
    ],
    gradient: 'from-indigo-500 to-purple-500',
    icon: <Sparkles className="w-6 h-6" />,
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 4,
    priceYearly: 38,
    period: 'month',
    description: 'Scale intelligence across your entire organization.',
    features: [
      'Everything in Pro',
      'Custom Model Fine-tuning',
      'API Access & Integration',
      'Advanced Security (SSO)',
      'Dedicated Account Manager',
      'Unlimited Cloud Storage',
      'Custom Training Data'
    ],
    gradient: 'from-amber-400 to-orange-500',
    icon: <Building2 className="w-6 h-6" />,
  }
];

// --- Components ---

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  tier, 
  billingCycle,
  user,
  onRequestSignIn,
  onActivated,
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  tier: PricingTier | null;
  billingCycle: BillingCycle;
  user: User | null;
  onRequestSignIn: () => void;
  onActivated: (planId: string) => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardName, setCardName] = useState('');

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Reset state when closing
      const timer = setTimeout(() => {
        setIsSuccess(false);
        setIsProcessing(false);
        setError(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !tier) return null;

  const price = billingCycle === 'monthly' ? tier.priceMonthly : tier.priceYearly;
  const displayPrice = price === 0 ? 'Free' : `$${price}`;
  const subText = price === 0 ? '' : billingCycle === 'monthly' ? '/ month' : '/ year';

  const handleCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { onRequestSignIn(); return; }
    if (!stripe || !elements) {
      setError('Payment form is still loading. Please try again.');
      return;
    }
    const card = elements.getElement(CardElement);
    if (!card) {
      setError('Card form is not ready. Please try again.');
      return;
    }

    setError(null);
    setIsProcessing(true);

    const intent = await createPaymentIntent(tier.id, billingCycle);
    if (!intent.success || !intent.clientSecret) {
      setError(intent.error || 'Could not start checkout. Please try again.');
      setIsProcessing(false);
      return;
    }

    const result = await confirmCardPayment(intent.clientSecret, card, {
      email: user.email || '',
      name: cardName.trim() || user.displayName || undefined,
    });

    if (!result.success) {
      setError(result.error || 'Payment failed. Please check your card and try again.');
      setIsProcessing(false);
      return;
    }

    // Verify the PaymentIntent server-side right away (webhooks are a backup).
    if (result.transactionId) {
      await finalizePayment(result.transactionId);
    }

    // The Stripe webhook writes the subscription doc and the `pro` custom claim.
    // Force-refresh the ID token until the claim lands so the UI unlocks without
    // a manual page reload.
    let activated = false;
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const tokenResult = await user.getIdTokenResult(true);
        if ((tokenResult.claims as { pro?: boolean }).pro) {
          activated = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch {
      // Webhooks can lag; the success screen still confirms the payment.
    }
    if (activated) onActivated(tier.id);

    setIsProcessing(false);
    setIsSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div>
            <h3 className="text-xl font-bold text-white">Complete Purchase</h3>
            <p className="text-slate-400 text-sm">You selected <span className="text-indigo-400 font-semibold">{tier.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-in fade-in zoom-in">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-2">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-white">Payment received</h3>
              <p className="text-slate-400 max-w-xs mx-auto">
                Welcome to Tufan {tier.name}. Your plan is active — if a feature still asks you to
                upgrade, refresh the page once in a few seconds.
              </p>
              <button 
                onClick={onClose}
                className="mt-4 px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Price Summary */}
              <div className="bg-slate-800/50 rounded-2xl p-4 flex justify-between items-center border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tier.gradient} flex items-center justify-center text-white`}>
                    {tier.icon}
                  </div>
                  <div>
                    <div className="text-white font-bold">{tier.name} Plan</div>
                    <div className="text-slate-400 text-xs capitalize">{billingCycle} Billing</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{displayPrice}</div>
                  <div className="text-slate-500 text-xs">{subText}</div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => setMethod('card')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${method === 'card' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'}`}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="text-xs font-medium">Card</span>
                  </button>
                  <button 
                    onClick={() => setMethod('paypal')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${method === 'paypal' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'}`}
                  >
                    <Wallet className="w-6 h-6" />
                    <span className="text-xs font-medium">PayPal</span>
                  </button>
                  <button 
                    onClick={() => setMethod('transfer')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${method === 'transfer' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'}`}
                  >
                    <Landmark className="w-6 h-6" />
                    <span className="text-xs font-medium">Transfer</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Forms */}
              <div className="min-h-[200px]">
                {method === 'card' && (
                  <form onSubmit={handleCardPayment} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400">Email</label>
                      <div className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-4 text-sm text-slate-300 truncate">
                        {user?.email || 'Sign in required'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400">Name on card</label>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder={user?.displayName || 'Full name'}
                        autoComplete="cc-name"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400">Card details</label>
                      <div className={`bg-slate-800 border rounded-xl py-3.5 px-4 transition-colors ${error ? 'border-red-500/60' : 'border-slate-700 focus-within:border-indigo-500'}`}>
                        <CardElement
                          options={CARD_ELEMENT_OPTIONS}
                          onChange={(event) => {
                            if (event.error) setError(event.error.message);
                            else if (event.complete) setError(null);
                          }}
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 text-xs text-red-400 leading-relaxed">
                        <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    <div className="pt-2">
                      <button
                        disabled={isProcessing || !stripe}
                        type="submit"
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : !user ? (
                          'Sign in to continue'
                        ) : (
                          <>Pay {displayPrice} <ChevronRight className="w-4 h-4" /></>
                        )}
                      </button>
                      <div className="flex items-center justify-center gap-2 mt-4 text-slate-500 text-xs">
                        <Lock className="w-3 h-3" /> Secured by Stripe · Cancel anytime
                      </div>
                    </div>
                  </form>
                )}

                {method === 'paypal' && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-8 animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                      <Wallet className="w-8 h-8 text-blue-500" />
                    </div>
                    <h4 className="text-white font-bold">PayPal invoicing</h4>
                    <p className="text-slate-400 text-sm max-w-[260px]">
                      Card checkout is live today. For PayPal we send a secure invoice and activate
                      your plan once it clears.
                    </p>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`PayPal upgrade to ${tier.name} (${billingCycle})`)}`}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      Request a PayPal invoice
                    </a>
                  </div>
                )}

                {method === 'transfer' && (
                  <div className="h-full flex flex-col space-y-4 py-2 animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-2">
                      <h4 className="text-white font-bold text-sm">Bank transfer</h4>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        We'll email you the invoice and bank details. Your plan activates after the
                        transfer clears (usually 1–2 business days).
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Include your account email as the payment reference so we can match it.
                    </p>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Bank transfer upgrade to ${tier.name} (${billingCycle})`)}`}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] text-center"
                    >
                      Request bank details
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Page Component ---

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = readString('theme', 'dark');
    return (saved as 'light' | 'dark') || 'dark';
  });
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [pendingTier, setPendingTier] = useState<PricingTier | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writeString('theme', theme, { persist: 'both' });
  }, [theme]);

  // Keep the CTA in sync with the user's entitlement (server-set `pro` claim).
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      if (!currentUser) {
        setCurrentPlanId(null);
        return;
      }
      try {
        const token = await currentUser.getIdTokenResult(true);
        const claims = token.claims as { pro?: boolean; planId?: string };
        if (active) setCurrentPlanId(claims.pro ? (claims.planId || null) : null);
      } catch {
        if (active) setCurrentPlanId(null);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  // Resume checkout automatically after a guest signs in.
  useEffect(() => {
    if (user && pendingTier) {
      setSelectedTier(pendingTier);
      setIsModalOpen(true);
      setPendingTier(null);
      setIsAuthOpen(false);
    }
  }, [user, pendingTier]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleSelectPlan = (tier: PricingTier) => {
    if (tier.id === 'starter') {
      navigate('/');
      return;
    }
    if (!user) {
      setPendingTier(tier);
      setIsAuthOpen(true);
      return;
    }
    setSelectedTier(tier);
    setIsModalOpen(true);
  };

  const handleRequestSignIn = () => {
    setIsModalOpen(false);
    setPendingTier(selectedTier);
    setIsAuthOpen(true);
  };

  return (
    <div className={`min-h-screen relative overflow-hidden flex flex-col transition-colors duration-500 font-sans ${theme === 'dark' ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 transition-colors duration-1000 ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-300'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 transition-colors duration-1000 ${theme === 'dark' ? 'bg-purple-600' : 'bg-purple-300'}`} />
      </div>

      {/* Navigation */}
      <header className="relative z-10 p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => navigate('/')}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg transition-transform group-hover:scale-105 ${theme === 'dark' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'bg-slate-900 text-white'}`}>
            A
          </div>
          <span className="text-lg font-black tracking-tight">Tufan</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 border
              ${theme === 'dark' ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button 
            onClick={() => navigate('/')}
            className={`hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all border
              ${theme === 'dark' ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'}`}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Chat
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-12 lg:py-20">
        
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3 h-3" />
            Upgrade your potential
          </div>
          <h1 className="text-4xl lg:text-6xl font-black tracking-tight mb-6">
            Choose Your <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-indigo-500">
              Power Level
            </span>
          </h1>
          <p className={`text-lg leading-relaxed max-w-2xl mx-auto mb-10 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Unlock the full potential of Tufan with our professional plans. Higher limits, faster speeds, and advanced AI models.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-bold transition-colors ${billingCycle === 'monthly' ? 'text-blue-500' : 'opacity-40'}`}>Monthly</span>
            <button 
              onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
              className={`w-14 h-8 rounded-full p-1 transition-all ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} relative`}
            >
              <div className={`w-6 h-6 rounded-full bg-blue-500 shadow-lg transition-all duration-300 ${billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-bold flex items-center gap-2 transition-colors ${billingCycle === 'yearly' ? 'text-blue-500' : 'opacity-40'}`}>
              Yearly
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-tighter border border-emerald-500/20">Save 20%</span>
            </span>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto w-full pb-20">
          {PRICING_TIERS.map((tier, idx) => {
            const price = billingCycle === 'monthly' ? tier.priceMonthly : tier.priceYearly;
            const isFree = price === 0;

            return (
              <div 
                key={tier.id}
                className={`group relative flex flex-col p-8 rounded-[2rem] border transition-all duration-300 hover:-translate-y-2
                  ${theme === 'dark' ? 'bg-slate-900/40 border-white/5 backdrop-blur-xl hover:bg-slate-900/60 hover:border-white/10' : 'bg-white border-slate-200 shadow-xl hover:shadow-2xl hover:border-blue-200'}
                  ${tier.popular ? 'ring-2 ring-indigo-500/50 md:scale-105 z-10' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-indigo-500/30">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center text-white mb-6 shadow-lg transition-transform group-hover:scale-110`}>
                    {tier.icon}
                  </div>
                  <h3 className="text-2xl font-black mb-2">{tier.name}</h3>
                  <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{tier.description}</p>
                </div>

                <div className="mb-8 flex items-baseline gap-1">
                  <span className="text-5xl font-black tracking-tighter">
                    {isFree ? '$0' : `$${price}`}
                  </span>
                  <span className={`text-sm font-medium opacity-50`}>
                    {isFree ? '' : billingCycle === 'monthly' ? '/mo' : '/yr'}
                  </span>
                </div>

                <ul className="flex-1 space-y-4 mb-8">
                  {tier.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-100 text-blue-600'}`}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => handleSelectPlan(tier)}
                  disabled={currentPlanId === tier.id}
                  className={`w-full py-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-default
                    ${tier.popular 
                      ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/20 hover:bg-indigo-50' 
                      : theme === 'dark' 
                        ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700' 
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200'}`}
                >
                  {tier.id === 'starter' || currentPlanId === tier.id ? 'Current Plan' : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust/Footer Section */}
        <div className="max-w-4xl mx-auto w-full pt-12 border-t border-slate-800/50">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
             <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">SOC2 Compliant</span>
             </div>
             <div className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">End-to-End Encrypted</span>
             </div>
             <div className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">Cancel Anytime</span>
             </div>
          </div>
        </div>
      </main>

      {/* Payment Modal Integration */}
      <PaymentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        tier={selectedTier}
        billingCycle={billingCycle}
        user={user}
        onRequestSignIn={handleRequestSignIn}
        onActivated={(planId) => setCurrentPlanId(planId)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode="signin"
        theme={theme}
      />
    </div>
  );
};

export default PricingPage;
