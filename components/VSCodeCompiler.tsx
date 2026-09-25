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
  Sparkles,
  Loader2,
  Lock,
  Check,
  Sun,
  Moon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from '../services/firebase';
import { readNumber, readString, writeString } from '../services/storage';
import { codeExplanationService } from '../services/codeExplanationService';

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
  theme?: 'light' | 'dark';
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

const fileExt = (lang: Language) =>
  lang === 'python' ? 'py' : lang === 'rust' ? 'rs' : lang === 'kotlin' ? 'kt'
  : lang === 'csharp' ? 'cs' : lang === 'typescript' ? 'ts' : lang;

export default function VSCodeCompiler({ onClose, theme = 'dark' }: VSCodeCompilerProps) {
  const isDark = theme === 'dark';
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
    const saved = readString('codeadk_theme', '');
    if (saved) return saved as Theme;
    return theme === 'dark' ? 'github-dark' : 'github-light';
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [programInput, setProgramInput] = useState('');

  // Auth State
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    return auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
  }, []);

  // AI Explainer States
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  // Resize States
  const [isDragging, setIsDragging] = useState<'horizontal' | 'vertical' | 'mobile' | false>(false);
  const [splitRatio, setSplitRatio] = useState(() => {
    return readNumber('codeadk_split_ratio', 50);
  });
  const [consoleHeight, setConsoleHeight] = useState(() => {
    return readNumber('codeadk_console_height', 200);
  });
  const [mobileOutputHeight, setMobileOutputHeight] = useState(() => {
    return readNumber('codeadk_mobile_output_height', 50);
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const retryCount = useRef(0);

  // Refs mirror tab/language so editor change events always write to the right file
  const tabRef = useRef(activeTab);
  tabRef.current = activeTab;
  const langRef = useRef(activeLanguage);
  langRef.current = activeLanguage;

  // Each file gets its own Monaco model (path) — fixes content/cursor/undo leaking across tabs
  const editorPath = activeLanguage === 'web' ? `index.${activeTab}` : `main.${fileExt(activeLanguage)}`;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-switch output tab based on language
  useEffect(() => {
    if (activeLanguage === 'web') {
      setActiveOutputTab('preview');
    } else {
      setActiveOutputTab('console');
    }
  }, [activeLanguage]);

  // Re-render splits on viewport resize/rotation (layout reads window.innerWidth)
  const [, setViewportTick] = useState(0);
  useEffect(() => {
    const onResize = () => setViewportTick(t => t + 1);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Handle Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();

      if (isDragging === 'horizontal') {
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        if (newWidth > 15 && newWidth < 85) {
          setSplitRatio(newWidth);
          writeString('codeadk_split_ratio', newWidth.toString(), { persist: 'both' });
        }
      } else if (isDragging === 'vertical') {
        const newHeight = containerRect.bottom - e.clientY;
        if (newHeight > 100 && newHeight < containerRect.height - 100) {
          setConsoleHeight(newHeight);
          writeString('codeadk_console_height', newHeight.toString(), { persist: 'both' });
        }
      } else if (isDragging === 'mobile') {
        const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
        if (newHeight > 20 && newHeight < 80) {
          setMobileOutputHeight(newHeight);
          writeString('codeadk_mobile_output_height', newHeight.toString(), { persist: 'both' });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Releasing outside the window / alt-tabbing mid-drag must also end the
    // drag, otherwise body `user-select: none` sticks and editor text can
    // never be selected again.
    const handleCancel = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp, true);
      window.addEventListener('blur', handleCancel);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isDragging === 'horizontal' ? 'col-resize' : 'row-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp, true);
      window.removeEventListener('blur', handleCancel);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force iframe reload when device changes
  useEffect(() => {
    if (activeLanguage === 'web' && srcDoc) {
      const timeoutId = setTimeout(() => {
        setSrcDoc(prev => prev);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcDoc]);

  // --- Actions ---

  const runCode = useCallback(async () => {
    if (activeLanguage !== 'web') {
      setIsRunning(true);
      clearConsole();
      addLog('info', `Compiling and running ${activeLanguage} code...`);

      const config = LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>];
      const code = polyglotCode[activeLanguage];
      const stdin = programInput;

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
              stdin: stdin,
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
        addLog('error', `Execution error: ${err.message}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlCode, cssCode, jsCode, activeLanguage, polyglotCode, programInput]);

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
    if (!currentUser) {
      addLog('warn', 'Please log in to use AI code explanation.');
      alert('AI features are locked for guests. Please sign in to unlock "Explain with AI".');
      return;
    }

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
          'Authorization': `Bearer ${import.meta.env.VITE_EXPLAINER_API_KEY || import.meta.env.VITE_GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
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

      // Persist to Supabase if user is logged in
      const user = auth.currentUser;
      if (user) {
        codeExplanationService.saveExplanation({
          user_id: user.uid,
          language: activeLanguage === 'web' ? activeTab : activeLanguage,
          code: code,
          explanation: explanationText,
          timestamp: new Date().toISOString()
        });
      }

      addLog('info', 'Code explanation generated successfully!');
    } catch (err: any) {
      setExplanation(`Error: ${err.message}. Please check your API key and try again.`);
      addLog('error', `Failed to explain code: ${err.message}`);
    } finally {
      setIsExplaining(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      fileName = `main.${fileExt(activeLanguage)}`;
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
  // Writes to the file that is active at event time (via refs) — pastes can no
  // longer land in the wrong tab when switching files quickly.
  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    const lang = langRef.current;
    if (lang !== 'web') {
      setPolyglotCode(prev => ({ ...prev, [lang]: value }));
      return;
    }
    switch (tabRef.current) {
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

  // --- Minimal theme tokens ---
  const muted = isDark ? 'text-neutral-500' : 'text-neutral-400';
  const fg = isDark ? 'text-neutral-200' : 'text-neutral-700';
  const border = isDark ? 'border-white/[0.07]' : 'border-black/[0.07]';
  const hoverBg = isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.05]';
  const menuCard = isDark ? 'bg-[#2f2f2f] border-white/10' : 'bg-white border-black/10';
  const menuItem = (active: boolean) =>
    active
      ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-black/[0.05] text-neutral-900')
      : (isDark ? 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200' : 'text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900');
  const ghostBtn = `w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200' : 'text-neutral-400 hover:bg-black/[0.05] hover:text-neutral-700'}`;

  const THEME_LABELS: Record<Theme, string> = {
    'vs-dark': 'VS Code Dark',
    'vs': 'VS Code Light',
    'github-dark': 'GitHub Dark',
    'github-light': 'GitHub Light',
    'monokai': 'Monokai',
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden ${isDark ? 'bg-[#212121] text-neutral-200' : 'bg-white text-neutral-700'}`}>

      {/* --- Slim header (scrolls sideways on narrow screens) --- */}
      <header className={`h-14 shrink-0 flex items-center gap-1 px-3 sm:px-4 border-b z-20 overflow-x-auto scrollbar-hide [&>*]:shrink-0 ${border} ${isDark ? 'bg-[#212121]' : 'bg-white'}`}>
        {onClose && (
          <button onClick={onClose} className={ghostBtn} title="Back to chat">
            <MessageSquare size={17} strokeWidth={1.8} />
          </button>
        )}
        <span className={`text-[14px] font-semibold tracking-tight px-1 ${isDark ? 'text-white' : 'text-neutral-900'}`}>Code studio</span>

        {/* Language picker */}
        <div className="relative">
          <button
            onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
            className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-full border text-[12px] font-medium transition-colors ${isDark ? 'border-white/10 text-neutral-300 hover:bg-white/[0.06]' : 'border-black/10 text-neutral-600 hover:bg-black/[0.04]'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            {activeLanguage === 'web' ? 'Web' : LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>].label}
            <ChevronDown size={13} className={cn('opacity-50 transition-transform', isLanguageMenuOpen && 'rotate-180')} />
          </button>
          {isLanguageMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsLanguageMenuOpen(false)} />
              <div className={`fixed top-16 left-3 w-60 rounded-2xl border p-1.5 shadow-2xl z-40 animate-slide-up ${menuCard}`}>
                <button
                  onClick={() => { setActiveLanguage('web'); setActiveTab('html'); setIsLanguageMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${menuItem(activeLanguage === 'web')}`}
                >
                  <Layout size={15} /> Web (HTML/CSS/JS)
                  {activeLanguage === 'web' && <Check size={14} className="ml-auto opacity-60" />}
                </button>
                <div className={`h-px my-1.5 mx-2 ${isDark ? 'bg-white/[0.07]' : 'bg-black/[0.06]'}`} />
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  {Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => { setActiveLanguage(key as Language); setActiveTab('code'); setIsLanguageMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${menuItem(activeLanguage === key)}`}
                    >
                      <Terminal size={15} /> {config.label}
                      {activeLanguage === key && <Check size={14} className="ml-auto opacity-60" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Editor theme picker */}
        <div className="relative">
          <button
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className={`flex items-center gap-1.5 p-2 rounded-lg transition-colors ${isDark ? 'text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200' : 'text-neutral-400 hover:bg-black/[0.05] hover:text-neutral-700'}`}
            title="Editor theme"
          >
            {isDark ? <Moon size={15} /> : <Sun size={15} />}
            <ChevronDown size={13} className={cn('opacity-50 transition-transform', isThemeMenuOpen && 'rotate-180')} />
          </button>
          {isThemeMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsThemeMenuOpen(false)} />
              <div className={`fixed top-16 left-24 w-52 rounded-2xl border p-1.5 shadow-2xl z-40 animate-slide-up ${menuCard}`}>
                <p className={`px-3 pt-1.5 pb-1 text-[11px] ${muted}`}>Editor theme</p>
                {(['vs-dark', 'vs', 'github-dark', 'github-light', 'monokai'] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setActiveTheme(t); writeString('codeadk_theme', t, { persist: 'both' }); setIsThemeMenuOpen(false); }}
                    className={`w-full flex items-center px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${menuItem(activeTheme === t)}`}
                  >
                    {THEME_LABELS[t]}
                    {activeTheme === t && <Check size={14} className="ml-auto opacity-60" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <span className="flex-1 min-w-3" />

        <div className="flex items-center gap-1 shrink-0">
          {/* Panel toggles */}
          <button onClick={() => setIsEditorVisible(!isEditorVisible)} className={ghostBtn} title={isEditorVisible ? 'Hide editor' : 'Show editor'}>
            <FileCode size={16} strokeWidth={1.8} className={!isEditorVisible ? 'opacity-100 text-amber-500' : 'opacity-70'} />
          </button>
          <button onClick={() => setIsPreviewVisible(!isPreviewVisible)} className={ghostBtn} title={isPreviewVisible ? 'Hide output' : 'Show output'}>
            <Monitor size={16} strokeWidth={1.8} className={!isPreviewVisible ? 'opacity-100 text-amber-500' : 'opacity-70'} />
          </button>
          <button onClick={() => setIsConsoleVisible(!isConsoleVisible)} className={ghostBtn} title={isConsoleVisible ? 'Hide console' : 'Show console'}>
            <Terminal size={16} strokeWidth={1.8} className={!isConsoleVisible ? 'opacity-100 text-amber-500' : 'opacity-70'} />
          </button>

          <button onClick={loadTemplate} className={ghostBtn} title="Load template">
            <LayoutTemplate size={16} strokeWidth={1.8} />
          </button>
          <button onClick={downloadCode} className={ghostBtn} title="Download code">
            <Download size={16} strokeWidth={1.8} />
          </button>
          <button onClick={clearAll} className={ghostBtn} title="Clear editor">
            <Trash2 size={16} strokeWidth={1.8} />
          </button>

          {/* AI Explain */}
          <button
            onClick={explainCode}
            disabled={isExplaining}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] font-medium border transition-all active:scale-[0.98] ${!currentUser
              ? (isDark ? 'border-white/10 text-neutral-500' : 'border-black/10 text-neutral-400')
              : 'border-transparent bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200'}`}
            title={currentUser ? 'Explain code with AI' : 'Log in to unlock AI explain'}
          >
            {isExplaining ? <Loader2 size={14} className="animate-spin" /> : !currentUser ? <Lock size={14} /> : <Sparkles size={14} />}
            <span className="hidden sm:inline">{isExplaining ? '…' : currentUser ? 'Explain' : 'Locked'}</span>
          </button>

          {/* Run */}
          <button
            onClick={runCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} strokeWidth={2.2} />}
            Run
          </button>

          {onClose && (
            <button onClick={onClose} className={ghostBtn} title="Close">
              <X size={17} />
            </button>
          )}
        </div>
      </header>

      {/* --- AI Explanation Modal --- */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className={`w-full max-w-xl max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl animate-slide-up ${menuCard}`}>
            <div className={`flex items-center justify-between px-5 h-14 shrink-0 border-b ${border}`}>
              <h3 className={`text-[14px] font-medium ${isDark ? 'text-white' : 'text-neutral-900'}`}>AI explanation</h3>
              <button onClick={() => setShowExplanationModal(false)} className={ghostBtn}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
              {isExplaining ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 size={26} className="animate-spin opacity-60" />
                  <p className={`text-[13px] ${muted}`}>Analyzing your code…</p>
                </div>
              ) : (
                <div className={`whitespace-pre-wrap text-[13.5px] leading-relaxed ${fg}`}>{explanation}</div>
              )}
            </div>
            <div className={`flex items-center justify-between px-5 py-3 border-t shrink-0 ${border}`}>
              <span className={`text-[11.5px] ${muted}`}>
                {activeLanguage === 'web' ? activeTab.toUpperCase() : LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>].label} · {getEditorValue().split('\n').length} lines
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(explanation); addLog('info', 'Explanation copied to clipboard!'); }}
                  disabled={isExplaining || !explanation}
                  className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors disabled:opacity-40 ${isDark ? 'border-white/15 text-neutral-200 hover:bg-white/[0.06]' : 'border-black/15 text-neutral-700 hover:bg-black/[0.04]'}`}
                >
                  Copy
                </button>
                <button
                  onClick={() => setShowExplanationModal(false)}
                  className="px-3.5 py-1.5 rounded-full text-[12.5px] font-medium bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors"
                >
                  Done
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
            className={cn('flex flex-col relative transition-all duration-300 order-2 lg:order-1', `border-t lg:border-t-0 lg:border-r ${border}`, isDark ? 'bg-[#1e1e1e]' : 'bg-neutral-50')}
            style={{
              width: window.innerWidth >= 1024 ? (isPreviewVisible || isConsoleVisible ? `${splitRatio}%` : '100%') : '100%',
              height: window.innerWidth < 1024 ? (isPreviewVisible || isConsoleVisible ? `${100 - mobileOutputHeight}%` : '100%') : '100%'
            }}
          >
            {/* Minimal file tabs */}
            <div className={`flex items-center justify-between pr-1 border-b ${border} ${isDark ? 'bg-[#171717]' : 'bg-neutral-100/60'}`}>
              <div className="flex items-center px-1">
                {activeLanguage === 'web' ? (
                  (['html', 'css', 'js'] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'px-3.5 py-2.5 text-[12.5px] font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5',
                        activeTab === tab
                          ? (isDark ? 'text-white border-white' : 'text-neutral-900 border-neutral-900')
                          : (`border-transparent ${muted} ${hoverBg}`)
                      )}
                    >
                      {tab === 'html' && <span className="text-orange-500 text-[11px] font-bold">&lt;/&gt;</span>}
                      {tab === 'css' && <span className="text-blue-500 text-[11px] font-bold">#</span>}
                      {tab === 'js' && <span className="text-yellow-500 text-[11px] font-bold">JS</span>}
                      {tab === 'html' ? 'index.html' : tab === 'css' ? 'style.css' : 'script.js'}
                    </button>
                  ))
                ) : (
                  <span className={cn('px-3.5 py-2.5 text-[12.5px] font-medium flex items-center gap-1.5 border-b-2 -mb-px', isDark ? 'text-white border-white' : 'text-neutral-900 border-neutral-900')}>
                    <FileCode size={13} className={muted} />
                    main.{fileExt(activeLanguage)}
                  </span>
                )}
              </div>
              <button onClick={() => setIsEditorVisible(false)} className={ghostBtn} title="Hide editor">
                <X size={13} />
              </button>
            </div>

            {/* Monaco Editor — `path` gives every file its own model */}
            <div className="flex-1 relative overflow-hidden">
              <Editor
                path={editorPath}
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
            className={`hidden lg:block w-1 cursor-col-resize z-30 transition-colors relative ${isDark ? 'hover:bg-white/25' : 'hover:bg-black/25'}`}
            onMouseDown={() => setIsDragging('horizontal')}
          >
            <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize z-40" />
          </div>
        )}

        {/* Resize Handle (Mobile Only - Vertical) */}
        {!isFullscreen && isEditorVisible && (isPreviewVisible || isConsoleVisible) && (
          <div
            className={`lg:hidden h-1.5 cursor-row-resize z-10 transition-colors relative ${isDark ? 'bg-white/[0.04] hover:bg-white/20' : 'bg-black/[0.04] hover:bg-black/20'}`}
            onMouseDown={() => setIsDragging('mobile')}
          >
            <div className="absolute inset-x-0 -top-2 -bottom-2 cursor-row-resize" />
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 rounded-full ${isDark ? 'bg-white/20' : 'bg-black/20'}`} />
          </div>
        )}

        {/* Preview & Console Section */}
        {(isPreviewVisible || isConsoleVisible) && (
          <div
            className="flex flex-col h-full transition-all duration-300 order-1 lg:order-2"
            style={{
              width: window.innerWidth >= 1024 ? (isFullscreen || !isEditorVisible ? '100%' : `${100 - splitRatio}%`) : '100%',
              height: window.innerWidth < 1024 ? (isEditorVisible ? `${mobileOutputHeight}%` : '100%') : '100%'
            }}
          >
            {/* Mobile Tab Switcher */}
            <div className={`flex lg:hidden border-b ${border}`}>
              {(['preview', 'console'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveOutputTab(t)}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-[12.5px] font-medium transition-colors flex items-center justify-center gap-1.5 border-b-2 -mb-px',
                    activeOutputTab === t
                      ? (isDark ? 'text-white border-white' : 'text-neutral-900 border-neutral-900')
                      : (`border-transparent ${muted}`)
                  )}
                >
                  {t === 'preview' ? <Monitor size={13} /> : <Terminal size={13} />}
                  {t === 'preview' ? 'Preview' : 'Console'}
                </button>
              ))}
            </div>

            {/* Preview Section */}
            {isPreviewVisible && (activeOutputTab === 'preview' || window.innerWidth >= 1024) && (
              <div className={cn('flex flex-col overflow-hidden', activeLanguage === 'web' || !isConsoleVisible ? 'flex-1' : 'h-auto shrink-0')}>
                {/* Preview Toolbar */}
                <div className={`h-10 border-b flex items-center justify-between px-3 shrink-0 ${border}`}>
                  <span className={`text-[12px] font-medium ${muted}`}>Preview</span>
                  <div className="flex items-center gap-0.5">
                    <button onClick={openExternalPreview} className={ghostBtn} title="Open in new tab">
                      <ExternalLink size={15} />
                    </button>
                    <div className={`w-px h-4 mx-1 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                    {(['desktop', 'tablet', 'mobile'] as Device[]).map(d => (
                      <button
                        key={d}
                        onClick={() => setDevice(d)}
                        className={cn('w-8 h-8 flex items-center justify-center rounded-lg transition-colors', device === d ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-black/[0.06] text-neutral-900') : muted, hoverBg)}
                        title={`${d} view`}
                      >
                        {d === 'desktop' ? <Monitor size={15} /> : d === 'tablet' ? <Tablet size={15} /> : <Smartphone size={15} />}
                      </button>
                    ))}
                    <div className={`w-px h-4 mx-1 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                    <button onClick={() => setIsFullscreen(!isFullscreen)} className={ghostBtn} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen preview'}>
                      {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                    <button onClick={() => setIsPreviewVisible(false)} className={ghostBtn} title="Hide preview">
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Iframe Container */}
                <div className={`flex-1 flex justify-center overflow-auto relative ${isDark ? 'bg-[#111]' : 'bg-neutral-100'}`}>
                  {activeLanguage === 'web' ? (
                    <div className={cn('bg-white transition-all duration-300 h-full', device === 'mobile' ? 'w-[375px] border-x border-black/10' : device === 'tablet' ? 'w-[768px] border-x border-black/10' : 'w-full')}>
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
                    <div className={`w-full h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto ${muted}`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 border ${border}`}>
                        <Terminal size={22} />
                      </div>
                      <h3 className={`text-[14px] font-medium mb-1 ${fg}`}>{LANGUAGE_CONFIGS[activeLanguage as Exclude<Language, 'web'>].label} mode</h3>
                      <p className="text-[12.5px]">This language needs a backend runtime. Results appear in the console below.</p>
                      <button
                        onClick={runCode}
                        disabled={isRunning}
                        className="mt-4 px-5 py-2 rounded-full text-[12.5px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                      >
                        {isRunning ? 'Running…' : `Run ${activeLanguage}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Console Resize Handle */}
            {!isFullscreen && isPreviewVisible && isConsoleVisible && window.innerWidth >= 1024 && (
              <div
                className={`h-1 cursor-row-resize z-30 transition-colors relative ${isDark ? 'hover:bg-white/25' : 'hover:bg-black/25'}`}
                onMouseDown={() => setIsDragging('vertical')}
              >
                <div className="absolute inset-x-0 -top-2 -bottom-2 cursor-row-resize z-40" />
              </div>
            )}

            {/* Console Panel */}
            {isConsoleVisible && !isFullscreen && (activeOutputTab === 'console' || window.innerWidth >= 1024) && (
              <div
                className={cn('flex flex-col shrink-0 transition-all border-t', border, window.innerWidth < 1024 ? 'flex-1' : '', isDark ? 'bg-[#171717]' : 'bg-neutral-50')}
                style={window.innerWidth >= 1024 && isPreviewVisible && activeLanguage === 'web' ? { height: `${consoleHeight}px` } : { flex: 1 }}
              >
                <div className={`h-9 flex items-center justify-between px-3 border-b ${border}`}>
                  <span className={`flex items-center gap-1.5 text-[11.5px] font-medium ${muted}`}>
                    <Terminal size={12} /> Console
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={clearConsole} className={`px-2 py-1 rounded-md text-[11px] transition-colors ${muted} ${hoverBg}`}>
                      Clear
                    </button>
                    <button onClick={() => setIsConsoleVisible(false)} className={ghostBtn} title="Hide console">
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {activeLanguage !== 'web' && (
                  <div className={`border-b px-3 py-2 ${border}`}>
                    <label className={`block text-[11px] mb-1 ${muted}`}>Program input (stdin)</label>
                    <textarea
                      value={programInput}
                      onChange={(e) => setProgramInput(e.target.value)}
                      rows={2}
                      placeholder="Values for scanf / input() / readLine()…"
                      className={`w-full rounded-lg px-2.5 py-1.5 text-[12px] border outline-none resize-y font-mono ${isDark ? 'bg-[#212121] border-white/10 text-neutral-200 placeholder:text-neutral-600' : 'bg-white border-black/10 text-neutral-800 placeholder:text-neutral-400'}`}
                    />
                  </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 font-mono text-[12px] space-y-0.5">
                  {logs.length === 0 && (
                    <div className={`italic p-1.5 ${muted}`}>Console is empty. Run code to see logs.</div>
                  )}
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-2 px-1.5 py-0.5">
                      <span className={`shrink-0 ${muted}`}>[{log.timestamp}]</span>
                      <span className={cn(
                        'break-all whitespace-pre-wrap',
                        log.type === 'error' ? 'text-red-500' :
                          log.type === 'warn' ? 'text-amber-500' :
                            log.type === 'info' ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-neutral-300' : 'text-neutral-700')
                      )}>
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
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-fadeIn">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border ${border}`}>
              <Layout size={24} className={muted} />
            </div>
            <h2 className={`text-[15px] font-medium mb-1 ${isDark ? 'text-white' : 'text-neutral-900'}`}>Workspace is empty</h2>
            <p className={`text-[13px] max-w-xs mb-5 ${muted}`}>You hid all panels. Restore them to continue.</p>
            <button
              onClick={() => { setIsEditorVisible(true); setIsPreviewVisible(true); setIsConsoleVisible(true); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all active:scale-[0.98] bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              <Eye size={15} /> Show everything
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
