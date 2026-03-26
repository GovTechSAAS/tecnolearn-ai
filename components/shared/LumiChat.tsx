"use client";

import { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function LumiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { profile } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 'init', 
      role: 'assistant', 
      content: 'Olá! Eu sou o LUMI, seu assistente educacional de Inteligência Artificial. Como posso ajudar em seus estudos hoje?' 
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Map domain messages to simple role/content for the API
      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      const data = await res.json();

      if (res.ok) {
        setMessages(prev => [...prev, {
           id: (Date.now() + 1).toString(),
           role: 'assistant',
           content: data.reply
        }]);
      } else {
        setMessages(prev => [...prev, {
           id: (Date.now() + 1).toString(),
           role: 'assistant',
           content: `Desculpe, ocorreu um erro de comunicação: ${data.error}`
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
         id: (Date.now() + 1).toString(),
         role: 'assistant',
         content: 'Desculpe, não consegui me conectar aos servidores de IA no momento.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div 
        className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-in-out ${isOpen ? 'opacity-0 pointer-events-none scale-50' : 'opacity-100 scale-100'}`}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-[var(--accent)] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#D35400] hover:-translate-y-1 transition-all"
        >
          <div className="relative">
            <BrainCircuit size={28} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--accent)] animate-pulse"></span>
          </div>
        </button>
      </div>

      {/* Chat Panel */}
      <div 
        className={`fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[85vh] bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl flex flex-col z-50 border border-border overflow-hidden transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 pointer-events-none translate-y-10'}`}
      >
          {/* Header */}
          <div className="h-16 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] px-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                <BrainCircuit size={24} />
              </div>
              <div>
                <h3 className="font-bold leading-tight tracking-tight">LUMI IA</h3>
                <div className="flex items-center gap-1.5 text-xs text-white/90">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Online
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50 relative">
            {messages.map((msg, i) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] shrink-0 flex items-center justify-center text-white shadow-sm mt-1">
                    <BrainCircuit size={16} />
                  </div>
                )}
                {msg.role === 'user' && (
                   <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shadow-sm mt-1 font-bold text-xs uppercase">
                      {profile?.full_name?.charAt(0) || 'U'}
                   </div>
                )}
                <div 
                  className={`p-3 rounded-2xl text-sm shadow-sm max-w-[80%] whitespace-pre-wrap ${
                    msg.role === 'user' 
                      ? 'bg-[var(--accent)] text-white rounded-tr-none' 
                      : 'bg-white dark:bg-zinc-800 border border-border rounded-tl-none text-foreground'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
               <div className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] shrink-0 flex items-center justify-center text-white shadow-sm mt-1">
                   <BrainCircuit size={16} />
                 </div>
                 <div className="bg-white dark:bg-zinc-800 border border-border p-3 flex items-center justify-center rounded-2xl rounded-tl-none shadow-sm h-11 w-16">
                   <div className="flex space-x-1.5">
                     <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                     <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                     <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></div>
                   </div>
                 </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white dark:bg-zinc-950 border-t border-border shrink-0">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-center"
            >
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte ao LUMI..."
                className="w-full pl-4 pr-12 py-3 bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:bg-white dark:focus:bg-zinc-950 rounded-full text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)]/30 transition-all shadow-sm"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-1.5 w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[#D35400] disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 transition-colors"
               >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} className="ml-0.5" />}
              </button>
            </form>
          </div>
      </div>
    </>
  );
}
