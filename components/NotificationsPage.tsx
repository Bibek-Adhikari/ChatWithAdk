import React from 'react';
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
  Info
} from 'lucide-react';

interface UpdateItem {
  id: string;
  title: string;
  description: string;
  date: string;
  tag: 'feature' | 'improvement' | 'maintenance' | 'upcoming';
  icon: React.ReactNode;
}

const updates: UpdateItem[] = [
  {
    id: '1',
    title: 'Research Model v2.0',
    description: 'Our advanced research model is getting a massive upgrade with deeper web integration and multi-step reasoning capabilities.',
    date: 'Expected mid-Feb 2026',
    tag: 'upcoming',
    icon: <Globe className="text-blue-400" size={20} />
  },
  {
    id: '2',
    title: 'Mobile App Beta',
    description: 'ChatADK is coming to iOS and Android! Early access will be available for Pro and Enterprise users.',
    date: 'Expected Mar 2026',
    tag: 'upcoming',
    icon: <Sparkles className="text-purple-400" size={20} />
  },
  {
    id: '3',
    title: 'Enhanced Image Generation',
    description: 'Integrating higher resolution outputs and better prompt adherence for our "Imagine" mode.',
    date: 'Live Now',
    tag: 'feature',
    icon: <Zap className="text-amber-400" size={20} />
  },
  {
    id: '4',
    title: 'Secure Enterprise Workspace',
    description: 'Initial roll-out of shared workspaces for teams with granular permission controls.',
    date: 'Expected Apr 2026',
    tag: 'upcoming',
    icon: <ShieldCheck className="text-emerald-400" size={20} />
  }
];

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [theme] = React.useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen transition-all duration-500 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] transition-opacity duration-1000 ${isDark ? 'bg-blue-600/10' : 'bg-blue-200/20'}`} />
        <div className={`absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] transition-opacity duration-1000 ${isDark ? 'bg-purple-600/10' : 'bg-purple-200/20'}`} />
      </div>

      <div className="relative max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <button 
            onClick={() => navigate('/')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95
              ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}
          >
            <ArrowLeft size={16} /> Back
          </button>
          
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <Bell className="text-blue-500" size={20} />
            </div>
            <h1 className="text-xl font-black uppercase tracking-widest">Updates</h1>
          </div>
        </header>

        {/* Hero Section */}
        <div className={`p-8 rounded-3xl border mb-12 overflow-hidden relative ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-black uppercase tracking-widest mb-4">
              <Sparkles size={12} /> What's New
            </div>
            <h2 className="text-3xl font-black mb-4 leading-tight">Something exciting is brewing...</h2>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              We are working hard to bring you the next generation of AI tools. 
              Check out our roadmap below for upcoming features and improvements.
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <Cpu size={240} className="text-blue-500" />
          </div>
        </div>

        {/* Updates List */}
        <div className="space-y-4">
          <h3 className={`text-[10px] font-black uppercase tracking-[0.25em] mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Roadmap & Changelog
          </h3>
          
          {updates.map((update) => (
            <div 
              key={update.id}
              className={`group p-6 rounded-2xl border transition-all hover:scale-[1.02] cursor-pointer
                ${isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:shadow-md'}`}
            >
              <div className="flex items-start gap-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-12
                  ${isDark ? 'bg-slate-900 border border-white/5' : 'bg-slate-100 border border-slate-200'}`}>
                  {update.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{update.title}</h4>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border
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
                    <div className="text-blue-500 transition-transform group-hover:translate-x-1">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className={`mt-12 p-6 rounded-2xl border text-center ${isDark ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50 border-blue-100'}`}>
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
    </div>
  );
};

export default NotificationsPage;
