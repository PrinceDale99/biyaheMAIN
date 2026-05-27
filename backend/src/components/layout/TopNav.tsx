import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'firebase/auth';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LiveClock } from '@/components/ui/LiveClock';

interface TopNavProps {
  user: User | null;
  reputation: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  handleSignOut: () => void;
}

export function TopNav({
  user,
  reputation,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  handleSignOut
}: TopNavProps) {
  return (
    <header className="p-3 md:p-6 lg:p-8 relative z-50">
      <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row items-center gap-3 md:gap-6">
        
        {/* Top Row on Mobile: Logo & User */}
        <div className="flex w-full md:w-auto justify-between items-center">
          {/* Logo Group */}
          <div className="flex items-center gap-3 md:gap-5">
          <Link href="/" className="relative group">
            <div className="absolute inset-0 bg-teal-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="relative bg-slate-900 border border-teal-500/30 p-2 md:p-3 rounded-xl md:rounded-2xl">
              <svg className="w-5 h-5 md:w-7 md:h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-3xl font-black tracking-tighter leading-none bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">BIYAHE</h1>
            <div className="flex items-center gap-2 md:gap-3">
              <StatusBadge label="System Operational" />
              <div className="w-px h-3 bg-white/10" />
              <LiveClock />
            </div>
          </div>
          </div>

          {/* User Interface (Mobile) */}
          <div className="flex md:hidden items-center gap-2">
            {!user ? (
              <Link href="/auth/signin" className="px-4 py-1.5 text-xs font-bold text-slate-400 border border-white/10 rounded-lg">Log In</Link>
            ) : (
              <button onClick={handleSignOut} className="relative group">
                <div className="w-8 h-8 rounded-lg border border-teal-500/30 overflow-hidden">
                  <Image src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} width={32} height={32} alt="Avatar" />
                </div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-500 border-2 border-[#020617] rounded-full" />
              </button>
            )}
          </div>
        </div>

        {/* Smart Search */}
        <div className="flex-1 w-full max-w-2xl relative group">
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3.5 flex items-center gap-4 group-focus-within:border-teal-500 transition-all shadow-2xl">
            <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Where are you commuting to? (Terminal, Station, Landmark...)"
              className="bg-transparent text-sm w-full outline-none placeholder:text-slate-500 font-medium"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-slate-500 font-mono">
              ⌘ K
            </kbd>
          </div>
        </div>

        {/* User Interface (Desktop) */}
        <div className="hidden md:flex items-center gap-4">
          {!user ? (
            <div className="flex items-center gap-3">
              <Link href="/auth/signin" className="px-5 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">Log In</Link>
              <Link href="/auth/signup" className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-black rounded-xl transition-all shadow-lg shadow-teal-500/20 active:scale-95">Sign Up</Link>
            </div>
          ) : (
            <div className="flex items-center gap-5 bg-slate-900/80 backdrop-blur-xl border border-white/5 px-4 py-2 rounded-2xl">
              {user.email === "princedalelimosnero@gmail.com" && (
                <Link href="/admin" className="text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest border border-indigo-500/30 px-3 py-1.5 rounded-xl bg-indigo-500/10 shadow-lg shadow-indigo-500/10">
                  Admin
                </Link>
              )}
              <div className="flex flex-col items-end">
                <p className="text-[10px] font-mono text-slate-500 uppercase">Reputation Score</p>
                <p className="text-xs font-black text-teal-400">{reputation.toFixed(1)}%</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <button onClick={handleSignOut} className="relative group">
                <div className="w-10 h-10 rounded-xl border border-teal-500/30 overflow-hidden group-hover:border-teal-400 transition-all">
                  <Image
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                    width={40} height={40} alt="Avatar"
                    className="group-hover:scale-110 transition-transform"
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 border-2 border-[#020617] rounded-full" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
