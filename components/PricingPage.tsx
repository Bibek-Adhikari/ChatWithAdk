
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PricingTier {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  color: string;
  popular?: boolean;
  buttonText: string;
  icon: string;
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out ChatADK capabilities.',
    features: [
      'Access to Basic Models',
      '20 Messages per Day',
      'Standard Support',
      '1MB Image/File Uploads',
      'Web-only Access'
    ],
    color: 'from-blue-500 to-cyan-400',
    buttonText: 'Current Plan',
    icon: 'fa-paper-plane'
  },
  {
    id: 'pro',
    name: 'Professional',
    price: '$2',
    period: 'month',
    description: 'Advanced intelligence for daily power users.',
    features: [
      'Unlimited Messages',
      'Access to Detail (Gemini 2.0)',
      'Research Mode (DeepSeek R1)',
      'Multi-Chat Dual AI Mode',
      'Priority Response Time',
      'Image Generation (Imagine)',
      '10GB Cloud Storage'
    ],
    color: 'from-indigo-600 to-purple-600',
    popular: true,
    buttonText: 'Upgrade to Pro',
    icon: 'fa-crown'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$4',
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
    color: 'from-amber-500 to-orange-600',
    buttonText: 'Contact Sales',
    icon: 'fa-building'
  }
];

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  return (
    <div className={`min-h-screen relative overflow-hidden flex flex-col transition-colors duration-500 ${theme === 'dark' ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className={`absolute top-[-20%] left-[-10%] w-[60%] h-[70%] rounded-full blur-[120px] opacity-20 transition-colors duration-1000 ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-300'}`}></div>
        <div className={`absolute bottom-[-20%] right-[-10%] w-[60%] h-[70%] rounded-full blur-[120px] opacity-20 transition-colors duration-1000 ${theme === 'dark' ? 'bg-purple-600' : 'bg-purple-300'}`}></div>
      </div>

      {/* Navigation Header */}
      <header className="relative z-10 p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/assets/logo.webp" alt="Logo" className="w-10 h-10 rounded-xl shadow-2xl" />
          <span className="text-sm font-black uppercase tracking-[.3em]">ChatADK</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95
              ${theme === 'dark' ? 'bg-white/5 text-amber-400 border border-white/5' : 'bg-white text-amber-500 border border-slate-200'}`}
          >
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>

          <button 
            onClick={() => navigate('/')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all
              ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white border border-white/5' : 'bg-white hover:bg-slate-100 text-slate-900 border border-slate-200'}`}
          >
            <i className="fas fa-arrow-left"></i> Back to Chat
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-12 lg:py-24">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-20 animate-in fade-in slide-in-from-top-12 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-black uppercase tracking-widest mb-6">
            <i className="fas fa-sparkles"></i>
            Elevate Your Experience
          </div>
          <h1 className="text-4xl lg:text-7xl font-black tracking-tight mb-6 leading-tight">
            Choose Your <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-indigo-500 animate-gradient">Power Level</span>
          </h1>
          <p className={`text-lg lg:text-xl font-medium opacity-60 leading-relaxed max-w-2xl mx-auto ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Unlock the full potential of ChatADK with our professional plans. Higher limits, faster speeds, and advanced AI models.
          </p>

          {/* Billing Toggle */}
          <div className="mt-10 flex items-center justify-center gap-4">
            <span className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-blue-500' : 'opacity-40'}`}>Monthly</span>
            <button 
              onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
              className={`w-14 h-7 rounded-full p-1 transition-all ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} relative`}
            >
              <div className={`w-5 h-5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/40 transition-all ${billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
            <span className={`text-xs font-bold flex items-center gap-2 ${billingCycle === 'yearly' ? 'text-blue-500' : 'opacity-40'}`}>
              Yearly
              <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-tighter">Save 20%</span>
            </span>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full pb-20">
          {PRICING_TIERS.map((tier, idx) => (
            <div 
              key={tier.id}
              className={`group relative flex flex-col p-8 rounded-[40px] border transition-all duration-500 hover:scale-[1.03] animate-in fade-in slide-in-from-bottom-12
                ${theme === 'dark' ? 'bg-slate-950/40 border-white/5 backdrop-blur-xl hover:bg-slate-950/60' : 'bg-white border-slate-200 shadow-2xl shadow-blue-500/10 hover:shadow-blue-500/20'}
                ${tier.popular ? 'ring-2 ring-blue-500/50' : ''}`}
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full shadow-xl">
                    Most Popular
                  </div>
                </div>
              )}

              <div className="mb-10">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-white text-2xl mb-6 shadow-2xl transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                  <i className={`fas ${tier.icon}`}></i>
                </div>
                <h3 className="text-2xl font-black tracking-tight mb-2">{tier.name}</h3>
                <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{tier.description}</p>
              </div>

              <div className="mb-10 flex items-baseline gap-2">
                <span className="text-5xl font-black">{billingCycle === 'yearly' && tier.id !== 'starter' ? `$${Math.round(parseInt(tier.price.slice(1)) * 0.8)}` : tier.price}</span>
                <span className={`text-sm font-bold opacity-40`}>/ {tier.period}</span>
              </div>

              <ul className="flex-1 space-y-4 mb-10">
                {tier.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-3">
                    <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                      <i className="fas fa-check text-[10px]"></i>
                    </div>
                    <span className={`text-[13px] font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => {
                  if (tier.id === 'starter') {
                    navigate('/');
                  } else if (tier.id === 'enterprise') {
                    window.location.href = 'mailto:support@chatadk.com?subject=Enterprise Inquiry';
                  } else {
                    alert(`${tier.name} selection is coming soon! Integrating with Stripe...`);
                    navigate('/');
                  }
                }}
                className={`w-full py-5 rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98]
                  ${tier.popular 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-500 hover:to-indigo-500' 
                    : theme === 'dark' 
                      ? 'bg-white/5 text-white border border-white/5 hover:bg-white/10' 
                      : 'bg-slate-900 text-white hover:bg-slate-800'}`}
              >
                {tier.buttonText}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Preview or Trust Section */}
        <div className="max-w-4xl mx-auto w-full text-center py-20 border-t border-white/5">
           <h2 className="text-2xl font-black mb-12">Frequently Asked Questions</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              {[
                { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time from your account settings. You will retain access until the end of your billing cycle." },
                { q: "What models are included?", a: "Pro members get access to Google Gemini 2.0 Flash, DeepSeek R1 across Research mode, and our custom Image Generation pipeline." },
                { q: "Do you offer education discounts?", a: "Absoultely! Reach out to our support team with your student ID to claim a 50% discount on Yearly Pro plans." },
                { q: "Is Multi-Chat available on mobile?", a: "Yes, the multi-chat dual AI interface is fully responsive and works perfectly on smartphones and tablets." }
              ].map((item, i) => (
                <div key={i} className="space-y-3">
                   <h4 className="text-sm font-black uppercase tracking-wider text-blue-500">{item.q}</h4>
                   <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{item.a}</p>
                </div>
              ))}
           </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`relative z-10 p-10 border-t ${theme === 'dark' ? 'bg-black/50 border-white/5 text-slate-500' : 'bg-white border-slate-100 text-slate-400'} text-center`}>
         <p className="text-[10px] font-black uppercase tracking-[0.4em]">© 2026 ChatADK Intelligence. Built for the future.</p>
      </footer>
    </div>
  );
};

export default PricingPage;
