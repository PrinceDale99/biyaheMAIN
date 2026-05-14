"use client";

import { useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to sign up with Google");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, {
        displayName: name
      });
      router.push("/");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create account");
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
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight">Join B.I.Y.A.H.E.</h1>
            <p className="text-white/50 text-sm mt-2">Start your journey with Metro Manila&apos;s smartest engine</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-xs p-4 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSignUp}>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Dela Cruz"
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-3.5 text-sm focus:outline-none focus:border-teal-500/50 transition-colors"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@email.com"
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-3.5 text-sm focus:outline-none focus:border-teal-500/50 transition-colors"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-3.5 text-sm focus:outline-none focus:border-teal-500/50 transition-colors"
                required
              />
            </div>

            <div className="flex items-center gap-3 py-2">
              <input type="checkbox" className="w-4 h-4 accent-teal-500 rounded border-white/10 bg-black/40" required />
              <label className="text-[10px] text-white/40 leading-tight">
                I agree to the <span className="text-teal-400">Terms of Service</span> and <span className="text-teal-400">Privacy Policy</span>.
              </label>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className={`w-full py-4 bg-teal-600 hover:bg-teal-500 transition-all rounded-2xl font-bold shadow-lg shadow-teal-900/40 mt-4 active:scale-[0.98] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-[#12181B] px-4 text-white/20 font-bold tracking-widest">Or continue with</span></div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleSignUp}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 transition-all rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </button>

            <p className="text-center text-sm text-white/40 mt-8">
              Already have an account?{" "}
              <Link href="/auth/signin" className="text-teal-400 font-bold hover:underline">Sign In</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
