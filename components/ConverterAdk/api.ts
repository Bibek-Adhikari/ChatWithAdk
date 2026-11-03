import type { Capabilities, ToolWorkflow } from './tools';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export class ConversionApiError extends Error {
  code: string;
  setup?: string;
  status: number;

  constructor(message: string, options: { code?: string; setup?: string; status?: number } = {}) {
    super(message);
    this.name = 'ConversionApiError';
    this.code = options.code || 'conversion_failed';
    this.setup = options.setup;
    this.status = options.status ?? 0;
  }
}

export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const readError = async (response: Response) => {
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON body */
  }
  const message =
    payload?.error ||
    (response.status === 413
      ? 'That file is too large for the server.'
      : response.status === 429
        ? 'Too many conversions in a short time. Please wait a moment.'
        : `Conversion failed (${response.status}). Please try again.`);
  return new ConversionApiError(String(message), {
    code: payload?.code,
    setup: payload?.setup,
    status: response.status,
  });
};

export async function fetchCapabilities(signal?: AbortSignal): Promise<Capabilities | null> {
  try {
    const response = await fetch(`${API_BASE}/api/converter/capabilities`, {
      method: 'GET',
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as Capabilities;
  } catch {
    return null;
  }
}

const filenameFromResponse = (response: Response, fallback: string) => {
  const header = response.headers.get('Content-Disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
};

export async function runConversion(
  workflow: ToolWorkflow,
  files: File[],
  values: Record<string, string | number | boolean>,
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string; size: number }> {
  const body = new FormData();
  files.forEach((file) => body.append('files', file, file.name));

  for (const field of workflow.fields) {
    const value = values[field.name];
    if (value === undefined || value === null || value === '') continue;
    body.append(field.name, String(value));
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${workflow.endpoint}`, {
      method: 'POST',
      body,
      signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ConversionApiError(
      'Could not reach the conversion service. Check your connection and try again.',
      { code: 'network_error' }
    );
  }

  if (!response.ok) throw await readError(response);

  const blob = await response.blob();
  const fallback = workflow.outputName(files.map((file) => file.name));
  return {
    blob,
    filename: filenameFromResponse(response, fallback),
    size: blob.size,
  };
}

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
};
