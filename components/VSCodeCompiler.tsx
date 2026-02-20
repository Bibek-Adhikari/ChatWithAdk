import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, 
  Trash2, 
  Download, 
  FileCode, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Maximize2, 
  Minimize2,
  Terminal,
  LayoutTemplate,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for cleaner tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Tab = 'html' | 'css' | 'js';
type Device = 'desktop' | 'tablet' | 'mobile';
type LogType = 'log' | 'error' | 'warn' | 'info';

interface Log {
  id: string;
  type: LogType;
  message: string;
  timestamp: string;
}

interface VSCodeCompilerProps {
  onClose?: () => void;
}

// --- Default Templates ---
const DEFAULT_HTML = `<div class="container">
  <div class="card">
    <h1>Hello VS Code Editor!</h1>
    <p>Try using <kbd>Ctrl/Cmd + Space</kbd> for IntelliSense.</p>
    <button id="btn">Click Me</button>
    <div id="output"></div>
  </div>
</div>`;

const DEFAULT_CSS = `body {
  font-family: 'Inter', sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  margin: 0;
}

.card {
  background: #1e293b;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 400px;
  border: 1px solid #334155;
}

h1 { color: #38bdf8; margin-bottom: 0.5rem; }
button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  margin-top: 1rem;
  transition: background 0.2s;
}
button:hover { background: #2563eb; }
#output { margin-top: 1rem; color: #4ade80; font-weight: bold; }`;

const DEFAULT_JS = `const btn = document.getElementById('btn');
const output = document.getElementById('output');

btn.addEventListener('click', () => {
  output.textContent = 'React + Monaco Editor is powerful! 🚀';
  console.log('Button interaction logged at:', new Date().toLocaleTimeString());
});

console.info('System initialized.');`;

export default function VSCodeCompiler({ onClose }: VSCodeCompilerProps) {
  // --- State ---
  const [activeTab, setActiveTab] = useState<Tab>('html');
  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML);
  const [cssCode, setCssCode] = useState(DEFAULT_CSS);
  const [jsCode, setJsCode] = useState(DEFAULT_JS);
  const [srcDoc, setSrcDoc] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [device, setDevice] = useState<Device>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // Percentage for editor width
  const [isDragging, setIsDragging] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Initial Run
  useEffect(() => {
    runCode();
  }, []);

  // Handle Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Constrain between 20% and 80%
      if (newWidth > 20 && newWidth < 80) {
        setSplitRatio(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Listen for messages from iframe (console logs)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'console') {
        addLog(event.data.method, event.data.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- Actions ---

  const runCode = useCallback(() => {
    const doc = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${cssCode}</style>
        </head>
        <body>
          ${htmlCode}
          <script>
            (function() {
              const originalConsole = {
                log: console.log,
                error: console.error,
                warn: console.warn,
                info: console.info
              };

              function sendToParent(type, args) {
                try {
                  const message = Array.from(args).map(arg => {
                    if (typeof arg === 'object') {
                      try { return JSON.stringify(arg); } catch(e) { return String(arg); }
                    }
                    return String(arg);
                  }).join(' ');
                  window.parent.postMessage({ type: 'console', method: type, message }, '*');
                } catch(e) {}
              }

              console.log = function(...args) { originalConsole.log(...args); sendToParent('log', args); };
              console.error = function(...args) { originalConsole.error(...args); sendToParent('error', args); };
              console.warn = function(...args) { originalConsole.warn(...args); sendToParent('warn', args); };
              console.info = function(...args) { originalConsole.info(...args); sendToParent('info', args); };

              window.onerror = function(msg, url, line) {
                sendToParent('error', [msg + ' (Line: ' + line + ')']);
              };

              try {
                ${jsCode}
              } catch (err) {
                console.error(err);
              }
            })();
          </script>
        </body>
      </html>
    `;
    setSrcDoc(doc);
    addLog('info', 'Code execution started...');
  }, [htmlCode, cssCode, jsCode]);

  const addLog = (type: LogType, message: string) => {
    const newLog: Log = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [...prev, newLog]);
  };

  const clearConsole = () => setLogs([]);

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all editors?')) {
      setHtmlCode('');
      setCssCode('');
      setJsCode('');
      setSrcDoc('');
      clearConsole();
    }
  };

  const downloadCode = () => {
    const fileContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
${cssCode}
</style>
</head>
<body>
${htmlCode}
<script>
${jsCode}
</script>
</body>
</html>`;
    
    const blob = new Blob([fileContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
    addLog('info', 'File downloaded successfully.');
  };

  const loadTemplate = () => {
    setHtmlCode(DEFAULT_HTML);
    setCssCode(DEFAULT_CSS);
    setJsCode(DEFAULT_JS);
    // Small timeout to allow state update before running
    setTimeout(runCode, 100);
  };

  // --- Render Helpers ---

  const getEditorValue = () => {
    switch (activeTab) {
      case 'html': return htmlCode;
      case 'css': return cssCode;
      case 'js': return jsCode;
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    switch (activeTab) {
      case 'html': setHtmlCode(value); break;
      case 'css': setCssCode(value); break;
      case 'js': setJsCode(value); break;
    }
  };

  const getLanguage = () => {
    switch (activeTab) {
      case 'html': return 'html';
      case 'css': return 'css';
      case 'js': return 'javascript';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-300 font-sans overflow-hidden">
      
      {/* --- Header --- */}
      <header className="h-14 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <FileCode size={20} className="text-white" />
          </div>
          <h1 className="font-bold text-white tracking-tight">VS Code Compiler</h1>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadTemplate} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[#3c3c3c] rounded transition-colors">
            <LayoutTemplate size={16} /> Template
          </button>
          <button onClick={clearAll} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[#3c3c3c] rounded transition-colors text-red-400">
            <Trash2 size={16} /> Clear
          </button>
          <button onClick={downloadCode} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[#3c3c3c] rounded transition-colors text-blue-400">
            <Download size={16} /> Download
          </button>
          <button 
            onClick={runCode} 
            className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded transition-all shadow-lg shadow-green-900/20 active:scale-95"
          >
            <Play size={16} fill="currentColor" /> Run
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-[#3c3c3c] rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Close Compiler"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>

      {/* --- Main Workspace --- */}
      <div className="flex flex-1 overflow-hidden relative" ref={containerRef}>
        
        {/* Editor Section */}
        {!isFullscreen && (
          <div 
            className="flex flex-col bg-[#1e1e1e] border-r border-[#333] relative"
            style={{ width: `${splitRatio}%` }}
          >
            {/* Tabs */}
            <div className="flex bg-[#252526]">
              {(['html', 'css', 'js'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-xs uppercase font-medium border-t-2 transition-colors flex items-center gap-2",
                    activeTab === tab 
                      ? "bg-[#1e1e1e] text-white border-blue-500"
                      : "bg-[#2d2d2d] text-gray-500 border-transparent hover:bg-[#2a2d2e] hover:text-gray-300"
                  )}
                >
                  {tab === 'html' && <span className="text-orange-500">&lt;/&gt;</span>}
                  {tab === 'css' && <span className="text-blue-400">#</span>}
                  {tab === 'js' && <span className="text-yellow-400">JS</span>}
                  {tab}
                </button>
              ))}
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 relative overflow-hidden">
              <Editor
                height="100%"
                language={getLanguage()}
                value={getEditorValue()}
                onChange={handleEditorChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 16 },
                  renderLineHighlight: 'all',
                }}
              />
            </div>
          </div>
        )}

        {/* Resize Handle */}
        {!isFullscreen && (
          <div 
            className="w-1 bg-[#333] hover:bg-blue-500 cursor-col-resize z-10 transition-colors"
            onMouseDown={() => setIsDragging(true)}
          />
        )}

        {/* Preview Section */}
        <div 
          className="flex flex-col bg-white h-full transition-all duration-300"
          style={{ width: isFullscreen ? '100%' : `${100 - splitRatio}%` }}
        >
          {/* Preview Toolbar */}
          <div className="h-10 bg-[#f3f4f6] border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-xs font-bold uppercase tracking-wider">Preview</span>
            </div>
            
            <div className="flex items-center gap-1 bg-gray-200 p-1 rounded-lg">
              <button 
                onClick={() => setDevice('desktop')} 
                className={cn("p-1.5 rounded transition-all", device === 'desktop' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700")}
                title="Desktop View"
              >
                <Monitor size={16} />
              </button>
              <button 
                onClick={() => setDevice('tablet')} 
                className={cn("p-1.5 rounded transition-all", device === 'tablet' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700")}
                title="Tablet View"
              >
                <Tablet size={16} />
              </button>
              <button 
                onClick={() => setDevice('mobile')} 
                className={cn("p-1.5 rounded transition-all", device === 'mobile' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700")}
                title="Mobile View"
              >
                <Smartphone size={16} />
              </button>
            </div>

            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-gray-500 hover:text-gray-800 transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>

          {/* Iframe Container */}
          <div className="flex-1 bg-gray-100 flex justify-center overflow-auto p-4">
            <div 
              className={cn(
                "bg-white shadow-2xl transition-all duration-500 ease-in-out h-full",
                device === 'mobile' ? 'w-[375px]' : device === 'tablet' ? 'w-[768px]' : 'w-full'
              )}
            >
              <iframe
                ref={iframeRef}
                title="preview"
                srcDoc={srcDoc}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-modals"
              />
            </div>
          </div>

          {/* Console Panel */}
          {!isFullscreen && (
            <div className="h-48 bg-[#1e1e1e] border-t border-[#333] flex flex-col shrink-0">
              <div className="h-8 bg-[#252526] flex items-center justify-between px-4 border-b border-[#333]">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase">
                  <Terminal size={12} /> Console
                </div>
                <button 
                  onClick={clearConsole}
                  className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider"
                >
                  Clear Console
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1">
                {logs.length === 0 && (
                  <div className="text-gray-600 italic p-2">Console is empty. Run code to see logs.</div>
                )}
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-2 border-b border-[#333]/50 pb-1 last:border-0">
                    <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                    <span className={cn(
                      "break-all",
                      log.type === 'error' ? "text-red-400" : 
                      log.type === 'warn' ? "text-yellow-400" : 
                      log.type === 'info' ? "text-blue-400" : "text-gray-300"
                    )}>
                      {log.type === 'error' && '❌ '}
                      {log.type === 'warn' && '⚠️ '}
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}