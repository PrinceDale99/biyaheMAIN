'use client';

import { useState, useEffect, useRef } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard } from '@/components/ui/GlassCard';
import { TacticalButton } from '@/components/ui/TacticalButton';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your Biyahe assistant. How can I help you with your commute today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [reputation, setReputation] = useState(98.2);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const { ReputationEngine } = await import("@/lib/reputation");
        const score = await ReputationEngine.getScore(currentUser.uid);
        setReputation(score);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (!window.confirm("Are you sure you want to sign out?")) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) throw new Error('Request failed');

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col">
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative z-10 flex flex-col h-full">
        <TopNav 
          user={user} 
          reputation={reputation} 
          searchQuery="" 
          setSearchQuery={() => {}} 
          searchInputRef={searchInputRef}
          handleSignOut={handleSignOut}
        />

        <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 flex flex-col overflow-hidden">
          <GlassCard className="flex-1 flex flex-col overflow-hidden mb-6" variant="teal">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <h2 className="text-sm font-black uppercase tracking-widest text-teal-400">Chat Assistant</h2>
              </div>
              <span className="text-[10px] font-mono text-slate-500">CONNECTED</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-teal-500 text-slate-950 font-bold rounded-tr-none' 
                      : 'bg-slate-800/50 border border-white/10 text-slate-200 rounded-tl-none backdrop-blur-md'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-pulse">
                  <div className="bg-slate-800/50 border border-white/10 p-4 rounded-2xl rounded-tl-none">
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 bg-slate-900/50 border-t border-white/5 flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about routes, fares, or stations..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-teal-500 transition-all placeholder:text-slate-600 font-medium"
                disabled={isLoading}
              />
              <TacticalButton
                type="submit"
                variant="primary"
                disabled={isLoading}
                className="!px-6"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </TacticalButton>
            </form>
          </GlassCard>
        </main>

        <BottomNav activeTab="Assistant" />
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Outfit:wght@400;700;900&display=swap');
      `}</style>
    </div>
  );
}
