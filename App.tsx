
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessage, ChatSession, GenerationState, MessagePart } from './types';
import ChatMessageItem from './components/ChatMessageItem';
import Sidebar from './components/Sidebar';
import { generateTextResponse } from './services/geminiService';

const STORAGE_KEY = 'chat_with_adk_history';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.length > 0 ? parsed[0].id : '';
  });

  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<GenerationState>({
    isTyping: false,
    error: null,
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const currentSession = useMemo(() => 
    sessions.find(s => s.id === currentSessionId), 
    [sessions, currentSessionId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSession?.messages, status]);

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      messages: [{
        id: 'welcome',
        role: 'assistant',
        parts: [{ type: 'text', content: 'Hello! I am ChatWithAdk. How can I help you today?' }],
        timestamp: new Date().toISOString(),
      }],
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (currentSessionId === id) {
      setCurrentSessionId(updated.length > 0 ? updated[0].id : '');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || status.isTyping) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newId = Date.now().toString();
      const newSession: ChatSession = {
        id: newId,
        title: inputValue.trim().slice(0, 30) + (inputValue.length > 30 ? '...' : ''),
        messages: [],
        updatedAt: Date.now(),
      };
      setSessions([newSession]);
      setCurrentSessionId(newId);
      sessionId = newId;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: [{ type: 'text', content: inputValue.trim() }],
      timestamp: new Date().toISOString(),
    };

    updateSessionMessages(sessionId, (prev) => [...prev, userMessage], inputValue.trim());
    
    const currentInput = inputValue.trim();
    setInputValue('');
    setStatus(prev => ({ ...prev, isTyping: true, error: null }));

    try {
      const history = (currentSession?.messages || []).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.parts.map(p => p.content).join(' ') }]
      }));
      
      const responseText = await generateTextResponse(currentInput, history);
      addAssistantMessage(sessionId, [{ type: 'text', content: responseText }]);
    } catch (err) {
      setStatus(prev => ({ ...prev, error: "Connection lost. Please try again." }));
    } finally {
      setStatus(prev => ({ ...prev, isTyping: false }));
    }
  };

  const updateSessionMessages = (sessionId: string, updater: (prev: ChatMessage[]) => ChatMessage[], firstInput?: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const newMessages = updater(s.messages);
        return { 
          ...s, 
          messages: newMessages, 
          updatedAt: Date.now(),
          title: (s.title === 'New Conversation' && firstInput) ? (firstInput.slice(0, 30) + (firstInput.length > 30 ? '...' : '')) : s.title
        };
      }
      return s;
    }));
  };

  const addAssistantMessage = (sessionId: string, parts: MessagePart[]) => {
    const newMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      parts,
      timestamp: new Date().toISOString(),
    };
    updateSessionMessages(sessionId, prev => [...prev, newMessage]);
  };

  // Convert ISO timestamp string back to Date for the component
  const localizedMessages = useMemo(() => 
    (currentSession?.messages || []).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    })),
    [currentSession?.messages]
  );

  return (
    <div className="flex h-screen overflow-hidden text-slate-200">
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-950/20">
        {/* Header */}
        <header className="px-6 py-4 glass border-b border-white/5 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white"
            >
              <i className="fas fa-bars"></i>
            </button>
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <i className="fas fa-bolt text-white text-xl"></i>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">ChatWithAdk</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                  {currentSession?.title || 'Stable Connection'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button className="hover:text-white transition-colors"><i className="fas fa-cog"></i></button>
          </div>
        </header>

        {/* Main Chat Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 custom-scrollbar relative" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-2">
            {!currentSession && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-20 opacity-50">
                <i className="fas fa-comments text-6xl text-slate-800"></i>
                <h3 className="text-xl font-medium">Ready for a new adventure?</h3>
                <p className="text-sm text-slate-500 max-w-xs">Start a conversation or choose a recent chat from the sidebar.</p>
                <button 
                  onClick={handleNewChat}
                  className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 px-6 py-2 rounded-full text-sm font-semibold transition-all"
                >
                  Start Chatting
                </button>
              </div>
            )}
            
            {localizedMessages.map((msg) => (
              <ChatMessageItem 
                key={msg.id} 
                message={msg as any} 
              />
            ))}
            
            {status.isTyping && (
              <div className="flex items-start gap-2 mb-6 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                  <i className="fas fa-ellipsis"></i>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 px-4 py-2 rounded-2xl text-xs text-slate-400">
                  Processing prompt...
                </div>
              </div>
            )}

            {status.error && (
              <div className="flex justify-center my-4">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
                  <i className="fas fa-exclamation-triangle"></i>
                  {status.error}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Input Section */}
        <footer className="p-4 sm:p-6 bg-gradient-to-t from-slate-950 to-transparent shrink-0">
          <div className="max-w-3xl mx-auto relative">
            <form onSubmit={handleSend} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
              
              <div className="relative glass rounded-2xl p-1 flex items-center shadow-2xl">
                <input 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask anything..."
                  className="flex-1 bg-transparent border-none outline-none px-6 py-3 text-sm text-white placeholder:text-slate-500"
                  disabled={status.isTyping}
                />

                <button 
                  type="submit"
                  disabled={!inputValue.trim() || status.isTyping}
                  className="w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-blue-500/20 mr-1"
                >
                  <i className={`fas ${status.isTyping ? 'fa-circle-notch fa-spin' : 'fa-paper-plane'}`}></i>
                </button>
              </div>
            </form>
            
            <div className="flex justify-center gap-6 mt-4 text-[10px] font-bold text-slate-600 tracking-wider uppercase">
               <span className="flex items-center gap-1"><i className="fas fa-microchip text-blue-500"></i> Gemini 1.5 Flash</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default App;
