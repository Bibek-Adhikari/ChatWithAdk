import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, Files, Search, X } from 'lucide-react';
import ToolWorkbench from './ToolWorkbench';
import PdfToImages from './PdfToImages';
import { fetchCapabilities } from './api';
import type { Capabilities, ToolCategoryId, ToolDefinition } from './tools';
import { TOOL_CATEGORIES, applyCapabilities, matchesQuery, readyToolCount } from './tools';

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

const readHash = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return raw || null;
};

type Theme = 'light' | 'dark';

interface ToolSectionData {
  id: ToolCategoryId;
  label: string;
  blurb: string;
  secondary?: boolean;
  tools: ToolDefinition[];
}

const ConverterAdk: React.FC<{ theme: Theme; onClose: () => void }> = ({ theme, onClose }) => {
  const [activeId, setActiveId] = useState<string | null>(() => readHash());
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | ToolCategoryId>('all');
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const convertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onHashChange = () => setActiveId(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCapabilities(controller.signal).then((caps) => {
      if (caps) setCapabilities(caps);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!convertOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!convertRef.current?.contains(event.target as Node)) setConvertOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [convertOpen]);

  const openTool = useCallback((id: string | null) => {
    setActiveId(id);
    setConvertOpen(false);
    if (typeof window !== 'undefined') {
      if (id) {
        window.location.hash = id;
      } else {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const tools = useMemo(() => applyCapabilities(capabilities), [capabilities]);

  const filtered = useMemo(
    () =>
      tools.filter(
        (tool) =>
          (activeCategory === 'all' || tool.category === activeCategory) && matchesQuery(tool, query)
      ),
    [activeCategory, query, tools]
  );

  const grouped = useMemo(
    () =>
      TOOL_CATEGORIES.map((entry) => ({
        ...entry,
        tools: filtered.filter((tool) => tool.category === entry.id),
      })).filter((entry) => entry.tools.length > 0),
    [filtered]
  );

  const primaryGroups = grouped.filter((group) => !group.secondary) as ToolSectionData[];
  const secondaryGroups = grouped.filter((group) => group.secondary) as ToolSectionData[];

  const readyCount = readyToolCount(tools);
  const plannedCount = tools.length - readyCount;
  const activeTool = useMemo(() => tools.find((tool) => tool.id === activeId) ?? null, [activeId, tools]);

  const quickLinks = useMemo(
    () =>
      ['merge-pdf', 'split-pdf', 'compress-pdf']
        .map((id) => tools.find((tool) => tool.id === id))
        .filter(Boolean) as ToolDefinition[],
    [tools]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openTool(null);
        window.setTimeout(() => searchRef.current?.focus(), 0);
        return;
      }
      if (event.key === '/' && !typing) {
        event.preventDefault();
        openTool(null);
        window.setTimeout(() => searchRef.current?.focus(), 0);
        return;
      }
      if (event.key === 'Escape') {
        if (convertOpen) {
          setConvertOpen(false);
          return;
        }
        if (typing && (target as HTMLInputElement).value) {
          setQuery('');
          (target as HTMLInputElement).blur();
          return;
        }
        if (activeId) {
          event.preventDefault();
          openTool(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeId, convertOpen, onClose, openTool]);

  const clearFilters = () => {
    setQuery('');
    setActiveCategory('all');
  };

  return (
    <div
      ref={scrollRef}
      className="h-full w-full overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased"
      style={{ colorScheme: theme }}
    >
      {/* ── header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setActiveCategory('all');
              openTool(null);
            }}
            className="flex items-center gap-2.5 rounded-lg py-1 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/60"
            aria-label="ConverterAdk home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[#A855F7]">
              <Files className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col text-left leading-tight">
              <span className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">ConverterAdk</span>
              <span className="text-[10px] text-[var(--text-secondary)]">by Tufan</span>
            </span>
          </button>

          <nav aria-label="Quick tools" className="ml-3 hidden items-center gap-1 lg:flex">
            {quickLinks.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => openTool(tool.id)}
                className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/50"
              >
                {tool.name}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A855F7]" aria-hidden="true" />
              {readyCount} ready
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/60"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Back to Tufan</span>
              <span className="sm:hidden">Back</span>
            </button>
          </div>
        </div>
      </header>

      {activeTool ? (
        activeTool.id === 'pdf-to-jpg' ? (
          <PdfToImages key={activeTool.id} tool={activeTool} onBack={() => openTool(null)} />
        ) : (
          <ToolWorkbench key={activeTool.id} tool={activeTool} onBack={() => openTool(null)} />
        )
      ) : (
        <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
          <div className="mb-5">
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">All PDF tools</h1>
            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
              {readyCount} ready · {plannedCount} coming soon · files never leave memory
            </p>
          </div>

          <div className="mb-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 sm:p-5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search PDF tools…"
                aria-label="Search PDF tools"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] py-2.5 pl-10 pr-16 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-tertiary)] focus:border-[#A855F7] focus:ring-2 focus:ring-[#A855F7]/20 [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-sans text-[10px] text-[var(--text-tertiary)]">
                  ⌘K
                </kbd>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <FilterPill active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
                All categories
              </FilterPill>
              {TOOL_CATEGORIES.map((entry) => (
                <FilterPill
                  key={entry.id}
                  active={activeCategory === entry.id}
                  onClick={() => setActiveCategory(entry.id)}
                >
                  {entry.label}
                </FilterPill>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 py-12 text-center">
              <p className="text-[14px] font-medium text-[var(--text-primary)]">No tools match “{query}”.</p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Try a different search or category.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {primaryGroups.map((section) => (
                <ToolSection key={section.id} section={section} onOpen={openTool} />
              ))}

              {secondaryGroups.length > 0 && (
                <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 sm:p-5">
                  <h2 className="mb-3 text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                    More PDF tools
                  </h2>
                  <div className="space-y-5">
                    {secondaryGroups.map((section) => (
                      <ToolSection key={section.id} section={section} onOpen={openTool} nested />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default ConverterAdk;

/* ── small building blocks ─────────────────────────────────────── */

const FilterPill = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cx(
      'rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/50',
      active
        ? 'border-[#A855F7] bg-[#A855F7] text-white'
        : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[#A855F7]/40 hover:text-[var(--text-primary)]'
    )}
  >
    {children}
  </button>
);

const ToolSection = ({
  section,
  onOpen,
  nested = false,
}: {
  section: ToolSectionData;
  onOpen: (id: string | null) => void;
  nested?: boolean;
}) => (
  <section aria-labelledby={`section-${section.id}`} className={nested ? '' : 'pt-1'}>
    <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h2
        id={`section-${section.id}`}
        className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]"
      >
        {section.label}
      </h2>
      <p className="text-[11px] text-[var(--text-tertiary)]">{section.blurb}</p>
    </div>
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {section.tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} onOpen={onOpen} />
      ))}
    </div>
  </section>
);

const ToolCard = ({ tool, onOpen }: { tool: ToolDefinition; onOpen: (id: string | null) => void }) => {
  const Icon = tool.icon;
  const planned = tool.availability !== 'ready';

  return (
    <button
      type="button"
      onClick={() => onOpen(tool.id)}
      className="group flex h-full w-full items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-left transition hover:border-[#A855F7]/40 hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#A855F7]/20 bg-[#A855F7]/10 text-[#C084FC]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{tool.name}</span>
          {planned && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#F59E0B]">
              <Clock className="h-2.5 w-2.5" aria-hidden="true" /> Soon
            </span>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
          {tool.tagline}
        </span>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
          {tool.from} <span aria-hidden="true">→</span> {tool.to}
        </span>
      </span>
    </button>
  );
};
