import React, { useState, useEffect, useRef } from 'react';
import { X, List } from 'lucide-react';

export interface PromptTreeItem {
  id: string;
  text: string;
}

interface PromptTreePanelProps {
  prompts: PromptTreeItem[];
  theme?: 'light' | 'dark';
  onJump: (id: string) => void;
  onClose: () => void;
}

/**
 * DeepSeek-style prompt navigator: floating list of the session's user
 * questions. Clicking an item scrolls to that message; the item nearest
 * the viewport middle is highlighted via IntersectionObserver.
 */
const PromptTreePanel: React.FC<PromptTreePanelProps> = ({ prompts, theme = 'dark', onJump, onClose }) => {
  const isDark = theme === 'dark';
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();
    const visible = new Set<string>();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const id = (e.target as HTMLElement).id?.replace(/^msg-/, '');
          if (!id) return;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        });
        // Highlight the last visible prompt = nearest to viewport bottom
        const ordered = prompts.map((p) => p.id).filter((id) => visible.has(id));
        setActiveId(ordered.length > 0 ? ordered[ordered.length - 1] : null);
      },
      { root: null, rootMargin: '-20% 0px -55% 0px', threshold: 0 }
    );
    const obs = observerRef.current;
    prompts.forEach((p) => {
      const el = document.getElementById(`msg-${p.id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [prompts]);

  return (
    <div
      className={`absolute right-3 top-12 z-20 w-64 max-w-[75vw] rounded-2xl border shadow-2xl backdrop-blur-md overflow-hidden animate-slide-up ${
        isDark ? 'bg-[#2a2a2a]/95 border-white/10' : 'bg-white/95 border-black/10'
      }`}
    >
      <div className={`flex items-center gap-2 px-3.5 py-2.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}>
        <List size={14} className={isDark ? 'text-neutral-400' : 'text-neutral-500'} />
        <span className={`text-[12px] font-semibold flex-1 ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
          Prompts · {prompts.length}
        </span>
        <button
          onClick={onClose}
          title="Close"
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            isDark ? 'text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200' : 'text-neutral-400 hover:bg-black/[0.05] hover:text-neutral-700'
          }`}
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-[46vh] overflow-y-auto custom-scrollbar p-1.5">
        {prompts.map((p, i) => {
          const active = p.id === activeId;
          return (
            <button
              key={p.id}
              onClick={() => {
                setActiveId(p.id);
                onJump(p.id);
              }}
              title={p.text}
              className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                active
                  ? isDark
                    ? 'bg-white/[0.08] text-neutral-100'
                    : 'bg-black/[0.05] text-neutral-900'
                  : isDark
                    ? 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
                    : 'text-neutral-500 hover:bg-black/[0.03] hover:text-neutral-800'
              }`}
            >
              <span
                className={`text-[10px] font-bold mt-0.5 shrink-0 w-4 text-right tabular-nums ${
                  active ? 'text-[#4d6bfe]' : 'opacity-50'
                }`}
              >
                {i + 1}
              </span>
              <span className="text-[12.5px] leading-snug line-clamp-2 break-words flex-1">{p.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PromptTreePanel;
