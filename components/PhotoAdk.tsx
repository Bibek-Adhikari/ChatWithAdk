import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Wand2,
  Scissors,
  Sparkles,
  ScanFace,
  Replace,
  Crop,
  Upload,
  Download,
  Loader2,
  X,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  MoveHorizontal,
  Trash2,
  ArrowLeft,
  Check
} from 'lucide-react';

import { proxyPost } from '../services/serverProxy';
import { imageHistoryService } from '../services/imageHistoryService';

// --- Types ---
type ToolId = 'adktool' | 'genaiBackground' | 'upscaleUltra' | 'faceRetouch' | 'genaiReplace' | 'smartCrop';
type Status = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
type ToastType = 'error' | 'success' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToolConfig {
  id: ToolId;
  label: string;
  endpoint: string;
  description: string;
  icon: React.ElementType;
  requiresPrompt: boolean;
  promptLabel?: string;
  promptPlaceholder?: string;
  /** 'tools' = api.picsart.io/tools/1.0 (sync), 'genai' = genai-api.picsart.io/v1 (async polling) */
  api: 'tools' | 'genai';
  /** show optional mask upload (Smart Replace works in mask mode) */
  needsMask?: boolean;
}

// --- Constants ---
const TOOLS: ToolConfig[] = [
  {
    id: 'adktool',
    label: 'Remove BG',
    endpoint: '/removebg',
    description: 'Remove backgrounds instantly',
    icon: Scissors,
    requiresPrompt: false,
    api: 'tools',
  },
  {
    id: 'genaiBackground',
    label: 'AI Background',
    endpoint: '/painting/replace-background',
    description: 'Generate new backgrounds',
    icon: Sparkles,
    requiresPrompt: true,
    promptLabel: 'Background prompt',
    promptPlaceholder: 'e.g. Cyberpunk city at night',
    api: 'genai',
  },
  {
    id: 'upscaleUltra',
    label: 'Upscale',
    endpoint: '/upscale/ultra',
    description: '2x resolution boost',
    icon: Wand2,
    requiresPrompt: false,
    api: 'tools',
  },
  {
    id: 'faceRetouch',
    label: 'Retouch',
    endpoint: '/enhance/face',
    description: 'Smooth skin & enhance',
    icon: ScanFace,
    requiresPrompt: false,
    api: 'tools',
  },
  {
    id: 'genaiReplace',
    label: 'Replace',
    endpoint: '/painting/inpaint',
    description: 'Replace objects with AI',
    icon: Replace,
    requiresPrompt: true,
    promptLabel: 'Replace with',
    promptPlaceholder: 'e.g. Golden retriever',
    api: 'genai',
    needsMask: true,
  },
  {
    id: 'smartCrop',
    label: 'Crop',
    endpoint: '/smart-crop',
    description: 'AI-focused cropping',
    icon: Crop,
    requiresPrompt: true,
    promptLabel: 'Segment to keep',
    promptPlaceholder: 'e.g. foreground, hat, car',
    api: 'tools',
  },
];

const BASE_URL = 'https://api.picsart.io/tools/1.0';
const GENAI_BASE_URL = 'https://genai-api.picsart.io/v1';
// GenAI jobs are async: POST returns { inference_id }, poll GET /painting/{id}
const GENAI_POLL_INTERVAL_MS = 3000;
const GENAI_POLL_TIMEOUT_MS = 120000;

// --- Helper Components ---

const ToastContainer = ({ toasts, onDismiss, isDark }: { toasts: Toast[]; onDismiss: (id: string) => void; isDark: boolean }) => (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`pointer-events-auto flex items-center gap-2.5 rounded-full pl-4 pr-2 py-2 shadow-xl border text-[13px] animate-slide-up w-auto max-w-full ${isDark ? 'bg-[#2f2f2f] border-white/10 text-neutral-200' : 'bg-white border-black/10 text-neutral-700'}`}
      >
        {toast.type === 'error' ? <AlertCircle size={15} className="text-red-500 shrink-0" /> :
         toast.type === 'success' ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> : <Sparkles size={15} className="shrink-0 opacity-60" />}
        <span className="flex-1 truncate">{toast.message}</span>
        <button onClick={() => onDismiss(toast.id)} className={`p-1.5 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
          <X size={13} />
        </button>
      </div>
    ))}
  </div>
);

interface PhotoAdkProps {
  onClose?: () => void;
  theme?: 'light' | 'dark';
}

// --- Main Component ---

export default function PhotoEditorPro({ onClose, theme = 'dark' }: PhotoAdkProps) {
  const isDark = theme === 'dark';
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [activeToolId, setActiveToolId] = useState<ToolId>('adktool');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [prompt, setPrompt] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const sliderRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Optional mask image for Smart Replace (GenAI inpaint mask mode)
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const maskInputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const activeTool = useMemo(() => TOOLS.find(t => t.id === activeToolId) || TOOLS[0], [activeToolId]);
  const isProcessing = status === 'processing' || status === 'uploading';
  const hasResult = !!processedUrl;

  // Cleanup Object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (processedUrl) URL.revokeObjectURL(processedUrl);
    };
  }, []);

  // Toast Logic
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // File Handling
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('error', 'Please upload a valid image file (JPG, PNG).');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setProcessedUrl(null);
    setStatus('idle');
    setErrorMsg(null);
    setSliderPos(50);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setProcessedUrl(null);
    setStatus('idle');
    setErrorMsg(null);
    setMaskFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (maskInputRef.current) maskInputRef.current.value = '';
  };

  // Slider Logic - Touch & Mouse
  const handleSliderMove = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPos(percent);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!hasResult) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!hasResult || touchStartX.current === null) return;
    handleSliderMove(e.touches[0].clientX);
  };

  const onTouchEnd = () => {
    touchStartX.current = null;
  };

  const onMouseDown = () => {
    if (!hasResult) return;
    const onMove = (e: MouseEvent) => handleSliderMove(e.clientX);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // GenAI helpers — sync responses carry data:[{url}], async ones an inference_id
  const extractGenaiUrl = (data: any): string | null => {
    if (!data) return null;
    if (Array.isArray(data.data) && data.data[0]?.url) return data.data[0].url;
    if (data.data?.url) return data.data.url;
    if (data.url) return data.url;
    return null;
  };

  const pollGenaiResult = async (inferenceId: string, headers: Record<string, string>): Promise<string> => {
    const started = Date.now();
    for (;;) {
      if (Date.now() - started > GENAI_POLL_TIMEOUT_MS) {
        throw new Error('AI job timed out. Please try again.');
      }
      await new Promise(r => setTimeout(r, GENAI_POLL_INTERVAL_MS));
      const res = await fetch(`${GENAI_BASE_URL}/painting/${encodeURIComponent(inferenceId)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) {
        throw new Error(data.detail || data.message || `Result check failed (${res.status})`);
      }
      const url = extractGenaiUrl(data);
      if (url) return url;
      if (data.status === 'failed' || data.status === 'error') {
        throw new Error(data.detail || data.message || 'AI job failed');
      }
      // 202 / queued / processing → keep polling
    }
  };

  // API Logic
  const runTool = async () => {
    if (!selectedFile) return;

    const apiKey = import.meta.env.VITE_PICSART_API_KEY || (import.meta as any).env?.REACT_APP_PICSART_API_KEY || 'YOUR_API_KEY_HERE';
    if (apiKey === 'YOUR_API_KEY_HERE') {
      addToast('error', 'API key missing. Add VITE_PICSART_API_KEY to .env');
      setStatus('error');
      return;
    }

    // Smart Crop defaults an empty segment to "foreground", so don't block it
    if (activeTool.requiresPrompt && activeTool.id !== 'smartCrop' && !prompt.trim()) {
      addToast('error', 'Please describe what you want first');
      return;
    }

    setStatus('processing');
    setErrorMsg(null);

    try {
      // Prefer the metered server proxy (per-user daily quota, key stays server-side).
      // Falls through to the direct-key flow below when the server is absent.
      const file = selectedFile;
      const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',').pop());
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(f);
      });
      const proxied = await (async () => {
        const imageBase64 = await toBase64(file).catch(() => null);
        if (!imageBase64) return null;
        const body: Record<string, unknown> = {
          api: activeTool.api,
          endpoint: activeTool.endpoint,
          imageBase64,
          mime: file.type,
        };
        if (activeTool.id === 'smartCrop') body.segment = prompt.trim() || 'foreground';
        else if (activeTool.requiresPrompt) body.prompt = prompt;
        if (activeTool.id === 'adktool') body.extra = { output_type: 'cutout' };
        if (activeTool.id === 'upscaleUltra') body.extra = { upscale_factor: '2' };
        if (activeTool.api === 'genai') body.prompt = prompt.trim();
        if (activeTool.id === 'genaiReplace' && maskFile) {
          body.maskBase64 = await toBase64(maskFile).catch(() => null);
          body.maskMime = maskFile.type;
          if (!body.maskBase64) return null;
        }
        return proxyPost<{ url: string }>('/picsart', body).catch(() => null);
      })();
      if (proxied) {
        if (proxied.status === 200 && proxied.json?.url) {
          setProcessedUrl(proxied.json.url);
          setStatus('complete');
          addToast('success', 'Done');
          return;
        }
        // Quota exhausted → surface it, do NOT bypass via direct key
        if (proxied.status === 429) throw new Error(proxied.json?.error || 'Daily photo-edit limit reached.');
        // Other server errors → fall through to direct-key flow
      }

      const headers = { 'X-Picsart-API-Key': apiKey };
      let resultUrl: string | null = null;

      if (activeTool.api === 'genai') {
        // --- GenAI flow: POST job, then poll GET /painting/{inference_id} ---
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('prompt', prompt.trim());
        formData.append('count', '1');
        formData.append('format', 'JPG');
        if (activeTool.id === 'genaiReplace' && maskFile) {
          formData.append('mask_image', maskFile);
        }

        const jobRes = await fetch(`${GENAI_BASE_URL}${activeTool.endpoint}`, {
          method: 'POST',
          headers,
          body: formData,
        });
        const jobData = await jobRes.json().catch(() => ({}));
        if (!jobRes.ok) {
          throw new Error(jobData.detail || jobData.message || `Request failed (${jobRes.status})`);
        }

        resultUrl = extractGenaiUrl(jobData);
        const inferenceId: string | undefined = jobData.inference_id || jobData.transaction_id;
        if (!resultUrl && inferenceId) {
          // Async job — poll until ready (202 = processing, 200 + data = done)
          resultUrl = await pollGenaiResult(inferenceId, headers);
        }
        if (!resultUrl) throw new Error('No image returned from API');
      } else {
        // --- Tools API flow: single sync call ---
        const formData = new FormData();
        formData.append('image', selectedFile);

        if (activeTool.id === 'adktool') formData.append('output_type', 'cutout');
        if (activeTool.id === 'upscaleUltra') formData.append('upscale_factor', '2');
        if (activeTool.id === 'smartCrop') {
          // /smart-crop requires a `segment` (e.g. "foreground", "hat")
          formData.append('segment', prompt.trim() || 'foreground');
        } else if (activeTool.requiresPrompt) {
          formData.append('prompt', prompt);
        }

        const response = await fetch(`${BASE_URL}${activeTool.endpoint}`, {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || errorData.message || `Request failed (${response.status})`);
        }

        const data = await response.json();
        resultUrl = data?.data?.url || data?.data?.image_url || data?.url || null;
        if (!resultUrl) throw new Error('No image returned from API');
      }

      setProcessedUrl(resultUrl);
      setStatus('complete');
      addToast('success', 'Done');
      // Verified per-user history in Supabase (fire-and-forget — never blocks UI)
      imageHistoryService.logImageJob({
        tool: activeTool.id,
        prompt: activeTool.requiresPrompt ? prompt.trim() : '',
        outputUrl: resultUrl,
        status: 'complete',
      });
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message);
      addToast('error', err.message || 'Failed to process image');
      imageHistoryService.logImageJob({
        tool: activeTool.id,
        prompt: activeTool.requiresPrompt ? prompt.trim() : '',
        outputUrl: null,
        status: 'error',
      });
    }
  };

  const downloadImage = async () => {
    if (!processedUrl) return;
    try {
      const response = await fetch(processedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chatadk-${activeToolId}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast('success', 'Download started');
    } catch (e) {
      addToast('error', 'Download failed');
    }
  };

  const muted = isDark ? 'text-neutral-500' : 'text-neutral-400';
  const fg = isDark ? 'text-neutral-100' : 'text-neutral-900';
  const card = isDark ? 'bg-white/[0.02] border-white/[0.07]' : 'bg-neutral-50 border-black/[0.07]';

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isDark ? 'bg-[#212121] text-neutral-100' : 'bg-white text-neutral-900'}`}>
      {/* Slim header — matches chat */}
      <header className={`flex items-center gap-1 h-14 px-3 sm:px-4 shrink-0 border-b ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}>
        {onClose && (
          <button
            onClick={onClose}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-400 hover:bg-white/[0.06] hover:text-white' : 'text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-900'}`}
            title="Back to chat"
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
        )}
        <h1 className="text-[14px] font-semibold tracking-tight px-1">Photo studio</h1>
        <span className="flex-1" />
        {previewUrl && (
          <button
            onClick={clearImage}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors ${isDark ? 'text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200' : 'text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-800'}`}
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-400 hover:bg-white/[0.06] hover:text-white' : 'text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-900'}`}
            title="Close"
          >
            <X size={17} />
          </button>
        )}
      </header>

      {/* All-in-one tool bar */}
      <div className={`shrink-0 border-b ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-3 sm:px-4 py-2.5 max-w-5xl mx-auto">
          {TOOLS.map(tool => {
            const Icon = tool.icon;
            const active = activeToolId === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveToolId(tool.id)}
                title={tool.description}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-all shrink-0 border ${active
                  ? (isDark ? 'bg-white text-black border-white' : 'bg-neutral-900 text-white border-neutral-900')
                  : (isDark ? 'border-white/10 text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200' : 'border-black/10 text-neutral-600 hover:bg-black/[0.04]')}`}
              >
                <Icon size={14} strokeWidth={1.8} />
                {tool.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body — single unified layout */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 grid gap-3 lg:grid-cols-[1fr_300px] items-start">
          {/* Preview card */}
          <div
            className={`rounded-2xl border overflow-hidden min-h-[320px] sm:min-h-[440px] flex flex-col ${card}`}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {!previewUrl ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center transition-opacity hover:opacity-80"
              >
                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.05]'}`}>
                  <Upload size={20} strokeWidth={1.8} className={muted} />
                </span>
                <span>
                  <span className={`block text-[14px] font-medium ${fg}`}>Drop an image or click to upload</span>
                  <span className={`block text-[12px] mt-1 ${muted}`}>JPG or PNG, up to 8MB</span>
                </span>
              </button>
            ) : (
              <>
                <div className="flex-1 relative flex items-center justify-center p-3 sm:p-5 bg-checker">
                  <div
                    ref={sliderRef}
                    className="relative rounded-xl overflow-hidden select-none max-w-full"
                    onMouseDown={onMouseDown}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    style={{ cursor: hasResult ? 'ew-resize' : 'default', touchAction: hasResult ? 'none' : 'auto' }}
                  >
                    <img
                      src={processedUrl || previewUrl}
                      alt="Result"
                      className="max-h-[52vh] lg:max-h-[62vh] max-w-full object-contain block"
                      draggable={false}
                    />
                    {hasResult && (
                      <>
                        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                          <img src={previewUrl} alt="Original" className="max-h-[52vh] lg:max-h-[62vh] max-w-full object-contain block" draggable={false} />
                        </div>
                        <div className="absolute top-0 bottom-0 w-px bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" style={{ left: `${sliderPos}%` }}>
                          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                            <MoveHorizontal size={14} className="text-black" />
                          </div>
                        </div>
                        <span className="absolute top-2.5 left-2.5 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/60 text-white backdrop-blur">Before</span>
                        <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold px-2 py-1 rounded-full bg-black text-white">After</span>
                      </>
                    )}
                    {isProcessing && (
                      <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-sm ${isDark ? 'bg-black/60' : 'bg-white/70'}`}>
                        <Loader2 size={26} className="animate-spin opacity-70" />
                        <p className="text-[13px] font-medium">Enhancing…</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2.5 border-t text-[11.5px] ${isDark ? 'border-white/[0.06] text-neutral-500' : 'border-black/[0.06] text-neutral-400'}`}>
                  <ImageIcon size={13} />
                  <span className="truncate flex-1">{selectedFile?.name}</span>
                  {selectedFile && <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>}
                  {hasResult && (
                    <span className={`flex items-center gap-1 font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      <Check size={12} /> Done
                    </span>
                  )}
                </div>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />
          </div>

          {/* Controls card — same on mobile & desktop */}
          <div className={`rounded-2xl border p-4 space-y-4 lg:sticky lg:top-0 ${card}`}>
            <div>
              <p className={`text-[12px] font-medium mb-1 ${muted}`}>Tool</p>
              <p className={`text-[14px] font-medium ${fg}`}>{activeTool.label}</p>
              <p className={`text-[12px] ${muted}`}>{activeTool.description}</p>
            </div>

            {activeTool.requiresPrompt && (
              <div>
                <label className={`block text-[12px] font-medium mb-1.5 ${muted}`}>{activeTool.promptLabel}</label>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={activeTool.promptPlaceholder}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] outline-none transition-colors ${isDark ? 'bg-[#212121] border-white/10 text-neutral-100 placeholder:text-neutral-600 focus:border-white/25' : 'bg-white border-black/10 text-neutral-900 placeholder:text-neutral-400 focus:border-black/25'}`}
                />
              </div>
            )}

            {activeTool.needsMask && (
              <div>
                <label className={`block text-[12px] font-medium mb-1.5 ${muted}`}>Mask image (optional)</label>
                <button
                  type="button"
                  onClick={() => maskInputRef.current?.click()}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-left truncate transition-colors ${isDark ? 'bg-[#212121] border-white/10 text-neutral-300 hover:border-white/25' : 'bg-white border-black/10 text-neutral-700 hover:border-black/25'}`}
                >
                  {maskFile ? maskFile.name : 'White area = replaced. Skip for auto mode.'}
                </button>
                <input
                  ref={maskInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setMaskFile(e.target.files?.[0] || null)}
                />
              </div>
            )}

            {errorMsg && (
              <p className="text-[12.5px] text-red-500 leading-snug">{errorMsg}</p>
            )}

            <div className="space-y-2">
              <button
                onClick={runTool}
                disabled={!previewUrl || isProcessing}
                className="w-full py-2.5 rounded-full text-[13.5px] font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {isProcessing ? 'Processing…' : previewUrl ? `Apply ${activeTool.label}` : 'Upload an image first'}
              </button>
              {hasResult && (
                <button
                  onClick={downloadImage}
                  className={`w-full py-2.5 rounded-full text-[13.5px] font-medium flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${isDark ? 'border-white/15 text-neutral-200 hover:bg-white/[0.06]' : 'border-black/15 text-neutral-700 hover:bg-black/[0.04]'}`}
                >
                  <Download size={15} />
                  Download result
                </button>
              )}
              {!previewUrl && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full py-2.5 rounded-full text-[13.5px] font-medium border transition-all active:scale-[0.98] ${isDark ? 'border-white/15 text-neutral-200 hover:bg-white/[0.06]' : 'border-black/15 text-neutral-700 hover:bg-black/[0.04]'}`}
                >
                  Choose image
                </button>
              )}
            </div>
            <p className={`text-[11px] leading-relaxed ${muted}`}>Drag & drop anywhere on the preview to swap images. Drag the slider to compare before / after.</p>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} isDark={isDark} />
    </div>
  );
}
