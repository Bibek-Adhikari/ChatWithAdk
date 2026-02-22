import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { emmetHTML, emmetCSS, emmetJSX } from 'emmet-monaco-es';
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
  X,
  ExternalLink,
  MessageSquare,
  ChevronDown,
  Layout,
  Eye,
  Palette,
  Sparkles, // Added for AI feature
  Loader2   // Added for loading state
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for cleaner tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Tab = 'html' | 'css' | 'js' | 'code';
type Language = 'web' | 'python' | 'php' | 'c' | 'cpp' | 'csharp' | 'rust' | 'kotlin' | 'java' | 'go' | 'ruby' | 'typescript';
type Device = 'desktop' | 'tablet' | 'mobile';
type Theme = 'vs-dark' | 'vs' | 'github-dark' | 'github-light' | 'monokai';
type LogType = 'log' | 'error' | 'warn' | 'info';

interface Log {
  id: string;
  type: LogType;
  message: string;
  timestamp: string;
}

const LANGUAGE_CONFIGS: Record<Exclude<Language, 'web'>, { label: string, monaco: string, compiler: string, template: string }> = {
  python: { label: 'Python', monaco: 'python', compiler: 'cpython-3.14.0', template: 'print("Hello from Python! 🐍")' },
  php: { label: 'PHP', monaco: 'php', compiler: 'php-8.3.12', template: '<?php\necho "Hello from PHP! 🐘";' },
  c: { label: 'C', monaco: 'c', compiler: 'gcc-13.2.0-c', template: '#include <stdio.h>\n\nint main() {\n    printf("Hello from C! 🛠️\\n");\n    return 0;\n}' },
  cpp: { label: 'C++', monaco: 'cpp', compiler: 'gcc-13.2.0', template: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++! 🚀" << std::endl;\n    return 0;\n}' },
  csharp: { label: 'C#', monaco: 'csharp', compiler: 'mono-6.12.0.199', template: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from C#! ✨");\n    }\n}' },
  rust: { label: 'Rust', monaco: 'rust', compiler: 'rust-1.82.0', template: 'fn main() {\n    println!("Hello from Rust! 🦀");\n}' },
  kotlin: { label: 'Kotlin', monaco: 'kotlin', compiler: 'kotlin', template: 'fun main() {\n    println("Hello from Kotlin! 💜")\n}' },
  java: { label: 'Java', monaco: 'java', compiler: 'openjdk-jdk-22+36', template: 'class Prog {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java! ☕");\n    }\n}' },
  go: { label: 'Go', monaco: 'go', compiler: 'go-1.23.2', template: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Go! 🐹")\n}' },
  ruby: { label: 'Ruby', monaco: 'ruby', compiler: 'ruby-3.4.1', template: 'puts "Hello from Ruby! 💎"' },
  typescript: { label: 'TypeScript', monaco: 'typescript', compiler: 'typescript-5.6.2', template: 'console.log("Hello from TypeScript! 📘");' }
};

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
  const [activeLanguage, setActiveLanguage] = useState<Language>('web');

  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML);
  const [cssCode, setCssCode] = useState(DEFAULT_CSS);
  const [jsCode, setJsCode] = useState(DEFAULT_JS);

  const [polyglotCode, setPolyglotCode] = useState<Record<string, string>>(() => {
    const codes: Record<string, string> = {};
    Object.entries(LANGUAGE_CONFIGS).forEach(([key, config]) => {
      codes[key] = config.template;
    });
    return codes;
  });

  const [srcDoc, setSrcDoc] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [device, setDevice] = useState<Device>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [isConsoleVisible, setIsConsoleVisible] = useState(true);
  const [isEditorVisible, setIsEditorVisible] = useState(true);
  const [activeOutputTab, setActiveOutputTab] = useState<'preview' | 'console'>('preview');
  const [activeTheme, setActiveTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('codeadk_theme');
    return (saved as Theme) || 'github-dark';
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // AI Explainer States
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  // Resize States
  const [isDragging, setIsDragging] = useState<'horizontal' | 'vertical' | 'mobile' | false>(false);
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('codeadk_split_ratio');
    return saved ? parseFloat(saved) : 50;
  });
  const [consoleHeight, setConsoleHeight] = useState(() => {
    const saved = localStorage.getItem('codeadk_console_height');
    return saved ? parseFloat(saved) : 200;
  });
  const [mobileOutputHeight, setMobileOutputHeight] = useState(() => {
    const saved = localStorage.getItem('codeadk_mobile_output_height');
    return saved ? parseFloat(saved) : 50;
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const retryCount = useRef(0);

  // Initialize BroadcastChannel
  useEffect(() => {
    bcRef.current = new BroadcastChannel('codeadk-preview');

    bcRef.current.onmessage = (event) => {
      if (event.data.type === 'ready' && srcDoc) {
        bcRef.current?.postMessage({ srcDoc });
      }
    };

    return () => {
      bcRef.current?.close();
    };
  }, [srcDoc]);

  useEffect(() => {
    if (srcDoc && bcRef.current) {
      bcRef.current.postMessage({ srcDoc });
    }
  }, [srcDoc]);

  // Initial Run
  useEffect(() => {
    runCode();
  }, []);

  // Auto-switch output tab based on language
  useEffect(() => {
    if (activeLanguage === 'web') {
      setActiveOutputTab('preview');
    } else {
      setActiveOutputTab('console');
    }
  }, [activeLanguage]);

  // Handle Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();

      if (isDragging === 'horizontal') {
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        if (newWidth > 15 && newWidth < 85) {
          setSplitRatio(newWidth);
          localStorage.setItem('codeadk_split_ratio', newWidth.toString());
        }
      } else if (isDragging === 'vertical') {
        const newHeight = containerRect.bottom - e.clientY;
        if (newHeight > 100 && newHeight < containerRect.height - 100) {
          setConsoleHeight(newHeight);
          localStorage.setItem('codeadk_console_height', newHeight.toString());
        }
      } else if (isDragging === 'mobile') {
        const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
        if (newHeight > 20 && newHeight < 80) {
          setMobileOutputHeight(newHeight);
          localStorage.setItem('codeadk_mobile_output_height', newHeight.toString());
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isDragging === 'horizontal' ? 'col-resize' : 'row-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'console') {
        addLog(event.data.method, event.data.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Force iframe reload when device changes
  useEffect(() => {
    if (activeLanguage === 'web' && srcDoc) {
      const timeoutId = setTimeout(() => {
        setSrcDoc(prev => prev);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [device]);

  // Handle iframe load failures
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      retryCount.current = 0;
    };

    const handleError = () => {
      if (retryCount.current < 3 && srcDoc) {
        retryCount.current++;
        setTimeout(() => {
          setSrcDoc(prev => prev);
        }, 1000 * retryCount.current);
      } else if (retryCount.current >= 3) {
        addLog('error', 'Failed to load preview after multiple attempts');
      }
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [srcDoc]);

  // --- Actions ---

  const runCode = useCallback(async () => {
    if (activeLanguage !== 'web') {
      setIsRunning(true);
      clearConsole();
      addLog('info', `🚀 Compiling and running ${activeLanguage} code...`);

      const config = LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>];
      const code = polyglotCode[activeLanguage];

      try {
        if (activeLanguage === 'kotlin') {
          const response = await fetch('https://api.kotlinlang.org/v1/compiler/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              args: "",
              files: [{ name: "Prog.kt", text: code, publicId: "" }],
              confType: "java"
            })
          });
          const result = await response.json();
          if (result.errors && Object.keys(result.errors).length > 0) {
            Object.values(result.errors).flat().forEach((err: any) => {
              addLog('error', `${err.message} (${err.interval.start.line}:${err.interval.start.ch})`);
            });
          }
          if (result.text) {
            const cleanOutput = result.text.replace(/<[^>]*>/g, '');
            addLog('log', cleanOutput);
          }
        } else {
          const response = await fetch('https://wandbox.org/api/compile.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              compiler: config.compiler,
              code: code,
              save: false
            })
          });

          if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
          }

          const result = await response.json();

          if (result.program_output) {
            addLog('log', result.program_output);
          }
          if (result.program_error) {
            addLog('error', result.program_error);
          }
          if (result.compiler_output) {
            addLog('info', result.compiler_output);
          }
          if (result.compiler_error) {
            addLog('error', result.compiler_error);
          }
          if (!result.program_output && !result.program_error && !result.compiler_error) {
            addLog('info', 'Program executed successfully with no output.');
          }
        }
      } catch (err: any) {
        addLog('error', `❌ Execution Error: ${err.message}`);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // Web logic
    const doc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                      try { 
                        return JSON.stringify(arg, null, 2); 
                      } catch(e) { 
                        return String(arg); 
                      }
                    }
                    return String(arg);
                  }).join(' ');
                  
                  window.parent.postMessage({ 
                    type: 'console', 
                    method: type, 
                    message: message,
                    timestamp: new Date().toISOString()
                  }, '*');
                } catch(e) {
                  originalConsole.error('Failed to send to parent:', e);
                }
              }

              console.log = function(...args) { 
                originalConsole.log(...args); 
                sendToParent('log', args); 
              };
              
              console.error = function(...args) { 
                originalConsole.error(...args); 
                sendToParent('error', args); 
              };
              
              console.warn = function(...args) { 
                originalConsole.warn(...args); 
                sendToParent('warn', args); 
              };
              
              console.info = function(...args) { 
                originalConsole.info(...args); 
                sendToParent('info', args); 
              };

              window.onerror = function(msg, url, line, col, error) {
                const errorMsg = msg + ' (Line: ' + line + ', Column: ' + col + ')';
                sendToParent('error', [errorMsg]);
                return false;
              };

              window.addEventListener('unhandledrejection', function(event) {
                sendToParent('error', ['Unhandled Promise Rejection: ' + event.reason]);
              });

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

    setSrcDoc('');
    requestAnimationFrame(() => {
      setSrcDoc(doc);
      addLog('info', 'Web preview updated.');
    });
  }, [htmlCode, cssCode, jsCode, activeLanguage, polyglotCode]);

  // --- Helper Functions ---
  const getEditorValue = () => {
    if (activeLanguage !== 'web') {
      return polyglotCode[activeLanguage];
    }
    switch (activeTab) {
      case 'html': return htmlCode;
      case 'css': return cssCode;
      case 'js': return jsCode;
      default: return '';
    }
  };

  const getLanguage = () => {
    if (activeLanguage !== 'web') {
      return LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>].monaco;
    }
    switch (activeTab) {
      case 'html': return 'html';
      case 'css': return 'css';
      case 'js': return 'javascript';
      default: return 'text';
    }
  };

  const addLog = useCallback((type: LogType, message: string) => {
    const lines = message.split('\n');
    const timestamp = new Date().toLocaleTimeString();

    setLogs(prev => [
      ...prev,
      ...lines.map(line => ({
        id: Math.random().toString(36).substr(2, 9),
        type,
        message: line,
        timestamp
      }))
    ]);
  }, []);

  // --- AI Code Explainer Function ---
  const explainCode = useCallback(async () => {
    const code = getEditorValue();
    if (!code.trim()) {
      addLog('warn', 'No code to explain. Please write some code first.');
      return;
    }

    setIsExplaining(true);
    setExplanation('');
    setShowExplanationModal(true);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_EXPLAINER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', // High quality and fast
          messages: [
            {
              role: 'system',
              content: 'You are a helpful coding assistant. Explain the provided code in a clear, concise way. Break down the explanation into: 1) What the code does (overview), 2) Key components/functions, 3) How it works (step-by-step if applicable). Use markdown formatting for readability.'
            },
            {
              role: 'user',
              content: `Please explain this ${activeLanguage === 'web' ? activeTab.toUpperCase() : LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>].label} code:\n\n\`\`\`${getLanguage()}\n${code}\n\`\`\``
            }
          ],
          temperature: 0.7,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const explanationText = data.choices[0]?.message?.content || 'No explanation received.';
      setExplanation(explanationText);
      addLog('info', '✨ Code explanation generated successfully!');
    } catch (err: any) {
      setExplanation(`Error: ${err.message}. Please check your API key and try again.`);
      addLog('error', `❌ Failed to explain code: ${err.message}`);
    } finally {
      setIsExplaining(false);
    }
  }, [activeLanguage, activeTab, addLog, htmlCode, cssCode, jsCode, polyglotCode]);

  const clearConsole = () => setLogs([]);

  const clearAll = () => {
    if (confirm('Are you sure you want to clear the current editor?')) {
      if (activeLanguage === 'web') {
        setHtmlCode('');
        setCssCode('');
        setJsCode('');
        setSrcDoc('');
      } else {
        setPolyglotCode(prev => ({ ...prev, [activeLanguage]: '' }));
      }
      clearConsole();
    }
  };

  const downloadCode = () => {
    let fileContent = '';
    let fileName = '';
    let mimeType = 'text/plain';

    if (activeLanguage === 'web') {
      fileContent = `<!DOCTYPE html>
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
      fileName = 'index.html';
      mimeType = 'text/html';
    } else {
      fileContent = polyglotCode[activeLanguage];
      const ext = activeLanguage === 'python' ? 'py' : activeLanguage === 'rust' ? 'rs' : activeLanguage === 'kotlin' ? 'kt' : activeLanguage === 'csharp' ? 'cs' : activeLanguage === 'typescript' ? 'ts' : activeLanguage;
      fileName = `main.${ext}`;
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    addLog('info', `File ${fileName} downloaded successfully.`);
  };

  const loadTemplate = () => {
    if (activeLanguage === 'web') {
      setHtmlCode(DEFAULT_HTML);
      setCssCode(DEFAULT_CSS);
      setJsCode(DEFAULT_JS);
    } else {
      setPolyglotCode(prev => ({ ...prev, [activeLanguage]: LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>].template }));
    }
    setTimeout(runCode, 100);
  };

  const openExternalPreview = () => {
    window.open('/preview.html', '_blank');
    addLog('info', 'Opening external preview tab...');
  };

  // --- Render Helpers ---

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    if (activeLanguage !== 'web') {
      setPolyglotCode(prev => ({ ...prev, [activeLanguage]: value }));
      return;
    }
    switch (activeTab) {
      case 'html': setHtmlCode(value); break;
      case 'css': setCssCode(value); break;
      case 'js': setJsCode(value); break;
    }
  };

  const handleEditorMount: OnMount = (editor) => {
    editor.focus();
  };

  const handleBeforeMount = (monaco: any) => {
    monaco.editor.defineTheme('github-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#c9d1d9',
        'editor.lineHighlightBackground': '#161b22',
        'editor.selectionBackground': '#1f6feb44',
        'editorCursor.foreground': '#58a6ff',
        'editorWhitespace.foreground': '#484f58',
      }
    });

    monaco.editor.defineTheme('github-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#24292e',
        'editor.lineHighlightBackground': '#f6f8fa',
        'editor.selectionBackground': '#0366d622',
        'editorCursor.foreground': '#0366d6',
      }
    });

    monaco.editor.defineTheme('monokai', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '75715e' },
        { token: 'keyword', foreground: 'f92672' },
        { token: 'string', foreground: 'e6db74' },
      ],
      colors: {
        'editor.background': '#272822',
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#3e3d32',
        'editor.selectionBackground': '#49483e',
        'editorCursor.foreground': '#f8f8f0',
      }
    });

    emmetHTML(monaco);
    emmetCSS(monaco);
    emmetJSX(monaco);
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-300 font-sans overflow-hidden">

      {/* --- Header --- */}
      <header className="h-14 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-2">
         <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-lg shadow-blue-500/10">
            <img src="/assets/logo.webp" alt="CodeADK" className="w-full h-full object-cover" />
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-sm font-semibold rounded-lg transition-all border border-blue-500/20 active:scale-95"
          >
            <MessageSquare size={16} />
            Back to ChatAdk
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e1e] hover:bg-[#2d2d2d] text-gray-300 text-xs font-bold rounded-lg border border-[#333] transition-all active:scale-95"
          >
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            {activeLanguage === 'web' ? 'Web (HTML/CSS/JS)' : LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>].label}
            <ChevronDown size={14} className={cn("transition-transform duration-200", isLanguageMenuOpen && "rotate-180")} />
          </button>

          {isLanguageMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsLanguageMenuOpen(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-56 bg-[#252526] border border-[#333] rounded-xl shadow-2xl overflow-hidden z-40 animate-in fade-in zoom-in duration-200">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      setActiveLanguage('web');
                      setActiveTab('html');
                      setIsLanguageMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      activeLanguage === 'web' ? "bg-blue-600/20 text-blue-400" : "hover:bg-[#2d2d2d] text-gray-300"
                    )}
                  >
                    <Layout size={16} />
                    <span className="flex-1 text-left font-semibold">Web (HTML/CSS/JS)</span>
                    {activeLanguage === 'web' && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </button>

                  <div className="h-px bg-[#333] my-2 mx-2" />

                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setActiveLanguage(key as Language);
                          setActiveTab('code');
                          setIsLanguageMenuOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          activeLanguage === key ? "bg-blue-600/20 text-blue-400" : "hover:bg-[#2d2d2d] text-gray-300"
                        )}
                      >
                        <Terminal size={16} />
                        <span className="flex-1 text-left font-semibold">{config.label}</span>
                        {activeLanguage === key && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Theme Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e1e] hover:bg-[#2d2d2d] text-gray-300 text-xs font-bold rounded-lg border border-[#333] transition-all active:scale-95 shadow-sm"
            title="Change Editor Theme"
          >
            <Palette size={14} className="text-blue-400" />
            <span className="hidden sm:inline text-gray-400">Theme</span>
            <ChevronDown size={14} className={cn("transition-transform duration-200 text-gray-500", isThemeMenuOpen && "rotate-180")} />
          </button>

          {isThemeMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsThemeMenuOpen(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-48 bg-[#252526] border border-[#333] rounded-xl shadow-2xl overflow-hidden z-40 animate-in fade-in zoom-in duration-200">
                <div className="p-2 space-y-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 px-3 py-1">
                  Select Theme
                </div>
                <div className="p-2 space-y-1">
                  {(['vs-dark', 'vs', 'github-dark', 'github-light', 'monokai'] as Theme[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setActiveTheme(t);
                        localStorage.setItem('codeadk_theme', t);
                        setIsThemeMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
                        activeTheme === t ? "bg-blue-600/20 text-blue-400" : "hover:bg-[#2d2d2d] text-gray-300"
                      )}
                    >
                      {t === 'vs-dark' ? 'VS Code Dark' :
                        t === 'vs' ? 'VS Code Light' :
                          t === 'github-dark' ? 'GitHub Dark' :
                            t === 'github-light' ? 'GitHub Light' : 'Monokai'}
                      {activeTheme === t && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* AI Explain Button */}
          <button
            onClick={explainCode}
            disabled={isExplaining}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95",
              isExplaining
                ? "bg-purple-600/20 text-purple-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-600/20"
            )}
            title="Explain Code with AI"
          >
            {isExplaining ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span className="hidden sm:inline">{isExplaining ? 'Explaining...' : 'Explain'}</span>
          </button>

          <div className="w-px h-6 bg-[#333] mx-0.5 sm:mx-1 hidden lg:block"></div>

          {/* Global Toggles */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-[#1e1e1e] p-1 rounded-lg border border-[#333]">
            <button
              onClick={() => setIsEditorVisible(!isEditorVisible)}
              className={cn(
                "p-1 rounded transition-all flex items-center gap-1 group",
                isEditorVisible
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "bg-orange-500/20 text-orange-400 border border-orange-500/50 hover:bg-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
              )}
              title={isEditorVisible ? "Hide Editor" : "Unhide Editor"}
            >
              <FileCode size={14} className="sm:w-4 sm:h-4" />
              {!isEditorVisible && <span className="text-[10px] font-bold uppercase hidden sm:inline pr-1">Editor</span>}
            </button>
            <button
              onClick={() => setIsPreviewVisible(!isPreviewVisible)}
              className={cn(
                "p-1 rounded transition-all flex items-center gap-1 group",
                isPreviewVisible
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "bg-orange-500/20 text-orange-400 border border-orange-500/50 hover:bg-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
              )}
              title={isPreviewVisible ? "Hide Preview" : "Unhide Preview"}
            >
              <Monitor size={14} className="sm:w-4 sm:h-4" />
              {!isPreviewVisible && <span className="text-[10px] font-bold uppercase hidden sm:inline pr-1">Output</span>}
            </button>
            <button
              onClick={() => setIsConsoleVisible(!isConsoleVisible)}
              className={cn(
                "p-1 rounded transition-all flex items-center gap-1 group",
                isConsoleVisible
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "bg-orange-500/20 text-orange-400 border border-orange-500/50 hover:bg-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
              )}
              title={isConsoleVisible ? "Hide Console" : "Unhide Console"}
            >
              <Terminal size={14} className="sm:w-4 sm:h-4" />
              {!isConsoleVisible && <span className="text-[10px] font-bold uppercase hidden sm:inline pr-1">Debug</span>}
            </button>
          </div>

          <div className="w-px h-6 bg-[#333] mx-0.5 sm:mx-1 hidden lg:block"></div>

          <button onClick={loadTemplate} className="p-1.5 sm:px-3 sm:py-1.5 text-sm hover:bg-[#3c3c3c] rounded transition-colors" title="Load Template">
            <LayoutTemplate size={16} /> <span className="hidden lg:inline text-xs font-semibold">Template</span>
          </button>

          <button
            onClick={runCode}
            disabled={isRunning}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-lg relative overflow-hidden group/run",
              isRunning
                ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
            )}
          >
            {isRunning ? (
              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Play size={14} fill="currentColor" className="sm:w-[16px] sm:h-[16px] group-hover/run:scale-110 transition-transform" />
            )}
            <span className="">{isRunning ? '...' : 'Run'}</span>
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

      {/* --- AI Explanation Modal --- */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 rounded-lg">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">AI Code Explanation</h3>
                  <p className="text-xs text-gray-400">Powered by ChatAdk</p>
                </div>
              </div>
              <button
                onClick={() => setShowExplanationModal(false)}
                className="p-2 hover:bg-[#333] rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {isExplaining ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 size={40} className="text-purple-500 animate-spin" />
                  <p className="text-gray-400 animate-pulse">Analyzing your code...</p>
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-gray-300 leading-relaxed">
                    {explanation}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-[#333] bg-[#252526] rounded-b-2xl">
              <span className="text-xs text-gray-500">
                {activeLanguage === 'web' ? activeTab.toUpperCase() : LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>].label} • {getEditorValue().split('\n').length} lines
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(explanation);
                    addLog('info', 'Explanation copied to clipboard!');
                  }}
                  disabled={isExplaining || !explanation}
                  className="px-4 py-2 bg-[#333] hover:bg-[#444] text-gray-300 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Copy
                </button>
                <button
                  onClick={() => setShowExplanationModal(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Main Workspace --- */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative" ref={containerRef}>

        {/* Editor Section */}
        {isEditorVisible && !isFullscreen && (
          <div
            className={cn(
              "flex flex-col bg-[#1e1e1e] border-[#333] relative order-2 lg:order-1 transition-all duration-300",
              "border-t lg:border-t-0 lg:border-r"
            )}
            style={{
              width: window.innerWidth >= 1024 ? (isPreviewVisible || isConsoleVisible ? `${splitRatio}%` : '100%') : '100%',
              height: window.innerWidth < 1024 ? (isPreviewVisible || isConsoleVisible ? `${100 - mobileOutputHeight}%` : '100%') : '100%'
            }}
          >
            {/* Tabs & Editor Header */}
            <div className="flex items-center justify-between bg-[#252526] pr-2">
              <div className="flex">
                {activeLanguage === 'web' ? (
                  (['html', 'css', 'js'] as Tab[]).map((tab) => (
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
                  ))
                ) : (
                  <button
                    className="px-4 py-2 text-xs uppercase font-medium border-t-2 transition-colors flex items-center gap-2 bg-[#1e1e1e] text-white border-blue-500"
                  >
                    <FileCode size={14} className="text-blue-400" />
                    main.{activeLanguage === 'python' ? 'py' : activeLanguage === 'rust' ? 'rs' : activeLanguage === 'kotlin' ? 'kt' : activeLanguage === 'csharp' ? 'cs' : activeLanguage === 'typescript' ? 'ts' : activeLanguage}
                  </button>
                )}
              </div>

              <button
                onClick={() => setIsEditorVisible(false)}
                className="p-1 hover:bg-[#3c3c3c] rounded text-gray-500 hover:text-white transition-colors"
                title="Hide Editor"
              >
                <X size={14} />
              </button>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 relative overflow-hidden">
              <Editor
                height="100%"
                language={getLanguage()}
                value={getEditorValue()}
                onChange={handleEditorChange}
                theme={activeTheme}
                beforeMount={handleBeforeMount}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 16 },
                  renderLineHighlight: 'all',
                  mouseWheelZoom: true,
                  tabCompletion: 'on',
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: { other: true, comments: false, strings: true },
                  acceptSuggestionOnEnter: 'on',
                  wordBasedSuggestions: 'currentDocument',
                }}
              />
            </div>
          </div>
        )}

        {/* Resize Handle (Desktop Only - Horizontal) */}
        {!isFullscreen && isEditorVisible && (isPreviewVisible || isConsoleVisible) && (
          <div
            className="hidden lg:block w-1 hover:w-1.5 bg-blue-600/30 hover:bg-blue-600 cursor-col-resize z-30 transition-all relative group"
            onMouseDown={() => setIsDragging('horizontal')}
          >
            <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize z-40" />
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/10 group-hover:bg-white/40" />
          </div>
        )}

        {/* Resize Handle (Mobile Only - Vertical) */}
        {!isFullscreen && isEditorVisible && (isPreviewVisible || isConsoleVisible) && (
          <div
            className="lg:hidden h-1.5 bg-[#2d2d2d] hover:bg-blue-600 cursor-row-resize z-10 transition-colors relative"
            onMouseDown={() => setIsDragging('mobile')}
          >
            <div className="absolute inset-x-0 -top-2 -bottom-2 cursor-row-resize" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 rounded-full bg-gray-600/50" />
          </div>
        )}

        {/* Preview & Console Section */}
        {(isPreviewVisible || isConsoleVisible) && (
          <div
            className="flex flex-col bg-[#0d0d0e] h-full transition-all duration-300 order-1 lg:order-2"
            style={{
              width: window.innerWidth >= 1024 ? (isFullscreen || !isEditorVisible ? '100%' : `${100 - splitRatio}%`) : '100%',
              height: window.innerWidth < 1024 ? (isEditorVisible ? `${mobileOutputHeight}%` : '100%') : '100%'
            }}
          >
            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden bg-gray-100 border-b border-gray-200">
              <button
                onClick={() => setActiveOutputTab('preview')}
                className={cn(
                  "flex-1 px-4 py-2 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2",
                  activeOutputTab === 'preview' ? "bg-white text-blue-600 shadow-inner" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Monitor size={14} /> Preview
              </button>
              <button
                onClick={() => setActiveOutputTab('console')}
                className={cn(
                  "flex-1 px-4 py-2 text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 border-l border-gray-200",
                  activeOutputTab === 'console' ? "bg-white text-blue-600 shadow-inner" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Terminal size={14} /> Console
              </button>
            </div>

            {/* Preview Section */}
            {isPreviewVisible && (activeOutputTab === 'preview' || window.innerWidth >= 1024) && (
              <div className={cn("flex flex-col overflow-hidden", activeLanguage === 'web' || !isConsoleVisible ? "flex-1" : "h-auto shrink-0")}>
                {/* Preview Toolbar */}
                <div className="h-10 bg-[#f3f4f6] border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-xs font-bold uppercase tracking-wider">Preview</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 bg-gray-200 p-1 rounded-lg">
                      <button
                        onClick={openExternalPreview}
                        className="p-1.5 rounded transition-all text-gray-500 hover:text-blue-600 hover:bg-white active:scale-95"
                        title="Open in New Tab"
                      >
                        <ExternalLink size={16} />
                      </button>
                      <div className="w-px h-4 bg-gray-300 mx-1"></div>
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

                    <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block"></div>

                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="text-gray-500 hover:text-gray-800 transition-colors p-1"
                      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
                    >
                      {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>

                    <button
                      onClick={() => setIsPreviewVisible(false)}
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-red-500 transition-colors"
                      title="Hide Preview"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Iframe Container */}
                <div className="flex-1 bg-[#121214] flex justify-center overflow-auto relative">
                  {activeLanguage === 'web' ? (
                    <div
                      className={cn(
                        "bg-white shadow-2xl transition-all duration-500 ease-in-out h-full",
                        device === 'mobile' ? 'w-[375px]' : device === 'tablet' ? 'w-[768px]' : 'w-full'
                      )}
                    >
                      <iframe
                        key={srcDoc}
                        ref={iframeRef}
                        title="preview"
                        srcDoc={srcDoc}
                        className="w-full h-full border-0"
                        sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups allow-presentation"
                        allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; clipboard-read; clipboard-write"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0d0e] text-gray-500 p-8 text-center max-w-lg mx-auto">
                      <div className="w-16 h-16 bg-[#1a1a1b] rounded-full flex items-center justify-center mb-4 border border-[#333]">
                        <Terminal size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-300 mb-2">{LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>].label} Mode</h3>
                      <p className="text-sm text-gray-500">
                        This language requires a backend runtime. Results will appear in the console below.
                      </p>
                      <button
                        onClick={runCode}
                        disabled={isRunning}
                        className="mt-6 px-6 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 border border-blue-500/30"
                      >
                        {isRunning ? 'Executing...' : `Run ${activeLanguage} code`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Console Resize Handle */}
            {!isFullscreen && isPreviewVisible && isConsoleVisible && window.innerWidth >= 1024 && (
              <div
                className="h-1 bg-blue-600/30 hover:bg-blue-600 cursor-row-resize z-30 transition-all relative group"
                onMouseDown={() => setIsDragging('vertical')}
              >
                <div className="absolute inset-x-0 -top-2 -bottom-2 cursor-row-resize z-40" />
              </div>
            )}

            {/* Console Panel */}
            {isConsoleVisible && !isFullscreen && (activeOutputTab === 'console' || window.innerWidth >= 1024) && (
              <div
                className={cn(
                  "bg-[#0d0d0e] border-t border-[#333] flex flex-col shrink-0 transition-all",
                  window.innerWidth < 1024 ? "flex-1" : ""
                )}
                style={window.innerWidth >= 1024 && isPreviewVisible && activeLanguage === 'web' ? { height: `${consoleHeight}px` } : { flex: 1 }}
              >
                <div className="h-8 bg-[#252526] flex items-center justify-between px-4 border-b border-[#333]">
                  <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase">
                    <Terminal size={12} /> Console
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={clearConsole}
                      className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider"
                    >
                      Clear Console
                    </button>
                    <button
                      onClick={() => setIsConsoleVisible(false)}
                      className="p-1 hover:bg-[#3c3c3c] rounded text-gray-500 hover:text-red-400 transition-colors"
                      title="Hide Console"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1">
                  {logs.length === 0 && (
                    <div className="text-gray-600 italic p-2">Console is empty. Run code to see logs.</div>
                  )}
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-2 border-b border-[#333]/50 pb-1 last:border-0">
                      <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                      <span className={cn(
                        "break-all whitespace-pre-wrap",
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
        )}

        {/* Fallback if everything is hidden */}
        {!isEditorVisible && !isPreviewVisible && !isConsoleVisible && (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#1e1e1e] text-center p-8 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-[#252526] rounded-full flex items-center justify-center mb-6 border border-[#333] shadow-2xl">
              <Layout size={40} className="text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Workspace is Empty</h2>
            <p className="text-gray-400 max-w-sm mb-8">
              You've hidden all panels. Click the buttons in the header to unhide them.
            </p>
            <button
              onClick={() => {
                setIsEditorVisible(true);
                setIsPreviewVisible(true);
                setIsConsoleVisible(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/20"
            >
              <Eye size={20} /> Show Everything
            </button>
          </div>
        )}
      </div>
    </div>
  );
}