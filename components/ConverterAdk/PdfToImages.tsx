import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileArchive,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import FileDropzone from './FileDropzone';
import { downloadBlob, formatBytes } from './api';
import type { ToolDefinition } from './tools';

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');
const MAX_PAGES = 80;

interface PageImage {
  page: number;
  blob: Blob;
  url: string;
  size: number;
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '').trim() || 'document';

const parseRange = (raw: string, total: number): number[] => {
  const value = raw.trim();
  if (!value) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>();
  for (const part of value.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!match) throw new Error(`"${token}" is not a valid page selection. Try 1-3, 5.`);
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    if (from < 1 || to < 1 || from > total || to > total) throw new Error(`Page ${token} is outside 1–${total}.`);
    if (from > to) throw new Error(`Range "${token}" is reversed.`);
    for (let p = from; p <= to; p += 1) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
};

export default function PdfToImages({ tool, onBack }: { tool: ToolDefinition; onBack: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [scale, setScale] = useState('2');
  const [quality, setQuality] = useState(85);
  const [range, setRange] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [pages, setPages] = useState<PageImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [progress, setProgress] = useState('');
  const pagesRef = useRef<PageImage[]>([]);

  pagesRef.current = pages;

  useEffect(() => {
    return () => {
      pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    };
  }, []);

  const clearPages = useCallback(() => {
    setPages((current) => {
      current.forEach((page) => URL.revokeObjectURL(page.url));
      return [];
    });
  }, []);

  const reset = () => {
    clearPages();
    setFiles([]);
    setRange('');
    setError(null);
    setFileError(null);
    setStatus('idle');
  };

  const convert = async () => {
    const file = files[0];
    if (!file) {
      setError('Choose a PDF first.');
      return;
    }

    setError(null);
    setStatus('working');
    clearPages();

    try {
      setProgress('Loading the PDF engine…');
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument({ data });
      const pdf = await loadingTask.promise;

      if (pdf.numPages > MAX_PAGES) {
        throw new Error(
          `This PDF has ${pdf.numPages} pages. Convert up to ${MAX_PAGES} pages at a time to keep memory use sane.`
        );
      }

      const selected = parseRange(range, pdf.numPages);
      if (selected.length > MAX_PAGES) {
        throw new Error(`Select at most ${MAX_PAGES} pages.`);
      }

      const output: PageImage[] = [];
      for (const [index, pageNumber] of selected.entries()) {
        setProgress(`Rendering page ${pageNumber} — ${index + 1} of ${selected.length}`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: Number(scale) || 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your browser could not create a drawing surface for this PDF.');

        await page.render({ canvas, canvasContext: context, viewport }).promise;

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality / 100)
        );
        if (!blob) throw new Error('The page could not be turned into a JPG.');
        output.push({ page: pageNumber, blob, url: URL.createObjectURL(blob), size: blob.size });

        canvas.width = 0;
        canvas.height = 0;
      }

      await loadingTask.destroy();
      setPages(output);
      setStatus('done');
      setProgress('');
    } catch (caught) {
      setStatus('idle');
      setProgress('');
      setError((caught as Error)?.message || 'The PDF could not be rendered.');
    }
  };

  const downloadAll = async () => {
    if (!pages.length) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const base = baseName(files[0]?.name || 'document');
      pages.forEach((page) => {
        zip.file(`${base}-page-${String(page.page).padStart(2, '0')}.jpg`, page.blob);
      });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      downloadBlob(blob, `${base}-images.zip`);
    } catch {
      setError('The ZIP archive could not be created.');
    } finally {
      setZipping(false);
    }
  };

  const busy = status === 'working';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" /> All tools
      </button>

      <header className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#A855F7]/20 bg-[#A855F7]/10 text-[#7E22CE] dark:text-[#C084FC]">
          <tool.icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{tool.name}</h1>
            <span className="rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              PDF <span aria-hidden="true">→</span> JPG
            </span>
          </div>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--text-secondary)]">{tool.description}</p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 sm:p-5">
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#A855F7]/15 text-[11px] font-bold text-[#7E22CE] dark:text-[#C084FC]">
              1
            </span>
            Upload a PDF
          </h2>
          <FileDropzone
            accept="application/pdf,.pdf"
            multiple={false}
            maxFiles={1}
            fileLabel="a PDF"
            files={files}
            onChange={(next) => {
              setFiles(next);
              setError(null);
              if (status === 'done') {
                clearPages();
                setStatus('idle');
              }
            }}
            onError={setFileError}
            disabled={busy}
          />
          {fileError && (
            <p role="alert" className="mt-3 flex items-center gap-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-[12px] text-[#B91C1C] dark:text-[#FCA5A5]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {fileError}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 sm:p-5">
          <h2 className="mb-4 text-[13px] font-semibold text-[var(--text-primary)]">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#A855F7]/15 text-[11px] font-bold text-[#7E22CE] dark:text-[#C084FC]">
              2
            </span>
            Options
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="pdf-resolution" className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                Resolution
              </label>
              <select
                id="pdf-resolution"
                value={scale}
                disabled={busy}
                onChange={(event) => setScale(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[#A855F7] focus:ring-2 focus:ring-[#A855F7]/25"
              >
                <option value="1">72 DPI — fast, small</option>
                <option value="2">144 DPI — balanced</option>
                <option value="3">216 DPI — sharp, larger</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="pdf-quality" className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  JPG quality
                </label>
                <span className="text-[12px] tabular-nums text-[var(--text-primary)]">{quality}%</span>
              </div>
              <input
                id="pdf-quality"
                type="range"
                min={50}
                max={100}
                step={5}
                value={quality}
                disabled={busy}
                onChange={(event) => setQuality(Number(event.target.value))}
                className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border-color)] accent-[#A855F7]"
              />
            </div>

            <div>
              <label htmlFor="pdf-range" className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                Pages (blank = all)
              </label>
              <input
                id="pdf-range"
                type="text"
                value={range}
                placeholder="1-3, 7"
                disabled={busy}
                onChange={(event) => setRange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[#A855F7] focus:ring-2 focus:ring-[#A855F7]/25"
              />
            </div>
          </div>

          <div aria-live="polite" className="mt-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-[12px] text-[#B91C1C] dark:text-[#FCA5A5]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="ml-auto" aria-label="Dismiss error">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {busy ? (
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5">
                <p className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-primary)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#A855F7]" aria-hidden="true" />
                  {progress || 'Rendering…'}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={convert}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#A855F7] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#9333EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Convert to JPG
              </button>
            )}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
            Rendering happens in your browser — the PDF is never uploaded.
          </p>
        </section>
      </div>

      {status === 'done' && pages.length > 0 && (
        <section className="mt-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-[#047857] dark:text-[#34D399]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {pages.length} page{pages.length > 1 ? 's' : ''} rendered
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                {formatBytes(pages.reduce((total, page) => total + page.size, 0))} total
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadAll}
                disabled={zipping}
                className="inline-flex items-center gap-2 rounded-xl bg-[#A855F7] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-[#9333EA] disabled:opacity-60"
              >
                {zipping ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FileArchive className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Download all (.zip)
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3.5 py-2 text-[12px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Convert another
              </button>
            </div>
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pages.map((page) => (
              <li key={page.page} className="group overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]">
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-[var(--bg-elevated)]">
                  <img
                    src={page.url}
                    alt={`Page ${page.page} rendered as JPG`}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    <ImageIcon className="mr-1 inline h-3 w-3" aria-hidden="true" />
                    Page {page.page}
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadBlob(page.blob, `page-${String(page.page).padStart(2, '0')}.jpg`)}
                    className={cx(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#7E22CE] dark:text-[#C084FC]',
                      'hover:bg-[#A855F7]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/50'
                    )}
                  >
                    <Download className="h-3 w-3" aria-hidden="true" /> JPG
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
