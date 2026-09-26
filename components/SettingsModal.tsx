import React, { useEffect, useCallback, memo, useState, useMemo } from 'react';
import { X, Sun, Moon, Check } from 'lucide-react';
import { fetchEdgeVoiceIds } from '../services/edgeVoiceService';
import { VOICE_LIBRARY } from '../services/voiceLibrary';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
}

const SHORTCUTS = [
  { key: '⌘K', task: 'New chat' },
  { key: 'Enter', task: 'Send message' },
  { key: 'Shift + Enter', task: 'New line' },
  { key: 'Esc', task: 'Close dialogs' },
];

const SettingsModal: React.FC<SettingsModalProps> = memo(({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  selectedVoiceId,
  onSelectVoice
}) => {
  const isDark = theme === 'dark';
  const [voiceGender, setVoiceGender] = useState<'all' | 'male' | 'female'>('all');
  const [serverVoiceIds, setServerVoiceIds] = useState<Set<string> | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingVoices(true);
    setVoiceError(null);
    fetchEdgeVoiceIds()
      .then(ids => { if (isMounted) setServerVoiceIds(new Set(ids)); })
      .catch(() => { if (isMounted) { setVoiceError('Voice server offline — showing local list'); setServerVoiceIds(null); } })
      .finally(() => { if (isMounted) setIsLoadingVoices(false); });
    return () => { isMounted = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!serverVoiceIds || serverVoiceIds.size === 0) return;
    if (selectedVoiceId && !serverVoiceIds.has(selectedVoiceId)) onSelectVoice('');
  }, [serverVoiceIds, selectedVoiceId, onSelectVoice]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleEscape); document.body.style.overflow = ''; };
  }, [isOpen, onClose]);

  const handleVoiceSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectVoice(e.target.value);
  }, [onSelectVoice]);

  const filteredVoices = useMemo(() => {
    if (voiceGender === 'all') return VOICE_LIBRARY;
    return VOICE_LIBRARY.filter(v => v.gender === voiceGender);
  }, [voiceGender]);

  const availableVoices = useMemo(() => {
    if (!serverVoiceIds || serverVoiceIds.size === 0) return filteredVoices;
    return filteredVoices.filter(v => serverVoiceIds.has(v.id));
  }, [filteredVoices, serverVoiceIds]);

  if (!isOpen) return null;

  const muted = isDark ? 'text-neutral-500' : 'text-neutral-400';
  const fg = isDark ? 'text-neutral-100' : 'text-neutral-900';
  const card = isDark ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-neutral-50 border-black/[0.07]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="absolute inset-0 bg-black/50 animate-fadeIn" onClick={onClose} />

      <div className={`relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl animate-slide-up overflow-hidden ${isDark ? 'bg-[#2f2f2f] border-white/10' : 'bg-white border-black/10'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 h-14 shrink-0 border-b ${isDark ? 'border-white/[0.07]' : 'border-black/[0.06]'}`}>
          <h2 className={`text-[15px] font-medium ${fg}`}>Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:bg-white/10 hover:text-neutral-200' : 'text-neutral-400 hover:bg-black/5 hover:text-neutral-700'}`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-7">
          {/* Appearance */}
          <section>
            <p className={`text-[12px] font-medium mb-2.5 ${muted}`}>Appearance</p>
            <div className={`grid grid-cols-2 gap-2 p-1 rounded-2xl border ${card}`}>
              {([
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
              ] as const).map(opt => {
                const active = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => { if (theme !== opt.id) onToggleTheme(); }}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13.5px] font-medium transition-all ${active
                      ? (isDark ? 'bg-white/[0.09] text-white shadow-sm' : 'bg-white text-neutral-900 shadow-sm border border-black/[0.06]')
                      : (isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-500 hover:text-neutral-700')}`}
                  >
                    <opt.icon size={15} strokeWidth={1.8} />
                    {opt.label}
                    {active && <Check size={14} className="opacity-60" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Voice */}
          <section>
            <p className={`text-[12px] font-medium mb-2.5 ${muted}`}>Voice</p>
            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center gap-1 mb-3">
                {(['all', 'male', 'female'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setVoiceGender(option)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium capitalize transition-colors ${voiceGender === option
                      ? (isDark ? 'bg-white/[0.1] text-white' : 'bg-neutral-900 text-white')
                      : (isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-500 hover:text-neutral-800')}`}
                  >
                    {option}
                  </button>
                ))}
                <span className={`ml-auto text-[11.5px] ${muted}`}>
                  {isLoadingVoices ? 'Loading…' : voiceError ?? `${availableVoices.length} voices`}
                </span>
              </div>
              <select
                value={selectedVoiceId}
                onChange={handleVoiceSelect}
                disabled={isLoadingVoices}
                className={`w-full px-3 py-2.5 rounded-xl border text-[13.5px] outline-none cursor-pointer appearance-none transition-colors ${isDark ? 'bg-[#212121] border-white/10 text-neutral-200' : 'bg-white border-black/10 text-neutral-800'}`}
              >
                <option value="">Auto (language default)</option>
                {availableVoices.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} — {voice.lang}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Shortcuts */}
          <section>
            <p className={`text-[12px] font-medium mb-1 ${muted}`}>Keyboard shortcuts</p>
            <div>
              {SHORTCUTS.map(s => (
                <div key={s.key} className={`flex items-center justify-between py-2.5 border-b last:border-0 ${isDark ? 'border-white/[0.05]' : 'border-black/[0.05]'}`}>
                  <span className={`text-[13.5px] ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>{s.task}</span>
                  <kbd className={`px-2 py-1 rounded-md text-[11.5px] font-medium border ${isDark ? 'bg-white/[0.05] border-white/10 text-neutral-400' : 'bg-neutral-100 border-black/[0.07] text-neutral-500'}`}>
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 text-center border-t shrink-0 ${isDark ? 'border-white/[0.07]' : 'border-black/[0.06]'}`}>
          <p className={`text-[11px] ${muted}`}>Tufan v2.0.0</p>
        </div>
      </div>
    </div>
  );
});

export default SettingsModal;
