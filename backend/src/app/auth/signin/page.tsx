"use client";

import { useState } from "react";
import Link from "next/link";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    try {
      setError("");
      await signInWithPopup(auth, googleProvider);
      router.push("/"); // Redirect to dashboard
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to sign in with Google");
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: unknown) {
      setError("Invalid email or password");
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
          <div className="text-center mb-10">
            <div className="inline-flex bg-teal-500/20 p-3 rounded-2xl border border-teal-500/30 mb-6">
              <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 4H6a2 2 0 00-2 2v24h16V6a2 2 0 00-2-2h-2m-2 0h-4m-2 0h2" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
            <p className="text-white/50 text-sm mt-2">Sign in to your B.I.Y.A.H.E. account</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-xs p-4 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleEmailSignIn}>
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

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-teal-400 hover:text-teal-300">Forgot?</Link>
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-teal-500/50 transition-colors"
                required
              />
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-teal-600 hover:bg-teal-500 transition-all rounded-2xl font-bold shadow-lg shadow-teal-900/40 active:scale-[0.98]"
            >
              Sign In
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#12181B] px-4 text-white/20 font-bold tracking-widest">Or continue with</span></div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 transition-all rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm text-white/40">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="text-teal-400 font-bold hover:underline">Create One</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
