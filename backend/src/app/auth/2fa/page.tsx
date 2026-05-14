"use client";

import { useState } from "react";
import Link from "next/link";

export default function TwoFactor() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);

  const handleChange = (index: number, value: string) => {
    if (value.length <= 1) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      
      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`digit-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-[#12181B] text-white flex items-center justify-center p-6 overflow-hidden">
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'url("https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/121.0,14.6,12/1000x1000?access_token=YOUR_TOKEN_HERE")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-[40px] p-10 shadow-2xl text-center">
          <div className="inline-flex bg-teal-500/20 p-3 rounded-2xl border border-teal-500/30 mb-8">
            <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight">Two-Factor Auth</h1>
          <p className="text-white/50 text-sm mt-3">We've sent a 6-digit code to your registered device</p>

          <div className="flex justify-between gap-2 my-10">
            {code.map((digit, i) => (
              <input 
                key={i}
                id={`digit-${i}`}
                type="text" 
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                className="w-12 h-16 bg-black/40 border border-white/10 rounded-xl text-center text-2xl font-bold focus:outline-none focus:border-teal-500 transition-colors"
              />
            ))}
          </div>

          <button className="w-full py-4 bg-teal-600 hover:bg-teal-500 transition-all rounded-2xl font-bold shadow-lg shadow-teal-900/40 mb-6">
            Verify & Continue
          </button>

          <p className="text-xs text-white/40">
            Didn't receive the code?{" "}
            <span className="text-teal-400 cursor-pointer hover:underline font-bold">Resend in 0:59</span>
          </p>
        </div>
      </div>
    </div>
  );
}
