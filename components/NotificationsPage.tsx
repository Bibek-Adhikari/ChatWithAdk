import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
Bell, 
ArrowLeft, 
Sparkles, 
Cpu, 
Zap, 
Globe, 
ShieldCheck,
Calendar,
ChevronRight,
Info,
X,
CreditCard,
Wallet,
Bitcoin,
CheckCircle2,
Loader2
} from 'lucide-react';

// --- Types ---
interface UpdateItem {
id: string;
title: string;
description: string;
date: string;
tag: 'feature' | 'improvement' | 'maintenance' | 'upcoming';
icon: React.ReactNode;
price?: string;
}

// --- Data ---
const updates: UpdateItem[] = [
{
  id: '1',
  title: 'Research Model v2.0',
  description: 'Our advanced research model is getting a massive upgrade with deeper web integration and multi-step reasoning capabilities.',
  date: 'Expected mid-Feb 2026',
  tag: 'upcoming',
  price: '$20/mo',
  icon: <Globe className="text-blue-400" size={20} />
},
{
  id: '2',
  title: 'Mobile App Beta',
  description: 'ChatADK is coming to iOS and Android! Early access will be available for Pro and Enterprise users.',
  date: 'Expected Mar 2026',
  tag: 'upcoming',
  price: '$15/mo',
  icon: <Sparkles className="text-purple-400" size={20} />
},
{
  id: '3',
  title: 'Enhanced Image Generation',
  description: 'Integrating higher resolution outputs and better prompt adherence for our "Imagine" mode.',
  date: 'Live Now',
  tag: 'feature',
  price: '$5/mo',
  icon: <Zap className="text-amber-400" size={20} />
},
{
  id: '4',
  title: 'Secure Enterprise Workspace',
  description: 'Initial roll-out of shared workspaces for teams with granular permission controls.',
  date: 'Expected Apr 2026',
  tag: 'upcoming',
  price: '$50/mo',
  icon: <ShieldCheck className="text-emerald-400" size={20} />
}
];

// --- Payment Modal Component ---
const PaymentModal = ({ 
isOpen, 
onClose, 
plan 
}: { 
isOpen: boolean; 
onClose: () => void; 
plan: UpdateItem | null 
}) => {
const [selectedMethod, setSelectedMethod] = useState<'card' | 'paypal' | 'crypto'>('card');
const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');

useEffect(() => {
  if (isOpen) {
    setStatus('idle');
    setSelectedMethod('card');
  }
}, [isOpen]);

const handlePay = () => {
  setStatus('processing');
  setTimeout(() => {
    setStatus('success');
  }, 2000);
};

if (!isOpen || !plan) return null;

return (
  <>
    {/* Backdrop */}
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
    />
    
    {/* Modal Content */}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden pointer-events-auto relative animate-modal-in">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          {status === 'success' ? (
            <div className="flex flex-col items-center text-center py-8 animate-success-in">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-400 animate-bounce-in">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">You're all set!</h3>
              <p className="text-slate-400 mb-8">
                You have successfully subscribed to <span className="text-white font-semibold">{plan.title}</span>.
              </p>
              <button 
                onClick={onClose}
                className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-1">Complete Purchase</h3>
                <p className="text-slate-400 text-sm">Unlock {plan.title}</p>
                <div className="mt-4 inline-block px-4 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono font-bold">
                  {plan.price || '$0.00'}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3 mb-8">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Method</label>
                
                {/* Card Option */}
                <div 
                  onClick={() => setSelectedMethod('card')}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedMethod === 'card' 
                      ? 'bg-blue-500/10 border-blue-500/50' 
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedMethod === 'card' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    <CreditCard size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-white">Credit Card</p>
                    <p className="text-xs text-slate-400">Visa, Mastercard, Amex</p>
                  </div>
                  {selectedMethod === 'card' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>

                {/* PayPal Option */}
                <div 
                  onClick={() => setSelectedMethod('paypal')}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedMethod === 'paypal' 
                      ? 'bg-blue-500/10 border-blue-500/50' 
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedMethod === 'paypal' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    <Wallet size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-white">Digital Wallet</p>
                    <p className="text-xs text-slate-400">PayPal, Apple Pay, Google Pay</p>
                  </div>
                  {selectedMethod === 'paypal' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>

                {/* Crypto Option */}
                <div 
                  onClick={() => setSelectedMethod('crypto')}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedMethod === 'crypto' 
                      ? 'bg-blue-500/10 border-blue-500/50' 
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedMethod === 'crypto' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    <Bitcoin size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-white">Cryptocurrency</p>
                    <p className="text-xs text-slate-400">BTC, ETH, SOL, USDC</p>
                  </div>
                  {selectedMethod === 'crypto' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handlePay}
                disabled={status === 'processing'}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {status === 'processing' ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Pay Now</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>

    {/* CSS Animations */}
    <style>{`
      @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes modal-in {
        from { opacity: 0; transform: scale(0.95) translateY(20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes success-in {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes bounce-in {
        0% { opacity: 0; transform: scale(0); }
        50% { transform: scale(1.1); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes slide-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes float {
        0%, 100% { transform: translate(0, 0); }
        25% { transform: translate(30px, -30px); }
        50% { transform: translate(0, -60px); }
        75% { transform: translate(-30px, -30px); }
      }
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.1); }
      }
      @keyframes rotate-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes wiggle {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(10deg); }
        75% { transform: rotate(-10deg); }
      }
      
      .animate-fade-in { animation: fade-in 0.3s ease-out; }
      .animate-modal-in { animation: modal-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      .animate-success-in { animation: success-in 0.5s ease-out; }
      .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
      .animate-slide-up { animation: slide-up 0.6s ease-out forwards; }
      .animate-float { animation: float 10s ease-in-out infinite; }
      .animate-float-delayed { animation: float 15s ease-in-out infinite 2s; }
      .animate-pulse-glow { animation: pulse-glow 4s ease-in-out infinite; }
      .animate-rotate-slow { animation: rotate-slow 20s linear infinite; }
      
      .hover-wiggle:hover { animation: wiggle 0.5s ease-in-out; }
      .hover-lift { transition: transform 0.3s ease, box-shadow 0.3s ease; }
      .hover-lift:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
      .hover-rotate:hover { transform: rotate(12deg); }
      .hover-shift:hover { transform: translateX(4px); }
      
      .stagger-1 { animation-delay: 0.1s; }
      .stagger-2 { animation-delay: 0.2s; }
      .stagger-3 { animation-delay: 0.3s; }
      .stagger-4 { animation-delay: 0.4s; }
      .stagger-5 { animation-delay: 0.5s; }
      .stagger-6 { animation-delay: 0.6s; }
    `}</style>
  </>
);
};

// --- Main Page Component ---
const NotificationsPage: React.FC = () => {
const navigate = useNavigate();
const [theme] = useState<'light' | 'dark'>(() => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  }
  return 'dark';
});

const [selectedPlan, setSelectedPlan] = useState<UpdateItem | null>(null);

const isDark = theme === 'dark';

return (
  <div className={`min-h-screen transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
    
    {/* Animated Background Orbs - Pure CSS */}
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div 
        className={`absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] animate-float ${isDark ? 'bg-blue-600/20' : 'bg-blue-200/40'}`} 
      />
      <div 
        className={`absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] animate-float-delayed ${isDark ? 'bg-purple-600/20' : 'bg-purple-200/40'}`} 
      />
    </div>

    <div className="relative max-w-2xl mx-auto px-6 py-12">
      
      {/* Header */}
      <header className="flex items-center justify-between mb-12 opacity-0 animate-slide-up" style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}>
        <button 
          onClick={() => navigate('/')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:translate-x-[-4px]
            ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5' : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-sm'}`}
        >
          <ArrowLeft size={16} /> Back
        </button>
        
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'} hover-wiggle cursor-pointer transition-transform`}>
            <Bell className="text-blue-500" size={20} />
          </div>
          <h1 className="text-xl font-black uppercase tracking-widest">Updates</h1>
        </div>
      </header>

      {/* Hero Section */}
      <div 
        className={`p-8 rounded-3xl border mb-12 overflow-hidden relative group opacity-0 animate-slide-up stagger-1 ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-lg'}`}
        style={{ animationFillMode: 'forwards' }}
      >
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-black uppercase tracking-widest mb-4 opacity-0 animate-slide-up stagger-2" style={{ animationFillMode: 'forwards' }}>
            <Sparkles size={12} /> What's New
          </div>
          <h2 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
            Something exciting <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">is brewing...</span>
          </h2>
          <p className={`text-sm leading-relaxed max-w-md ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            We are working hard to bring you the next generation of AI tools. 
            Check out our roadmap below for upcoming features and improvements.
          </p>
        </div>
        
        {/* Animated Background Icon */}
        <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
          <Cpu size={240} className="text-blue-500 animate-rotate-slow" />
        </div>
      </div>

      {/* Updates List */}
      <div className="space-y-4">
        <h3 className={`text-[10px] font-black uppercase tracking-[0.25em] mb-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Roadmap & Changelog
        </h3>
        
        {updates.map((update, index) => (
          <div 
            key={update.id}
            onClick={() => setSelectedPlan(update)}
            className={`group p-6 rounded-2xl border transition-all cursor-pointer relative overflow-hidden opacity-0 animate-slide-up hover-lift
              ${isDark ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10' : 'bg-white border-slate-200 hover:shadow-xl hover:border-blue-200'}`}
            style={{ animationDelay: `${0.3 + (index * 0.1)}s`, animationFillMode: 'forwards' }}
          >
            {/* Hover Gradient Effect */}
            <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="flex items-start gap-5 relative z-10">
              <div 
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:rotate-12
                  ${isDark ? 'bg-slate-900 border border-white/5' : 'bg-slate-100 border border-slate-200'}`}
              >
                {update.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{update.title}</h4>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border backdrop-blur-md
                    ${update.tag === 'upcoming' 
                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                      : update.tag === 'feature'
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                    {update.tag}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {update.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Calendar size={12} /> {update.date}
                  </div>
                  <div className="text-blue-500 transition-transform duration-300 group-hover:translate-x-1">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div 
        className={`mt-12 p-6 rounded-2xl border text-center transition-all duration-300 hover:scale-[1.02] opacity-0 animate-slide-up stagger-6 ${isDark ? 'bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10' : 'bg-blue-50 border-blue-100'}`}
        style={{ animationFillMode: 'forwards' }}
      >
        <div className="flex items-center justify-center gap-2 mb-2 text-blue-500">
          <Info size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Help Us Grow</span>
        </div>
        <p className={`text-[11px] leading-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Have a feature request? We'd love to hear from you. 
          <button className="ml-1 text-blue-500 font-bold hover:underline">Contact Support</button>
        </p>
      </div>
    </div>

    {/* Payment Modal Integration */}
    <PaymentModal 
      isOpen={!!selectedPlan} 
      onClose={() => setSelectedPlan(null)} 
      plan={selectedPlan} 
    />
  </div>
);
};

export default NotificationsPage;