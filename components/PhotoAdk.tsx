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
  ChevronUp,
  Settings2,
  Menu
} from 'lucide-react';

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
  shortLabel: string;
  endpoint: string;
  description: string;
  icon: React.ElementType;
  requiresPrompt: boolean;
  promptLabel?: string;
  promptPlaceholder?: string;
}

// --- Constants ---
const TOOLS: ToolConfig[] = [
  {
    id: 'adktool',
    label: 'Background Remover',
    shortLabel: 'Remove BG',
    endpoint: '/removebg',
    description: 'Remove backgrounds instantly',
    icon: Scissors,
    requiresPrompt: false,
  },
  {
    id: 'genaiBackground',
    label: 'AI Background',
    shortLabel: 'AI BG',
    endpoint: '/genai/background',
    description: 'Generate new backgrounds',
    icon: Sparkles,
    requiresPrompt: true,
    promptLabel: 'Background Prompt',
    promptPlaceholder: 'e.g., "Cyberpunk city at night"',
  },
  {
    id: 'upscaleUltra',
    label: 'Ultra Upscale',
    shortLabel: 'Upscale',
    endpoint: '/upscale/ultra',
    description: '2x resolution boost',
    icon: Wand2,
    requiresPrompt: false,
  },
  {
    id: 'faceRetouch',
    label: 'Face Retouch',
    shortLabel: 'Retouch',
    endpoint: '/enhance/face',
    description: 'Smooth skin & enhance',
    icon: ScanFace,
    requiresPrompt: false,
  },
  {
    id: 'genaiReplace',
    label: 'Smart Replace',
    shortLabel: 'Replace',
    endpoint: '/genai/replace',
    description: 'Replace objects with AI',
    icon: Replace,
    requiresPrompt: true,
    promptLabel: 'Replace with',
    promptPlaceholder: 'e.g., "Golden retriever"',
  },
  {
    id: 'smartCrop',
    label: 'Smart Crop',
    shortLabel: 'Crop',
    endpoint: '/smartcrop',
    description: 'AI-focused cropping',
    icon: Crop,
    requiresPrompt: false,
  },
];

const BASE_URL = 'https://api.picsart.io/tools/1.0';

// --- Helper Components ---

const ToastContainer = ({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) => (
  <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none sm:bottom-6 sm:right-6 sm:left-auto sm:top-auto">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-2 fade-in ${
          toast.type === 'error' ? 'border-red-500/30 bg-red-950/95 text-red-200' :
          toast.type === 'success' ? 'border-emerald-500/30 bg-emerald-950/95 text-emerald-200' :
          'border-blue-500/30 bg-slate-900/95 text-slate-200'
        }`}
      >
        {toast.type === 'error' ? <AlertCircle size={18} /> : 
         toast.type === 'success' ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
        <span className="text-sm font-medium flex-1">{toast.message}</span>
        <button onClick={() => onDismiss(toast.id)} className="opacity-70 hover:opacity-100 p-1">
          <X size={16} />
        </button>
      </div>
    ))}
  </div>
);

interface PhotoAdkProps {
  onClose?: () => void;
}

// --- Main Component ---

export default function PhotoEditorPro({ onClose }: PhotoAdkProps) {
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [activeToolId, setActiveToolId] = useState<ToolId>('adktool');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);

  const sliderRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

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
    addToast('success', 'Image uploaded');
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setProcessedUrl(null);
    setStatus('idle');
    setShowToolsSheet(false);
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
    e.preventDefault();
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

  // API Logic
  const runTool = async () => {
    if (!selectedFile) return;

    const apiKey = import.meta.env.VITE_PICSART_API_KEY || 'YOUR_API_KEY_HERE';
    if (apiKey === 'YOUR_API_KEY_HERE') {
      addToast('error', 'API Key missing. Add VITE_PICSART_API_KEY to .env');
      setStatus('error');
      return;
    }

    if (activeTool.requiresPrompt && !prompt.trim()) {
      addToast('error', `A prompt is required`);
      return;
    }

    setStatus('processing');
    setErrorMsg(null);
    setShowToolsSheet(false);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      
      if (activeTool.id === 'adktool') formData.append('output_type', 'cutout');
      if (activeTool.id === 'upscaleUltra') formData.append('upscale_factor', '2');
      if (activeTool.requiresPrompt) formData.append('prompt', prompt);

      if (apiKey === 'YOUR_API_KEY_HERE' || !apiKey) await new Promise(r => setTimeout(r, 1500));

      const response = await fetch(`${BASE_URL}${activeTool.endpoint}`, {
        method: 'POST',
        headers: { 'X-Picsart-API-Key': apiKey },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      const resultUrl = data?.data?.url || data?.data?.image_url || data?.url;
      if (!resultUrl) throw new Error('No image returned from API');

      setProcessedUrl(resultUrl);
      setStatus('complete');
      addToast('success', 'Processing complete!');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message);
      addToast('error', err.message || 'Failed to process image');
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

  const selectTool = (toolId: ToolId) => {
    setActiveToolId(toolId);
    setShowToolsSheet(false);
    const tool = TOOLS.find(t => t.id === toolId);
    if (tool?.requiresPrompt) {
      setShowPromptInput(true);
    } else {
      setShowPromptInput(false);
    }
  };

  return (
    <div className="h-screen bg-[#0a0f1c] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[50vh] bg-indigo-900/10 rounded-full blur-[100px]" />
      </div>

      {/* Mobile Header */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sm:hidden">
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-white">
              <ArrowLeft size={20} />
            </button>
          )}
          <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            PhotoAdk
          </span>
        </div>
        {previewUrl && (
          <button onClick={clearImage} className="p-2 text-slate-400 hover:text-red-400">
            <Trash2 size={18} />
          </button>
        )}
      </header>

      {/* Desktop Header */}
      <header className="hidden sm:flex items-center justify-between px-6 py-4 bg-slate-900/50 backdrop-blur-xl border-b border-slate-800">
        <div className="flex items-center gap-4">
          {onClose && (
            <button 
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded-lg text-xs font-bold transition-all border border-blue-500/20"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          )}
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            PhotoAdk Studio
          </h1>
        </div>
        {previewUrl && (
          <button onClick={clearImage} className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 size={16} />
            <span className="text-sm">Clear</span>
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col sm:flex-row">
        
        {/* Image Preview Area - Takes full width on mobile, left side on desktop */}
        <div className="flex-1 relative bg-slate-950 flex flex-col min-h-0">
          
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 backdrop-blur border-b border-slate-800 sm:px-6">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <ImageIcon size={16} />
              <span className="hidden sm:inline">Preview</span>
            </div>
            {hasResult && (
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                <CheckCircle2 size={12} />
                <span>Done</span>
              </div>
            )}
          </div>

          {/* Canvas */}
          <div 
            className="flex-1 relative flex items-center justify-center p-4 overflow-hidden touch-pan-y"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {!previewUrl ? (
              /* Upload State */
              <div className="w-full max-w-md mx-auto">
                <label 
                  className={`relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-dashed transition-all duration-300 ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                    <Upload className="text-slate-400" size={28} />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-300 font-medium text-sm">Tap to upload or drag & drop</p>
                    <p className="text-slate-500 text-xs mt-1">JPG, PNG up to 8MB</p>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={onFileSelect} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                </label>
              </div>
            ) : (
              /* Image Preview with Slider */
              <div 
                ref={sliderRef}
                className="relative max-w-full max-h-full rounded-lg overflow-hidden shadow-2xl select-none touch-none"
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ cursor: hasResult ? 'ew-resize' : 'default' }}
              >
                {/* After Image */}
                <img 
                  src={processedUrl || previewUrl} 
                  alt="Result" 
                  className="max-h-[60vh] sm:max-h-[70vh] max-w-full object-contain block"
                  draggable={false}
                />

                {/* Before Image with Clip */}
                {hasResult && (
                  <>
                    <div 
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    >
                      <img 
                        src={previewUrl} 
                        alt="Original" 
                        className="max-h-[60vh] sm:max-h-[70vh] max-w-full object-contain block"
                        draggable={false}
                      />
                    </div>

                    {/* Slider Handle */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20"
                      style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-slate-900">
                        <MoveHorizontal size={18} className="text-slate-900" />
                      </div>
                    </div>

                    {/* Labels */}
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-full">
                      BEFORE
                    </div>
                    <div className="absolute top-3 right-3 bg-indigo-600/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-full">
                      AFTER
                    </div>
                  </>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center z-30">
                    <div className="w-16 h-16 rounded-full bg-indigo-600/20 flex items-center justify-center mb-4">
                      <Loader2 className="animate-spin text-indigo-500" size={32} />
                    </div>
                    <p className="text-slate-200 font-semibold">Cooking...</p>
                    <p className="text-slate-500 text-xs mt-1">PhotoAdk is working</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile: Image Info Bar */}
          {previewUrl && selectedFile && (
            <div className="sm:hidden px-4 py-2 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="truncate max-w-[150px]">{selectedFile.name}</span>
              <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          )}
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden sm:flex w-80 flex-col gap-4 p-4 bg-slate-900/30 border-l border-slate-800 overflow-y-auto">
          
          {/* Tool Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tools</label>
            <div className="grid grid-cols-1 gap-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeToolId === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => selectTool(tool.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isActive 
                        ? 'bg-indigo-600/10 border-indigo-500/50 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]' 
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isActive ? 'text-indigo-200' : 'text-slate-300'}`}>
                        {tool.label}
                      </div>
                      <div className="text-[10px] text-slate-500">{tool.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt Input */}
          {activeTool.requiresPrompt && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {activeTool.promptLabel}
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTool.promptPlaceholder}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-auto space-y-2">
            <button
              onClick={runTool}
              disabled={!previewUrl || isProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
              {isProcessing ? 'Processing...' : activeTool.label}
            </button>

            {hasResult && (
              <button
                onClick={downloadImage}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-700"
              >
                <Download size={18} />
                Download
              </button>
            )}
          </div>
        </aside>
      </main>

      {/* Mobile Bottom Action Bar */}
      {previewUrl && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 safe-area-pb">
          
          {/* Prompt Input (Collapsible) */}
          {showPromptInput && activeTool.requiresPrompt && (
            <div className="px-4 py-3 border-b border-slate-800 animate-in slide-in-from-bottom-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTool.promptPlaceholder}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Main Actions */}
          <div className="flex items-center gap-2 p-3">
            <button
              onClick={() => setShowToolsSheet(true)}
              className="flex items-center gap-2 px-4 py-3 bg-slate-800 rounded-xl border border-slate-700 active:scale-95 transition-transform"
            >
              <Settings2 size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-200">{activeTool.shortLabel}</span>
              <ChevronUp size={16} className="text-slate-500" />
            </button>

            <button
              onClick={runTool}
              disabled={isProcessing}
              className="flex-1 bg-indigo-600 disabled:bg-indigo-600/50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
              <span>{isProcessing ? '...' : 'Run'}</span>
            </button>

            {hasResult && (
              <button
                onClick={downloadImage}
                className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-600/30 active:scale-95 transition-transform"
              >
                <Download size={20} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Tools Sheet */}
      {showToolsSheet && (
        <div 
          className="fixed inset-0 z-40 sm:hidden"
          onClick={() => setShowToolsSheet(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div 
            className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl border-t border-slate-800 max-h-[70vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-slate-200">Select Tool</h3>
              <button onClick={() => setShowToolsSheet(false)} className="p-2 text-slate-400">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-4 space-y-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeToolId === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => selectTool(tool.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                      isActive 
                        ? 'bg-indigo-600/10 border-indigo-500/50' 
                        : 'bg-slate-800/50 border-slate-800'
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold ${isActive ? 'text-indigo-200' : 'text-slate-200'}`}>
                        {tool.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{tool.description}</div>
                    </div>
                    {isActive && <CheckCircle2 size={20} className="text-indigo-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}