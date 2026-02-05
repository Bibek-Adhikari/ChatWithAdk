
import React, { useEffect, useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  selectedVoiceURI: string;
  onSelectVoice: (uri: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  theme, 
  onToggleTheme,
  selectedVoiceURI,
  onSelectVoice
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      // Filter for English, Nepali, and Hindi voices
      const filteredVoices = allVoices.filter(v => 
        v.lang.startsWith('en') || 
        v.lang.startsWith('ne') || 
        v.lang.startsWith('hi')
      );
      setVoices(filteredVoices);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + K', task: 'New Conversation' },
    { key: 'Enter', task: 'Send Message' },
    { key: 'Shift + Enter', task: 'New Line' },
    { key: 'Esc', task: 'Close Modals' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[4px] transition-opacity"
        onClick={onClose}
      />
      
      <div className={`relative w-full max-w-lg overflow-hidden rounded-[28px] shadow-2xl transition-all border animate-in zoom-in-95 duration-200
        ${theme === 'dark' ? 'bg-[#0f172a] border-white/5' : 'bg-white border-slate-200'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <i className="fas fa-sliders-h text-lg"></i>
            </div>
            <div>
              <h2 className={`font-black text-sm uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Preferences</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Customization & Controls</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Voice Section */}
          <section>
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Chat Voice</h3>
            <div className={`p-5 rounded-2xl border transition-all
              ${theme === 'dark' ? 'bg-slate-800/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all
                  ${theme === 'dark' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-emerald-600/10 text-emerald-600'}`}>
                  <i className="fas fa-volume-up"></i>
                </div>
                <div>
                  <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Speech Voice</p>
                  <p className="text-xs text-slate-500 font-medium">Choose how ChatAdk sounds</p>
                </div>
              </div>
              
              <select 
                value={selectedVoiceURI}
                onChange={(e) => onSelectVoice(e.target.value)}
                className={`w-full p-3 rounded-xl border text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer
                  ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
              >
                <option value="">System Default</option>
                {voices.map(voice => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Appearance Section */}
          <section>
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Appearance</h3>
            <div className={`flex items-center justify-between p-5 rounded-2xl border transition-all
              ${theme === 'dark' ? 'bg-slate-800/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all
                  ${theme === 'dark' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-600/10 text-blue-600'}`}>
                  <i className={`fas ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`}></i>
                </div>
                <div>
                  <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Dark Mode</p>
                  <p className="text-xs text-slate-500 font-medium">Auto-adjust interface light</p>
                </div>
              </div>
              
              <button 
                onClick={onToggleTheme}
                className={`relative w-14 h-8 rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </section>

          {/* Shortcuts Section */}
          <section>
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Shortcut Keys</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shortcuts.map((s, i) => (
                <div key={i} className={`flex items-center justify-between p-4 rounded-xl border
                  ${theme === 'dark' ? 'bg-slate-800/10 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{s.task}</span>
                  <kbd className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-tight border shadow-sm
                    ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-blue-400' : 'bg-white border-slate-200 text-blue-600'}`}>
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer info */}
        <div className={`px-8 py-4 text-center border-t ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">v1.2.4 Premium Edition</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
