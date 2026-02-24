import React, { useEffect, useCallback, memo, useState, useMemo } from 'react';
import { VOICE_LIBRARY } from '../services/voiceLibrary';

interface ShortcutItem {
  key: string;
  task: string;
  icon?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
}

const SHORTCUTS: ShortcutItem[] = [
  { key: '⌘K', task: 'New Chat', icon: 'fa-plus' },
  { key: 'Enter', task: 'Send Message', icon: 'fa-paper-plane' },
  { key: 'Shift + Enter', task: 'New Line', icon: 'fa-level-down-alt' },
  { key: 'Esc', task: 'Close Modals', icon: 'fa-times' },
  { key: '/', task: 'Focus Input', icon: 'fa-comment-dots' },
];

// Memoized section component
interface SettingsSectionProps {
  title: string;
  theme: 'light' | 'dark';
  children: React.ReactNode;
  icon?: string;
}

const SettingsSection = memo(({ title, theme, children, icon }: SettingsSectionProps) => (
  <section className="space-y-4">
    <div className="flex items-center gap-2 mb-4">
      {icon && (
        <i className={`fas ${icon} text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
      )}
      <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${
        theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
      }`}>
        {title}
      </h3>
    </div>
    {children}
  </section>
));

// Memoized toggle switch
interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

const ThemeToggle = memo(({ theme, onToggle }: ThemeToggleProps) => (
  <button
    onClick={onToggle}
    className={`relative w-14 h-8 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      theme === 'dark' 
        ? 'bg-blue-600 focus:ring-blue-500' 
        : 'bg-slate-300 focus:ring-slate-400'
    } ${theme === 'dark' ? 'focus:ring-offset-slate-900' : 'focus:ring-offset-white'}`}
    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    aria-pressed={theme === 'dark'}
  >
    <div 
      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-300 flex items-center justify-center ${
        theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
      }`}
    >
      <i className={`fas ${theme === 'dark' ? 'fa-moon text-blue-600' : 'fa-sun text-amber-500'} text-xs`} />
    </div>
  </button>
));

// Memoized shortcut card
interface ShortcutCardProps {
  shortcut: ShortcutItem;
  theme: 'light' | 'dark';
  index: number;
}

const ShortcutCard = memo(({ shortcut, theme, index }: ShortcutCardProps) => (
  <div 
    className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] ${
      theme === 'dark' 
        ? 'bg-slate-800/10 border-white/5 hover:border-white/20' 
        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-sm'
    }`}
    style={{ animationDelay: `${index * 50}ms` }}
  >
    <div className="flex items-center gap-3">
      {shortcut.icon && (
        <i className={`fas ${shortcut.icon} text-xs w-4 text-center opacity-50 group-hover:opacity-100 transition-opacity ${
          theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
        }`} />
      )}
      <span className={`text-xs font-bold ${
        theme === 'dark' ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-700'
      }`}>
        {shortcut.task}
      </span>
    </div>
    <kbd className={`px-2 py-1.5 rounded-lg text-[10px] font-black tracking-tight border shadow-sm transition-all ${
      theme === 'dark' 
        ? 'bg-slate-900 border-white/10 text-blue-400 group-hover:text-blue-300' 
        : 'bg-white border-slate-200 text-blue-600 group-hover:border-blue-200'
    }`}>
      {shortcut.key}
    </kbd>
  </div>
));

const SettingsModal: React.FC<SettingsModalProps> = memo(({ 
  isOpen, 
  onClose, 
  theme, 
  onToggleTheme,
  selectedVoiceId,
  onSelectVoice
}) => {
  const [voiceGender, setVoiceGender] = useState<'all' | 'male' | 'female'>('all');
  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Handle voice selection with feedback
  const handleVoiceSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const voiceId = e.target.value;
    onSelectVoice(voiceId);
  }, [onSelectVoice]);

  const filteredVoices = useMemo(() => {
    if (voiceGender === 'all') return VOICE_LIBRARY;
    return VOICE_LIBRARY.filter(voice => voice.gender === voiceGender);
  }, [voiceGender]);

  if (!isOpen) return null;

  const getThemeStyles = () => ({
    backdrop: 'bg-slate-950/60 backdrop-blur-md',
    modal: theme === 'dark' 
      ? 'bg-slate-900 border-white/10' 
      : 'bg-white border-slate-200 shadow-slate-200/50',
    header: theme === 'dark' ? 'border-white/5' : 'border-slate-100',
    footer: theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
  });

  const styles = getThemeStyles();

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      {/* Backdrop with animation */}
      <div 
        className={`absolute inset-0 ${styles.backdrop} transition-opacity duration-300 animate-in fade-in`}
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div 
        className={`relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-[28px] shadow-2xl border transition-all duration-200 animate-in zoom-in-95 ${styles.modal}`}
      >
        {/* Header */}
        <header className={`flex items-center justify-between p-6 border-b ${styles.header}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              theme === 'dark' ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-600'
            }`}>
              <i className="fas fa-sliders-h text-lg" />
            </div>
            <div>
              <h2 
                id="settings-title"
                className={`font-black text-sm uppercase tracking-widest ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
              >
                Preferences
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                System Settings
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
              theme === 'dark' ? 'hover:bg-white/5 text-slate-500' : 'hover:bg-slate-100 text-slate-400'
            }`}
            aria-label="Close settings"
          >
            <i className="fas fa-times text-lg" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-8 space-y-8 overflow-y-auto custom-scrollbar max-h-[calc(85vh-140px)]">
          
          {/* Voice Section */}
          <SettingsSection title="Text-to-Speech Voice" theme={theme} icon="fa-volume-up">
            <div className={`p-5 rounded-2xl border ${
              theme === 'dark' ? 'bg-slate-800/20 border-white/5' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                  theme === 'dark' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-emerald-600/10 text-emerald-600'
                }`}>
                  <i className="fas fa-microphone-alt" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Voice Selection
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {VOICE_LIBRARY.length} cloud voices available
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Gender Filter
                  </span>
                  <div className="flex gap-2">
                    {(['all', 'male', 'female'] as const).map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setVoiceGender(option)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          voiceGender === option
                            ? theme === 'dark'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                            : theme === 'dark'
                              ? 'bg-slate-900/40 text-slate-500 border border-white/5 hover:text-slate-300'
                              : 'bg-white text-slate-400 border border-slate-200 hover:text-slate-600'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <select 
                  value={selectedVoiceId}
                  onChange={handleVoiceSelect}
                  className={`w-full p-3 pr-10 rounded-xl border text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer ${
                    theme === 'dark' 
                      ? 'bg-slate-900 border-white/10 text-white' 
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="">Auto (Language Default)</option>
                  {filteredVoices.map(voice => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} - {voice.lang}
                    </option>
                  ))}
                </select>
                <i className={`fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`} />
              </div>
            </div>
          </SettingsSection>
          {/* Appearance Section */}
          <SettingsSection title="Interface Theme" theme={theme} icon="fa-palette">
            <div className={`flex items-center justify-between p-5 rounded-2xl border ${
              theme === 'dark' ? 'bg-slate-800/20 border-white/5' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                  theme === 'dark' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-600/10 text-blue-600'
                }`}>
                  <i className={`fas ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {theme === 'dark' ? 'Easier on the eyes' : 'Classic bright theme'}
                  </p>
                </div>
              </div>
              
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            </div>
          </SettingsSection>

          {/* Keyboard Shortcuts */}
          <SettingsSection title="Keyboard Shortcuts" theme={theme} icon="fa-keyboard">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SHORTCUTS.map((shortcut, i) => (
                <ShortcutCard 
                  key={shortcut.key} 
                  shortcut={shortcut} 
                  theme={theme} 
                  index={i}
                />
              ))}
            </div>
          </SettingsSection>
        </div>

        {/* Footer */}
        <footer className={`px-6 py-4 text-center border-t ${styles.footer}`}>
          <div className="flex items-center justify-center gap-2">
            <i className="fas fa-code text-[9px] text-slate-500" />
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
              ChatAdk v2.0.0
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
});

export default SettingsModal;
