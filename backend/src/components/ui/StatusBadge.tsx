import React from 'react';

interface StatusBadgeProps {
  label: string;
  status?: 'online' | 'offline' | 'warning';
  className?: string;
}

export function StatusBadge({ label, status = 'online', className = '' }: StatusBadgeProps) {
  const statusColors = {
    online: 'bg-teal-500',
    offline: 'bg-red-500',
    warning: 'bg-amber-500',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`w-2 h-2 rounded-full ${statusColors[status]} ${status === 'online' ? 'animate-pulse' : ''}`} />
      <p className="text-[10px] text-teal-400 font-mono font-bold tracking-widest uppercase">{label}</p>
    </div>
  );
}
