'use client';

import React, { useState, useEffect } from 'react';

export function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex flex-col items-start md:items-center font-mono">
      <div className="text-teal-400 text-sm md:text-base font-black tracking-widest leading-none">
        {formatTime(time)}
      </div>
      <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter mt-0.5">
        {formatDate(time)}
      </div>
    </div>
  );
}
