import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import FileDropzone from './FileDropzone';
import { downloadBlob, formatBytes, runConversion } from './api';
import type { ToolDefinition, ToolField } from './tools';
import { CONVERTER_TOOLS } from './tools';

type Status = 'idle' | 'working' | 'done';

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

const defaultsFor = (tool: ToolDefinition) => {
  const values: Record<string, string | number | boolean> = {};
  tool.workflow?.fields.forEach((field) => {
    values[field.name] = field.defaultValue;
  });
  return values;
};

const isVisible = (field: ToolField, values: Record<string, string | number | boolean>) => {
  if (!field.visibleWhen) return true;
  const current = String(values[field.visibleWhen.field] ?? '');
  if (field.visibleWhen.notEquals !== undefined) return current !== field.visibleWhen.notEquals;
  if (field.visibleWhen.equals !== undefined) return current === field.visibleWhen.equals;
  return true;
};

const labelClass = 'text-[12px] font-medium uppercase tracking-[0.08em] text-[#969EAD]';
const controlClass =
  'mt-2 w-full rounded-xl border border-[#262B34] bg-[#0E1113] px-3 py-2.5 text-[13px] text-[#F5F7FA] outline-none transition ' +
  'placeholder:text-[#5C646F] focus:border-[#A855F7] focus:ring-2 focus:ring-[#A855F7]/25';

function Field({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ToolField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled: boolean;
}) {
  const id = `field-${field.name}`;

  if (field.type === 'toggle') {
    return (
      <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-1">
        <span className="text-[13px] text-[#F5F7FA]">{field.label}</span>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-[#262B34] bg-[#0E1113] accent-[#A855F7]"
        />
      </label>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {field.label}
      </label>

      {field.type === 'select' && (
        <select
          id={id}
          value={String(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cx(controlClass, 'appearance-none bg-[#0E1113]')}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {field.type === 'number' && (
        <input
          id={id}
          type="number"
          value={Number(value)}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
          className={controlClass}
        />
      )}

      {field.type === 'range' && (
        <div className="mt-3 flex items-center gap-3">
          <input
            id={id}
            type="range"
            value={Number(value)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#262B34] accent-[#A855F7]"
          />
          <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-[#F5F7FA]">{Number(value)}%</span>
        </div>
      )}

      {field.type === 'text' && (
        <input
          id={id}
          type="text"
          value={String(value)}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          id={id}
          value={String(value)}
          placeholder={field.placeholder}
          rows={3}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cx(controlClass, 'resize-y font-mono')}
        />
      )}

      {field.help && <p className="mt-1.5 text-[11px] leading-relaxed text-[#6B7482]">{field.help}</p>}
    </div>
  );
}

function UnavailablePanel({ tool, onBack }: { tool: ToolDefinition; onBack: () => void }) {
  const alternatives = useMemo(
    () =>
      CONVERTER_TOOLS.filter(
        (candidate) => candidate.availability === 'ready' && candidate.category === tool.category
      ).slice(0, 3),
    [tool.category]
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-[#969EAD] transition hover:text-[#F5F7FA]"
      >
        <ArrowLeft className="h-4 w-4" /> All tools
      </button>

      <div className="rounded-2xl border border-[#262B34] bg-[#111419] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#262B34] bg-[#181C23] text-[#969EAD]">
            <tool.icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A855F7]">Not available yet</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#F5F7FA]">{tool.name}</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-[#969EAD]">{tool.description}</p>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" aria-hidden="true" />
          <div className="text-[13px] leading-relaxed text-[#FCD9A4]">
            <p className="font-medium text-[#FDE7C4]">This tool is deliberately switched off.</p>
            <p className="mt-1 text-[#E4C08D]">
              {tool.blockedReason ||
                'The server does not have the engine this conversion needs, so we are not going to pretend it works.'}
            </p>
            {tool.setup && (
              <p className="mt-2 rounded-lg bg-[#0B0D10]/60 px-3 py-2 font-mono text-[11px] text-[#E4C08D]">
                Setup: {tool.setup}
              </p>
            )}
          </div>
        </div>

        {alternatives.length > 0 && (
          <div className="mt-6">
            <p className={labelClass}>Works right now</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {alternatives.map((candidate) => (
                <span
                  key={candidate.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#262B34] bg-[#0E1113] px-3 py-1.5 text-[12px] text-[#C7CEDA]"
                >
                  <candidate.icon className="h-3.5 w-3.5 text-[#A855F7]" aria-hidden="true" />
                  {candidate.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#A855F7] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#9333EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111419]"
        >
          Back to the dashboard
        </button>
      </div>
    </div>
  );
}

export default function ToolWorkbench({ tool, onBack }: { tool: ToolDefinition; onBack: () => void }) {
  const workflow = tool.workflow;
  const [files, setFiles] = useState<File[]>([]);
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() => defaultsFor(tool));
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<{ blob: Blob; filename: string; size: number; url: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const reset = useCallback(() => {
    setFiles([]);
    setFileError(null);
    setError(null);
    setStatus('idle');
    setResult(null);
  }, []);

  if (!workflow || tool.availability !== 'ready') {
    return <UnavailablePanel tool={tool} onBack={onBack} />;
  }

  const busy = status === 'working';

  const validate = () => {
    if (files.length < workflow.minFiles) {
      return workflow.minFiles > 1
        ? `Add at least ${workflow.minFiles} files to continue.`
        : `Add a ${workflow.fileLabel.toLowerCase()} to continue.`;
    }
    for (const field of workflow.fields) {
      if (!isVisible(field, values)) continue;
      const value = values[field.name];
      const required = ['text', 'textarea'].includes(field.type) && field.name !== 'pages' && field.name !== 'ranges';
      if (field.name === 'pages' && tool.id === 'extract-pages' && !String(value).trim()) {
        return 'Enter the pages you want to keep.';
      }
      if (field.name === 'pages' && tool.id === 'delete-pages' && !String(value).trim()) {
        return 'Enter the pages you want to delete.';
      }
      if (field.name === 'ranges' && String(values.mode) === 'ranges' && !String(value).trim()) {
        return 'Add at least one range.';
      }
      if (required && !String(value).trim()) {
        return `${field.label} is required.`;
      }
    }
    return null;
  };

  const convert = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setStatus('working');
    if (result) {
      URL.revokeObjectURL(result.url);
      setResult(null);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const output = await runConversion(workflow, files, values, controller.signal);
      setResult({ ...output, url: URL.createObjectURL(output.blob) });
      setStatus('done');
    } catch (caught) {
      if ((caught as Error)?.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setError((caught as Error)?.message || 'That conversion failed. Please try again.');
      setStatus('idle');
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
  };

  const onFilesChange = (next: File[]) => {
    setFiles(next);
    setError(null);
    if (status === 'done') {
      if (result) URL.revokeObjectURL(result.url);
      setResult(null);
      setStatus('idle');
    }
  };

  const setField = (name: string, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const isPdf = result?.blob.type.includes('pdf');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[#969EAD] transition hover:text-[#F5F7FA]"
      >
        <ArrowLeft className="h-4 w-4" /> All tools
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#A855F7]/20 bg-[#A855F7]/10 text-[#C084FC]">
            <tool.icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[#F5F7FA]">{tool.name}</h1>
              <span className="rounded-md border border-[#262B34] bg-[#111419] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#969EAD]">
                {tool.from} <span aria-hidden="true">→</span> {tool.to}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[#969EAD]">{tool.description}</p>
          </div>
        </div>
        {tool.runtime === 'server' && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/25 bg-[#10B981]/10 px-2.5 py-1 text-[11px] font-medium text-[#34D399]">
            <Server className="h-3 w-3" aria-hidden="true" /> Server-side conversion
          </span>
        )}
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── upload + options ───────────────────────────────────── */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-[#262B34] bg-[#111419] p-4 sm:p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold text-[#F5F7FA]">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#A855F7]/15 text-[11px] font-bold text-[#C084FC]">
                  1
                </span>
                Upload
              </h2>
              <span className="text-[11px] text-[#6B7482]">{files.length} selected</span>
            </div>

            <FileDropzone
              accept={workflow.accept}
              multiple={workflow.multiple}
              maxFiles={workflow.maxFiles}
              fileLabel={workflow.fileLabel}
              files={files}
              onChange={onFilesChange}
              onError={setFileError}
              disabled={busy}
            />

            {fileError && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-[12px] text-[#FCA5A5]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {fileError}
                <button type="button" onClick={() => setFileError(null)} className="ml-auto shrink-0" aria-label="Dismiss error">
                  <X className="h-3.5 w-3.5" />
                </button>
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[#262B34] bg-[#111419] p-4 sm:p-5">
            <h2 className="mb-4 text-[13px] font-semibold text-[#F5F7FA]">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#A855F7]/15 text-[11px] font-bold text-[#C084FC]">
                2
              </span>
              Options
            </h2>

            {workflow.fields.length === 0 ? (
              <p className="text-[12px] text-[#969EAD]">
                No options needed — this conversion runs with sensible defaults.
              </p>
            ) : (
              <div className="space-y-4">
                {workflow.fields.filter((field) => isVisible(field, values)).map((field) => (
                  <Field
                    key={field.name}
                    field={field}
                    value={values[field.name]}
                    onChange={(value) => setField(field.name, value)}
                    disabled={busy}
                  />
                ))}
              </div>
            )}

            {workflow.note && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-[#3B82F6]/25 bg-[#3B82F6]/10 px-3 py-2 text-[11px] leading-relaxed text-[#93C5FD]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {workflow.note}
              </p>
            )}
          </section>
        </div>

        {/* ── action + result ────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[#262B34] bg-[#111419] p-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#969EAD]">Result</p>

            <div aria-live="polite" className="mt-3">
              {status === 'idle' && !error && (
                <div className="space-y-3">
                  <p className="text-[13px] text-[#C7CEDA]">Ready when you are.</p>
                  <ul className="space-y-2 text-[12px] text-[#969EAD]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2
                        className={cx('h-3.5 w-3.5', files.length ? 'text-[#10B981]' : 'text-[#3A414C]')}
                        aria-hidden="true"
                      />
                      {files.length ? `${files.length} file${files.length > 1 ? 's' : ''} ready` : 'Add your files'}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
                      Output: {workflow.outputExtension.toUpperCase()}
                    </li>
                    <li className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
                      Deleted from memory after download
                    </li>
                  </ul>
                </div>
              )}

              {status === 'working' && (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-[#F5F7FA]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#A855F7]" aria-hidden="true" />
                    Converting…
                  </p>
                  <div className="h-1 overflow-hidden rounded-full bg-[#262B34]">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-[#A855F7]" />
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#6B7482]">
                    Larger documents take longer. You can cancel at any time.
                  </p>
                </div>
              )}

              {status === 'done' && result && (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-[#34D399]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Conversion complete
                  </p>
                  <div className="rounded-xl border border-[#262B34] bg-[#0E1113] p-3">
                    <p className="truncate text-[12px] font-medium text-[#F5F7FA]" title={result.filename}>
                      {result.filename}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#969EAD]">{formatBytes(result.size)}</p>
                  </div>
                  {isPdf && (
                    <iframe
                      src={result.url}
                      title={`Preview of ${result.filename}`}
                      className="h-48 w-full rounded-xl border border-[#262B34] bg-white"
                    />
                  )}
                </div>
              )}

              {error && (
                <div className="space-y-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-3">
                  <p className="flex items-center gap-2 text-[12px] font-semibold text-[#FCA5A5]">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Conversion failed
                  </p>
                  <p className="text-[12px] leading-relaxed text-[#FCA5A5]/90">{error}</p>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {status === 'working' ? (
                <button
                  type="button"
                  onClick={cancel}
                  className="w-full rounded-xl border border-[#262B34] bg-[#181C23] px-4 py-2.5 text-[13px] font-semibold text-[#F5F7FA] transition hover:bg-[#1F242C]"
                >
                  Cancel
                </button>
              ) : status === 'done' && result ? (
                <>
                  <button
                    type="button"
                    onClick={() => downloadBlob(result.blob, result.filename)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#A855F7] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#9333EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111419]"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" /> Download
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#262B34] bg-[#181C23] px-4 py-2.5 text-[13px] font-medium text-[#C7CEDA] transition hover:bg-[#1F242C]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Convert another
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={convert}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#A855F7] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#9333EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111419] disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> {workflow.actionLabel}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
