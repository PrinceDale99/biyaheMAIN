import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'teal';
}

export function GlassCard({ children, className = '', variant = 'default' }: GlassCardProps) {
  const variantClass = variant === 'teal' ? 'glass-card-teal' : 'glass-card';
  return (
    <div className={`${variantClass} ${className}`}>
      {children}
    </div>
  );
}
