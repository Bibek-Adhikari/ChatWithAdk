import React, { useCallback, useId, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, FileText, Upload, X } from 'lucide-react';
import { formatBytes } from './api';

const MAX_BYTES = 20 * 1024 * 1024;

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

const extensionsFromAccept = (accept: string) =>
  accept
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.startsWith('.'));

const mimePrefixesFromAccept = (accept: string) =>
  accept
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.includes('/') && !entry.startsWith('.'));

interface FileDropzoneProps {
  accept: string;
  multiple: boolean;
  maxFiles: number;
  fileLabel: string;
  files: File[];
  onChange: (files: File[]) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
}

export default function FileDropzone({
  accept,
  multiple,
  maxFiles,
  fileLabel,
  files,
  onChange,
  onError,
  disabled = false,
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const accepts = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase();
      const type = (file.type || '').toLowerCase();
      const exts = extensionsFromAccept(accept);
      const prefixes = mimePrefixesFromAccept(accept);
      const extOk = exts.some((ext) => name.endsWith(ext));
      const mimeOk = prefixes.some((prefix) =>
        prefix.endsWith('/*') ? type.startsWith(prefix.slice(0, -1)) : type === prefix
      );
      return extOk || mimeOk;
    },
    [accept]
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (disabled) return;
      const list = Array.from(incoming);
      if (!list.length) return;

      const accepted: File[] = [];
      for (const file of list) {
        if (!accepts(file)) {
          onError(`"${file.name}" is not a supported file type here. Accepted: ${fileLabel}.`);
          return;
        }
        if (file.size > MAX_BYTES) {
          onError(`"${file.name}" is ${formatBytes(file.size)}. The limit is 20 MB per file.`);
          return;
        }
        if (file.size === 0) {
          onError(`"${file.name}" is empty.`);
          return;
        }
        accepted.push(file);
      }

      const combined = multiple ? [...files, ...accepted] : accepted.slice(-1);
      if (multiple && combined.length > maxFiles) {
        onError(`You can add up to ${maxFiles} files per conversion.`);
        return;
      }
      onError(null);
      onChange(combined);
    },
    [accepts, disabled, fileLabel, files, maxFiles, multiple, onChange, onError]
  );

  const removeAt = (index: number) => {
    onError(null);
    onChange(files.filter((_, i) => i !== index));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Upload ${fileLabel}`}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (disabled) return;
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          if (disabled) return;
          addFiles(event.dataTransfer.files);
        }}
        className={cx(
          'group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]',
          dragging
            ? 'border-[#A855F7] bg-[#A855F7]/10'
            : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[#A855F7]/60 hover:bg-[var(--bg-hover)]',
          disabled && 'pointer-events-none opacity-50'
        )}
      >
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[#A855F7] transition group-hover:border-[#A855F7]/40">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {dragging ? 'Release to add your files' : `Drop ${fileLabel} here, or click to browse`}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {multiple ? `Up to ${maxFiles} files · ` : 'One file · '}20 MB each
        </p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2" aria-label="Selected files">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{file.name}</span>
                <span className="text-[11px] text-[var(--text-secondary)]">{formatBytes(file.size)}</span>
              </span>
              {multiple && files.length > 1 && (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${file.name} up`}
                    className="rounded-md p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === files.length - 1}
                    aria-label={`Move ${file.name} down`}
                    className="rounded-md p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={`Remove ${file.name}`}
                className="rounded-md p-1.5 text-[var(--text-secondary)] transition hover:bg-[#EF4444]/15 hover:text-[#EF4444]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Files are processed in memory and never stored on the server.
      </p>
    </div>
  );
}
