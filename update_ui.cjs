const fs = require('fs');
const file = 'c:/chatapp/components/VSCodeCompiler.tsx';
let code = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// The replacement start marker
const startMarker = '  return (\n    <div className="flex flex-col h-screen bg-[#0f172a]/95 backdrop-blur-xl text-gray-300 font-sans overflow-hidden border border-white/5 shadow-2xl">';
const endMarker = '\n    </div>\n  );\n}';

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);

if (startIdx === -1) {
    console.error("Start Marker not found");
    process.exit(1);
}
if (endIdx === -1) {
    console.error("End Marker not found");
    process.exit(1);
}

const endMarkerComplete = endIdx + endMarker.length;

const newReturnBlock = `  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-[#cccccc] font-sans overflow-hidden select-none">
      {/* --- Title Bar --- */}
      <div className="h-9 flex items-center justify-between px-3 bg-[#333333] border-b border-[#252526] shrink-0 text-[11px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-1 rounded transition-colors" onClick={onClose}>
            <img src="/assets/logo.webp" alt="CodeADK" className="w-5 h-5 rounded" />
            <span className="font-semibold text-gray-300">CodeADK</span>
          </div>
          {/* File Menu Placeholder */}
          <div className="hidden sm:flex items-center gap-1 text-gray-400">
            <span className="px-2 py-1 hover:bg-white/10 rounded cursor-pointer">File</span>
            <span className="px-2 py-1 hover:bg-white/10 rounded cursor-pointer">Edit</span>
            <span className="px-2 py-1 hover:bg-white/10 rounded cursor-pointer">View</span>
            <span className="px-2 py-1 hover:bg-white/10 rounded cursor-pointer">Run</span>
            <span className="px-2 py-1 hover:bg-white/10 rounded cursor-pointer" onClick={() => setIsConsoleVisible(!isConsoleVisible)}>Terminal</span>
          </div>
        </div>
        
        {/* Command Palette / Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 items-center bg-[#252526] border border-[#3c3c3c] rounded-md h-6 px-2 text-gray-400 hover:bg-[#2d2d2d] cursor-pointer">
          <Search size={12} className="mr-2" />
          <span className="flex-1 text-center truncate">{activeLanguage === 'web' ? 'CodeAdk Workspace' : \`\${LANGUAGE_CONFIGS[activeLanguage].label} Workspace\`}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={runCode} disabled={isRunning} className={cn("p-1.5 rounded hover:bg-white/10 transition-colors", isRunning ? "text-gray-500" : "text-green-400")} title="Run Code">
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400">
            <Layout size={16} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded hover:bg-red-500/80 hover:text-white transition-colors text-gray-400 ml-2">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* --- Main Workspace --- */}
      <div className="flex flex-1 overflow-hidden relative" ref={containerRef}>
        
        {/* Activity Bar */}
        <div className="w-12 bg-[#333333] flex flex-col items-center py-2 shrink-0 border-r border-[#252526] z-20 gap-4">
          <button onClick={() => { setActiveActivity('files'); setIsExplorerVisible(true); }} className={cn("p-2 rounded-xl relative", activeActivity === 'files' ? "text-white" : "text-gray-500 hover:text-gray-300")}>
            <Files size={24} strokeWidth={1.5} />
            {activeActivity === 'files' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-blue-500 rounded-r-full" />}
          </button>
          <button onClick={() => { setActiveActivity('search'); setIsExplorerVisible(true); }} className={cn("p-2 rounded-xl relative", activeActivity === 'search' ? "text-white" : "text-gray-500 hover:text-gray-300")}>
            <Search size={24} strokeWidth={1.5} />
            {activeActivity === 'search' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-blue-500 rounded-r-full" />}
          </button>
          <button className="p-2 rounded-xl text-gray-500 hover:text-gray-300">
            <GitBranch size={24} strokeWidth={1.5} />
          </button>
          <div className="flex-1" />
          <button className="p-2 rounded-xl text-gray-500 hover:text-gray-300">
            <Settings size={24} strokeWidth={1.5} />
          </button>
        </div>

        {/* Side Bar (Explorer) */}
        {isExplorerVisible && (
          <div className="w-64 bg-[#252526] flex flex-col shrink-0 border-r border-[#333] z-10 transition-all">
            <div className="h-9 px-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-400 shrink-0">
              <span>EXPLORER</span>
              <button onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)} className="p-1 hover:bg-[#3c3c3c] rounded" title="Theme">
                 <Palette size={14} />
              </button>
            </div>
            
             {/* Theme Menu logic within Explorer sidebar as popup (simplified) */}
             {isThemeMenuOpen && (
               <div className="mx-2 mb-2 p-2 bg-[#1e1e1e] border border-[#333] rounded">
                 {(['vs-dark', 'vs', 'github-dark', 'github-light', 'monokai'] as Theme[]).map((t) => (
                    <button key={t} onClick={() => { setActiveTheme(t); writeString('codeadk_theme', t, { persist: 'both' }); setIsThemeMenuOpen(false); }} className={cn("block w-full text-left text-xs p-1 hover:bg-[#2d2d2d]", activeTheme === t && "text-blue-400")}>
                      {t}
                    </button>
                  ))}
               </div>
             )}

            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center px-4 py-1 hover:bg-[#2a2d2e] cursor-pointer text-sm font-semibold text-gray-300">
                <ChevronDown size={14} className="mr-1" />
                <span>CODEADK</span>
              </div>
              <div className="pl-6 space-y-0.5 mt-1">
                {activeLanguage === 'web' ? (
                  <>
                    <div onClick={() => setActiveTab('html')} className={cn("flex items-center px-2 py-1 text-sm cursor-pointer", activeTab === 'html' ? "bg-[#37373d] text-white" : "text-gray-400 hover:bg-[#2a2d2e]")}>
                      <span className="text-orange-500 mr-2">&lt;/&gt;</span> index.html
                    </div>
                    <div onClick={() => setActiveTab('css')} className={cn("flex items-center px-2 py-1 text-sm cursor-pointer", activeTab === 'css' ? "bg-[#37373d] text-white" : "text-gray-400 hover:bg-[#2a2d2e]")}>
                      <span className="text-blue-400 mr-2">#</span> style.css
                    </div>
                    <div onClick={() => setActiveTab('js')} className={cn("flex items-center px-2 py-1 text-sm cursor-pointer", activeTab === 'js' ? "bg-[#37373d] text-white" : "text-gray-400 hover:bg-[#2a2d2e]")}>
                      <span className="text-yellow-400 mr-2">JS</span> script.js
                    </div>
                  </>
                ) : (
                  <div onClick={() => setActiveTab('code')} className={cn("flex items-center px-2 py-1 text-sm cursor-pointer", activeTab === 'code' ? "bg-[#37373d] text-white" : "text-gray-400 hover:bg-[#2a2d2e]")}>
                     <FileCode size={14} className="text-blue-400 mr-2" /> main.{activeLanguage === 'python' ? 'py' : activeLanguage === 'rust' ? 'rs' : activeLanguage === 'kotlin' ? 'kt' : activeLanguage === 'csharp' ? 'cs' : activeLanguage === 'typescript' ? 'ts' : activeLanguage}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center px-4 py-1 hover:bg-[#2a2d2e] cursor-pointer text-sm font-semibold text-gray-300">
                <ChevronRight size={14} className="mr-1" />
                <span>ENVIRONMENT</span>
              </div>
              <div className="pl-6 pr-2 mt-1">
                 <button onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)} className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 border border-[#333] bg-[#1e1e1e] p-1.5 rounded">
                   <span>{LANGUAGE_CONFIGS[activeLanguage === 'web' ? 'python' : activeLanguage]?.label || 'Web'}</span>
                   <ChevronDown size={12} />
                 </button>
                 {isLanguageMenuOpen && (
                    <div className="mt-1 bg-[#1e1e1e] border border-[#333] rounded overflow-hidden">
                       <button onClick={() => { setActiveLanguage('web'); setActiveTab('html'); setIsLanguageMenuOpen(false); }} className="block w-full text-left text-xs p-1.5 hover:bg-[#2d2d2d]">Web (HTML/CSS/JS)</button>
                       {Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => (
                         <button key={key} onClick={() => { setActiveLanguage(key as Exclude<Language, 'web'>); setActiveTab('code'); setIsLanguageMenuOpen(false); }} className="block w-full text-left text-xs p-1.5 hover:bg-[#2d2d2d]">{config.label}</button>
                       ))}
                    </div>
                 )}
              </div>
            </div>
          </div>
        )}

        {/* Editor Group Component */}
        <div className="flex flex-col flex-1 min-w-0 bg-[#1e1e1e] relative">
          
          {/* Tabs header */}
          {isEditorVisible && (
            <div className="flex h-9 bg-[#2d2d2d] shrink-0 border-b border-[#1e1e1e] group overflow-x-auto scrollbar-hide">
              {activeLanguage === 'web' ? (
                (['html', 'css', 'js'] as Tab[]).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-4 py-2 text-xs font-medium border-t-2 items-center gap-2 flex transition-colors", activeTab === tab ? "bg-[#1e1e1e] text-blue-400 border-blue-500" : "bg-[#2d2d2d] text-gray-500 border-transparent hover:bg-[#2d2d2d] hover:text-gray-300")}>
                    {tab === 'html' && <span className="text-orange-500">&lt;/&gt;</span>}
                    {tab === 'css' && <span className="text-blue-400">#</span>}
                    {tab === 'js' && <span className="text-yellow-400">JS</span>}
                    {tab === 'html' ? 'index.html' : tab === 'css' ? 'style.css' : 'script.js'}
                    <span onClick={(e) => { e.stopPropagation(); setIsEditorVisible(false); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#333] rounded ml-2"><X size={12}/></span>
                  </button>
                ))
              ) : (
                 <div className="px-4 py-2 text-xs font-medium border-t-2 items-center gap-2 flex bg-[#1e1e1e] text-blue-400 border-blue-500">
                    <FileCode size={14} /> main.{activeLanguage === 'python' ? 'py' : activeLanguage === 'rust' ? 'rs' : activeLanguage === 'kotlin' ? 'kt' : activeLanguage === 'csharp' ? 'cs' : activeLanguage === 'typescript' ? 'ts' : activeLanguage}
                    <span onClick={(e) => { e.stopPropagation(); setIsEditorVisible(false); }} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#333] rounded ml-2 cursor-pointer"><X size={12}/></span>
                 </div>
              )}
               <div className="flex-1 bg-[#252526] flex items-center justify-end px-2 border-b border-[#252526]">
                 <button onClick={explainCode} className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 mr-2" disabled={isExplaining || !currentUser} title={currentUser ? "Explain Code" : "Locked"}>
                    <Sparkles size={14} className={isExplaining ? "animate-pulse" : ""} /> {isExplaining ? "Explaining..." : "Explain"}
                 </button>
                 <button onClick={loadTemplate} className="p-1.5 hover:bg-[#333] rounded text-gray-400" title="Load Template"><RefreshCw size={14} /></button>
                 <button className="p-1.5 hover:bg-[#333] rounded text-gray-400" title="More"><MoreHorizontal size={14} /></button>
               </div>
            </div>
          )}

          {/* Editor and panel view */}
          <div className="flex flex-col flex-1 relative overflow-hidden">
            {/* Monaco Editor Wrapper */}
            {isEditorVisible && (
              <div className="flex-1 relative min-h-0 bg-[#1e1e1e]" style={{ height: (isPreviewVisible || isConsoleVisible) && !isFullscreen ? \`\${100 - (consoleHeight/(window.innerHeight)*100)}%\` : '100%' }}>
                  <Editor
                    height="100%"
                    language={getLanguage()}
                    value={getEditorValue()}
                    onChange={handleEditorChange}
                    theme={activeTheme}
                    beforeMount={handleBeforeMount}
                    onMount={handleEditorMount}
                    options={{
                      minimap: { enabled: true },
                      fontSize: 14,
                      wordWrap: 'on',
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      padding: { top: 16 },
                      renderLineHighlight: 'none',
                      mouseWheelZoom: true,
                      tabCompletion: 'on',
                      suggestOnTriggerCharacters: true,
                    }}
                  />
              </div>
            )}

            {/* Resize Handle for Bottom Panel */}
            {!isFullscreen && (isPreviewVisible || isConsoleVisible) && (
              <div className="h-1 bg-[#252526] hover:bg-blue-500 cursor-row-resize z-10" onMouseDown={() => setIsDragging('vertical')} />
            )}

            {/* Bottom Panel (Terminal/Console/Preview) */}
            {(isPreviewVisible || isConsoleVisible) && !isFullscreen && (
               <div className="flex flex-col bg-[#1e1e1e] border-t border-[#333] overflow-hidden" style={{ height: isEditorVisible ? \`\${consoleHeight}px\` : '100%' }}>
                 {/* Panel Tabs */}
                 <div className="flex items-center px-4 h-9 border-b border-[#252526] bg-[#1e1e1e] gap-4">
                    <button onClick={() => { setActiveOutputTab('problems'); setIsConsoleVisible(true); }} className={cn("text-xs font-semibold uppercase tracking-wide pb-2 border-b-2 pt-2", activeOutputTab === 'problems' ? "border-white text-white" : "border-transparent text-gray-400 hover:text-gray-300")}>Problems <span className="text-[10px] bg-red-400/20 text-red-500 px-1.5 rounded-full ml-1 font-bold">{logs.filter(l => l.type==='error').length}</span></button>
                    <button onClick={() => { setActiveOutputTab('console'); setIsConsoleVisible(true); }} className={cn("text-xs font-semibold uppercase tracking-wide pb-2 border-b-2 pt-2", activeOutputTab === 'console' ? "border-white text-white" : "border-transparent text-gray-400 hover:text-gray-300")}>Output</button>
                    {activeLanguage === 'web' && (
                      <button onClick={() => { setActiveOutputTab('preview'); setIsPreviewVisible(true); }} className={cn("text-xs font-semibold uppercase tracking-wide pb-2 border-b-2 pt-2", activeOutputTab === 'preview' ? "border-white text-white" : "border-transparent text-gray-400 hover:text-gray-300")}>Preview</button>
                    )}
                    <button onClick={() => { setActiveOutputTab('terminal'); setIsConsoleVisible(true); }} className={cn("text-xs font-semibold uppercase tracking-wide pb-2 border-b-2 pt-2", activeOutputTab === 'terminal' ? "border-white text-white" : "border-transparent text-gray-400 hover:text-gray-300")}>Terminal</button>
                    
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                       <button onClick={clearConsole} className="p-1 text-gray-500 hover:text-white rounded" title="Clear Console"><Trash2 size={14} /></button>
                       <button onClick={() => { setIsConsoleVisible(false); setIsPreviewVisible(false); }} className="p-1 text-gray-500 hover:text-white rounded" title="Close Panel"><X size={14} /></button>
                    </div>
                 </div>

                 {/* Panel Body */}
                 <div className="flex-1 overflow-auto bg-[#1e1e1e]">
                   {activeOutputTab === 'console' && (
                     <div className="p-4 font-mono text-xs space-y-1 h-full overflow-y-auto">
                        {logs.length === 0 ? <div className="text-gray-600">No output.</div> : logs.map(log => (
                          <div key={log.id} className="flex gap-2 text-gray-300">
                            <span className={cn("whitespace-pre-wrap break-all", log.type === 'error' ? "text-red-400" : log.type === 'warn' ? "text-yellow-400" : log.type === 'info' ? "text-blue-400" : "")}>
                               {log.type === 'error' && '❌ '}
                               {log.type === 'warn' && '⚠️ '}
                               {log.message}
                            </span>
                          </div>
                        ))}
                     </div>
                   )}
                   {activeOutputTab === 'problems' && (
                      <div className="p-4 font-mono text-xs space-y-1 h-full overflow-y-auto">
                         {logs.filter(l => l.type === 'error').length === 0 ? <div className="text-gray-600">No problems have been detected in the workspace.</div> : logs.filter(l => l.type === 'error').map(log => (
                           <div key={log.id} className="flex gap-2 text-red-400">
                             <XCircle size={14} className="shrink-0 mt-0.5" />
                             <span className="whitespace-pre-wrap break-all">{log.message}</span>
                           </div>
                         ))}
                      </div>
                   )}
                   {activeOutputTab === 'terminal' && (
                      <div className="p-4 font-mono text-xs text-gray-300 h-full">
                         <div className="text-gray-500 mb-2">CodeADK Terminal Integrated Environment</div>
                         <div>$ {isRunning ? \`Compiling \${activeLanguage} code...\` : \`Ready to run \${activeLanguage} process.\`}</div>
                      </div>
                   )}
                   {activeOutputTab === 'preview' && activeLanguage === 'web' && (
                      <div className="w-full h-full bg-white relative">
                         <div className="absolute top-2 right-2 flex gap-1 bg-[#1e1e1e] p-1 rounded-md opacity-50 hover:opacity-100 z-50 transition-opacity">
                            <button onClick={openExternalPreview} className="text-white hover:text-blue-400 p-1"><ExternalLink size={14}/></button>
                            <button onClick={() => setDevice('desktop')} className={cn("text-white hover:text-blue-400 p-1", device === 'desktop' && "bg-[#333]")}><Monitor size={14}/></button>
                            <button onClick={() => setDevice('tablet')} className={cn("text-white hover:text-blue-400 p-1", device === 'tablet' && "bg-[#333]")}><Tablet size={14}/></button>
                            <button onClick={() => setDevice('mobile')} className={cn("text-white hover:text-blue-400 p-1", device === 'mobile' && "bg-[#333]")}><Smartphone size={14}/></button>
                         </div>
                         <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e]">
                            <div className={cn("bg-white transition-all h-full", device === 'mobile' ? 'w-[375px]' : device === 'tablet' ? 'w-[768px]' : 'w-full')}>
                              <iframe key={srcDoc} ref={iframeRef} title="preview" srcDoc={srcDoc} className="w-full h-full border-0" sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups allow-presentation" />
                            </div>
                         </div>
                      </div>
                   )}
                 </div>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* --- AI Explanation Modal --- */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#252526] border border-[#333] rounded shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#1e1e1e]">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-white">AI Code Explanation</h3>
              </div>
              <button onClick={() => setShowExplanationModal(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 text-sm">
              {isExplaining ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 size={32} className="text-purple-500 animate-spin" />
                  <p className="text-gray-400">Analyzing your code...</p>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-gray-300 leading-relaxed font-mono text-xs">{explanation}</div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#333] bg-[#1e1e1e]">
              <button onClick={() => { navigator.clipboard.writeText(explanation) }} disabled={isExplaining || !explanation} className="px-3 py-1.5 bg-[#333] hover:bg-[#444] text-white rounded text-xs transition-colors">Copy</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Status Bar --- */}
      <div className="h-[22px] bg-[#007acc] hover:bg-[#005f9e] transition-colors text-white flex items-center justify-between px-2 text-[10px] font-medium shrink-0 z-30 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer"><GitBranch size={12} /> main*</div>
          <div className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">
            <XCircle size={12} className={logs.filter(l=>l.type==='error').length > 0 ? "text-white" : "opacity-70"} /> {logs.filter(l=>l.type==='error').length}
            <AlertTriangle size={12} className={logs.filter(l=>l.type==='warn').length > 0 ? "text-white ml-1" : "opacity-70 ml-1"} /> {logs.filter(l=>l.type==='warn').length}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">Ln 1, Col 1</div>
          <div className="hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">Spaces: 2</div>
          <div className="hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer">UTF-8</div>
          <div className="hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer capitalize">{activeLanguage === 'web' ? 'HTML' : activeLanguage}</div>
          <div className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer"><CheckCheck size={12} /> Prettier</div>
          <div className="flex items-center gap-1 hover:bg-white/20 px-1 py-0.5 rounded cursor-pointer"><Code size={12} /></div>
        </div>
      </div>
      
    </div>
  );
}`;

const replaced = code.substring(0, startIdx) + newReturnBlock + code.substring(endMarkerComplete);
fs.writeFileSync(file, replaced, 'utf8');
console.log('Update completed successfully.');
