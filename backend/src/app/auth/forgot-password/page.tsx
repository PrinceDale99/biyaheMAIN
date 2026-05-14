"use client";

import { useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setSubmitted(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to send recovery email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#12181B] text-white flex items-center justify-center p-6 overflow-hidden">
      {/* Background Map Overlay */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url("https://maps.googleapis.com/maps/api/staticmap?center=14.6,121.0&zoom=12&size=1000x1000&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-[40px] p-10 shadow-2xl">
          {!submitted ? (
            <>
              <div className="text-center mb-10">
                <div className="inline-flex bg-teal-500/20 p-3 rounded-2xl border border-teal-500/30 mb-8">
                  <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Recover Account</h1>
                <p className="text-white/50 text-sm mt-3">Enter your email and we&apos;ll send you recovery instructions</p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-xs p-4 rounded-xl mb-6">
                  {error}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="juan.delacruz@email.com"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-teal-500/50 transition-colors"
                    required
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 bg-teal-600 hover:bg-teal-500 transition-all rounded-2xl font-bold shadow-lg shadow-teal-900/40 active:scale-[0.98] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? "Sending..." : "Send Recovery Link"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="inline-flex bg-green-500/20 p-3 rounded-2xl border border-green-500/30 mb-8">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Email Sent</h1>
              <p className="text-white/50 text-sm mt-4">Check your inbox for the recovery link. If you don&apos;t see it, check your spam folder.</p>
              <Link href="/auth/signin">
                <button 
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 transition-all rounded-2xl font-bold mt-10"
                >
                  Back to Sign In
                </button>
              </Link>
            </div>
          )}

          {!submitted && (
            <div className="mt-8 text-center">
              <Link href="/auth/signin" className="text-xs text-white/30 hover:text-teal-400 transition-colors uppercase font-bold tracking-widest">Back to Login</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
