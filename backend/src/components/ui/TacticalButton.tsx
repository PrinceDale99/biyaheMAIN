import React from 'react';

interface TacticalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  fullWidth?: boolean;
}

export function TacticalButton({ 
  children, 
  className = '', 
  variant = 'primary', 
  fullWidth = false,
  ...props 
}: TacticalButtonProps) {
  const variantClasses = {
    primary: 'tactical-button-primary',
    outline: 'tactical-button-outline',
    ghost: 'tactical-button hover:bg-white/5 text-slate-400 hover:text-white',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${variantClasses[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
