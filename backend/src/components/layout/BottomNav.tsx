import React from 'react';
import Link from 'next/link';

interface BottomNavProps {
  activeTab?: string;
}

export function BottomNav({ activeTab = 'Map' }: BottomNavProps) {
  return (
    <nav className="p-6 md:p-8 flex justify-center relative z-50">
      <div className="bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-2 flex items-center gap-1 shadow-2xl">
        <Link href="/">
          <NavItem icon="explore" label="Map" active={activeTab === 'Map'} />
        </Link>
        <Link href="/">
          <NavItem icon="routes" label="Routes" active={activeTab === 'Routes'} />
        </Link>
        
        <Link href="/contribute">
          <div className="mx-2 p-4 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-full transition-all active:scale-90 shadow-lg shadow-teal-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
          </div>
        </Link>

        <Link href="/rewards">
          <NavItem icon="rewards" label="Rewards" active={activeTab === 'Rewards'} />
        </Link>
        
        <Link href="/chat">
          <NavItem icon="chat" label="Assistant" active={activeTab === 'Assistant'} />
        </Link>
      </div>
    </nav>
  );
}

function NavItem({ icon, label, active = false }: { icon: string; label: string; active?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 px-6 py-3 rounded-[2rem] transition-all cursor-pointer group ${active ? 'bg-teal-500/10 text-teal-400' : 'text-slate-500 hover:text-white'}`}>
      <div className="relative">
        {active && <div className="absolute inset-0 bg-teal-500 blur-md opacity-40 animate-pulse" />}
        <svg className="relative w-5 h-5 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon === 'explore' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />}
          {icon === 'routes' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />}
          {icon === 'rewards' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
          {icon === 'chat' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />}
        </svg>
      </div>
      <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}
