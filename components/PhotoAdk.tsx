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
  ArrowLeft
} from 'lucide-react';

// --- Types ---
type ToolId = 'removebg' | 'genaiBackground' | 'upscaleUltra' | 'faceRetouch' | 'genaiReplace' | 'smartCrop';
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
}

// --- Constants ---
const TOOLS: ToolConfig[] = [
  {
    id: 'removebg',
    label: 'Background Remover',
    endpoint: '/removebg',
    description: 'Instantly remove backgrounds with AI precision.',
    icon: Scissors,
    requiresPrompt: false,
  },
  {
    id: 'genaiBackground',
    label: 'AI Background Gen',
    endpoint: '/genai/background',
    description: 'Generate stunning new backgrounds from text prompts.',
    icon: Sparkles,
    requiresPrompt: true,
    promptLabel: 'Background Prompt',
    promptPlaceholder: 'e.g., "Cyberpunk city at night"',
  },
  {
    id: 'upscaleUltra',
    label: 'Ultra Upscale',
    endpoint: '/upscale/ultra',
    description: 'Enhance resolution by 2x without losing quality.',
    icon: Wand2,
    requiresPrompt: false,
  },
  {
    id: 'faceRetouch',
    label: 'Face Retouch',
    endpoint: '/enhance/face',
    description: 'Automatic skin smoothing and facial enhancement.',
    icon: ScanFace,
    requiresPrompt: false,
  },
  {
    id: 'genaiReplace',
    label: 'Smart Replace',
    endpoint: '/genai/replace',
    description: 'Select an object and replace it with AI generation.',
    icon: Replace,
    requiresPrompt: true, // Simplified for this UI version
    promptLabel: 'Replacement Description',
    promptPlaceholder: 'e.g., "Golden retriever puppy"',
  },
  {
    id: 'smartCrop',
    label: 'Smart Crop',
    endpoint: '/smartcrop',
    description: 'AI-powered cropping focused on the subject.',
    icon: Crop,
    requiresPrompt: false,
  },
];

const BASE_URL = 'https://api.picsart.io/tools/1.0';

// --- Helper Components ---

const ToastContainer = ({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) => (
  <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in ${
          toast.type === 'error' ? 'border-red-500/30 bg-red-950/90 text-red-200' :
          toast.type === 'success' ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200' :
          'border-blue-500/30 bg-slate-900/90 text-slate-200'
        }`}
      >
        {toast.type === 'error' ? <AlertCircle size={18} /> : 
         toast.type === 'success' ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
        <span className="text-sm font-medium">{toast.message}</span>
        <button onClick={() => onDismiss(toast.id)} className="ml-2 opacity-70 hover:opacity-100">
          <X size={14} />
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
  const [activeToolId, setActiveToolId] = useState<ToolId>('removebg');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const sliderRef = useRef<HTMLDivElement>(null);

  // Derived State
  const activeTool = useMemo(() => TOOLS.find(t => t.id === activeToolId) || TOOLS[0], [activeToolId]);
  const isProcessing = status === 'processing' || status === 'uploading';

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
    
    // Reset state
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);
    
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setProcessedUrl(null);
    setStatus('idle');
    setErrorMsg(null);
    setSliderPos(50);
    addToast('success', 'Image uploaded successfully');
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
  };

  // Slider Logic
  const handleSliderMove = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPos(percent);
  };

  const onMouseDown = () => {
    if (!processedUrl) return;
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

    // Mock API Key Check
    const apiKey = import.meta.env.VITE_PICSART_API_KEY || 'YOUR_API_KEY_HERE';
    if (apiKey === 'YOUR_API_KEY_HERE') {
      addToast('error', 'API Key missing. Add VITE_PICSART_API_KEY to .env');
      setStatus('error');
      return;
    }

    // Validation
    if (activeTool.requiresPrompt && !prompt.trim()) {
      addToast('error', `A prompt is required for ${activeTool.label}`);
      return;
    }

    setStatus('processing');
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      
      // Append specific params based on tool
      if (activeTool.id === 'removebg') formData.append('output_type', 'cutout');
      if (activeTool.id === 'upscaleUltra') formData.append('upscale_factor', '2');
      if (activeTool.requiresPrompt) formData.append('prompt', prompt);

      // Simulate Network Delay for Demo purposes if no real key
      if (apiKey === 'YOUR_API_KEY_HERE' || !apiKey) await new Promise(r => setTimeout(r, 1500));

      const response = await fetch(`${BASE_URL}${activeTool.endpoint}`, {
        method: 'POST',
        headers: { 'X-Picsart-API-Key': apiKey },
        body: formData,
      });

      // Check response status before parsing JSON
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
      a.download = `photoadk-${activeToolId}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast('success', 'Download started');
    } catch (e) {
      addToast('error', 'Download failed');
    }
  };

  return (
    <div className="h-full bg-[#0f172a]/95 backdrop-blur-xl text-slate-200 font-sans selection:bg-indigo-500/30 border border-white/5 shadow-2xl overflow-y-auto custom-scrollbar">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-[1600px] mx-auto p-4 lg:p-8 h-screen flex flex-col lg:flex-row gap-6">
        
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-6 overflow-y-auto pr-2">
          
          {/* Header */}
          <div className="space-y-1">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded-lg text-xs font-bold transition-all border border-blue-500/20 mb-2"
              >
                <ArrowLeft size={16} />
                Back to ChatAdk
              </button>
            )}
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">
              PhotoAdk Studio
            </h1>
            <p className="text-sm text-slate-500">Professional AI Photo Editing</p>
          </div>

          {/* Upload Area */}
          {!previewUrl ? (
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative group border-2 border-dashed rounded-2xl p-8 transition-all duration-300 flex flex-col items-center justify-center text-center gap-4 min-h-[200px] ${
                isDragging 
                  ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-800/50'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="text-slate-400" size={32} />
              </div>
              <div>
                <p className="text-slate-300 font-medium">Click to upload or drag and drop</p>
                <p className="text-slate-500 text-xs mt-1">SVG, PNG, JPG or GIF (max. 8000x8000px)</p>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                onChange={onFileSelect} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
                <img src={previewUrl} alt="Thumb" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{selectedFile?.name}</p>
                <p className="text-xs text-slate-500">{(selectedFile!.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button 
                onClick={clearImage}
                className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors text-slate-500"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}

          {/* Tool Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Tool</label>
            <div className="grid grid-cols-1 gap-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeToolId === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setActiveToolId(tool.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 group ${
                      isActive 
                        ? 'bg-indigo-600/10 border-indigo-500/50 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]' 
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-600 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isActive ? 'text-indigo-200' : 'text-slate-300'}`}>
                        {tool.label}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{tool.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Inputs */}
          {activeTool.requiresPrompt && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {activeTool.promptLabel}
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activeTool.promptPlaceholder}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          )}

          {/* Action Button */}
          <div className="mt-auto pt-4 space-y-3">
            <button
              onClick={runTool}
              disabled={!previewUrl || isProcessing}
              className="w-full relative group overflow-hidden rounded-xl bg-indigo-600 p-px disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-indigo-600 group-hover:bg-transparent transition-colors rounded-[10px] px-4 py-3 flex items-center justify-center gap-2">
                {isProcessing ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Wand2 size={20} />
                )}
                <span className="font-semibold">
                  {isProcessing ? 'Processing...' : `Run ${activeTool.label}`}
                </span>
              </div>
            </button>

            {processedUrl && (
              <button
                onClick={downloadImage}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Result
              </button>
            )}
          </div>
        </aside>

        {/* Main Preview Area */}
        <main className="flex-1 bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden flex flex-col relative">
          
          {/* Toolbar */}
          <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <ImageIcon size={18} />
              <span className="text-sm font-medium">Preview</span>
            </div>
            {processedUrl && (
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                <CheckCircle2 size={14} />
                Processing Complete
              </div>
            )}
          </div>

          {/* Canvas Area */}
          <div className="flex-1 relative flex items-center justify-center p-6 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-100">
            
            {!previewUrl ? (
              <div className="text-center space-y-4 opacity-50">
                <div className="w-24 h-24 rounded-full bg-slate-800 mx-auto flex items-center justify-center">
                  <ImageIcon size={48} className="text-slate-600" />
                </div>
                <p className="text-slate-500">Upload an image to start editing</p>
              </div>
            ) : (
              <div 
                ref={sliderRef}
                className="relative max-w-full max-h-full shadow-2xl rounded-lg overflow-hidden select-none group"
                onMouseDown={onMouseDown}
                style={{ cursor: processedUrl ? 'ew-resize' : 'default' }}
              >
                {/* After Image (Background) */}
                <img 
                  src={processedUrl || previewUrl} 
                  alt="Result" 
                  className="max-h-[80vh] max-w-full object-contain block"
                  draggable={false}
                />

                {/* Before Image (Foreground with Clip) */}
                {processedUrl && (
                  <>
                    <div 
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    >
                      <img 
                        src={previewUrl} 
                        alt="Original" 
                        className="max-h-[80vh] max-w-full object-contain block"
                        draggable={false}
                      />
                    </div>

                    {/* Slider Handle */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                        <MoveHorizontal size={16} className="text-slate-900" />
                      </div>
                    </div>

                    {/* Labels */}
                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur text-white text-xs px-2 py-1 rounded pointer-events-none">
                      Original
                    </div>
                    <div className="absolute top-4 right-4 bg-indigo-600/80 backdrop-blur text-white text-xs px-2 py-1 rounded pointer-events-none">
                      AI Result
                    </div>
                  </>
                )}

                {/* Loading Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                    <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
                    <p className="text-slate-300 font-medium animate-pulse">Applying Magic...</p>
                    <p className="text-slate-500 text-xs mt-2">Contacting Picsart API</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}