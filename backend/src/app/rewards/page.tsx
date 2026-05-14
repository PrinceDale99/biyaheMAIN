'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function RewardsPage() {
  const [user, setUser] = useState<any>(null);
  const [reputation, setReputation] = useState<number>(0);
  const [points, setPoints] = useState<number>(0);
  const [totalClaimed, setTotalClaimed] = useState<number>(0);
  const [stellarAddress, setStellarAddress] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Listen to reputation and points changes
        const unsubscribeDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setReputation(data.reputation || 0);
            setPoints(data.points || 0);
            setTotalClaimed(data.totalClaimed || 0);
            setStellarAddress(data.stellarAddress || '');
          }
          setLoading(false);
        });
        return () => unsubscribeDoc();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleClaim = async () => {
    if (!stellarAddress) {
      setMessage({ text: 'Please enter a valid Stellar G-address', type: 'error' });
      return;
    }

    setClaiming(true);
    setMessage(null);

    try {
      const response = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          stellarAddress: stellarAddress
        })
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ text: result.message, type: 'success' });
      } else {
        setMessage({ text: result.error || 'Failed to claim rewards', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Network error occurred', type: 'error' });
    } finally {
      setClaiming(false);
    }
  };

  const isLocked = reputation < 75;
  const claimablePoints = Math.max(0, points - totalClaimed);
  const claimableTokens = Math.floor(claimablePoints * 10);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-teal-500"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-400">Please authenticate to access the rewards terminal.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        {/* Tactical Header */}
        <div className="border-l-4 border-teal-500 pl-4 mb-12">
          <h1 className="text-4xl font-black tracking-tighter uppercase">Reward Terminal</h1>
          <p className="text-teal-500 text-sm tracking-widest">UPLINK STATUS: SECURE // OPERATIVE: {user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Stats Section */}
          <div className="space-y-6">
            <div className={`bg-[#111113] border p-6 rounded-lg backdrop-blur-md transition-all ${isLocked ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-teal-500/30'}`}>
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-gray-400 text-xs uppercase tracking-widest">Trust Score</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isLocked ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'}`}>
                  {isLocked ? 'UNTRUSTED_LINK' : 'STABLE_UPLINK'}
                </span>
              </div>
              <div className="text-5xl font-black text-white">{reputation.toFixed(1)}%</div>
              <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${isLocked ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${reputation}%` }}></div>
              </div>
              {isLocked && (
                <p className="text-[10px] text-red-400 mt-2 uppercase animate-pulse">Warning: Score below 75% - Rewards generation suspended</p>
              )}
            </div>

            <div className="bg-[#111113] border border-white/10 p-6 rounded-lg backdrop-blur-md">
              <h2 className="text-gray-400 text-xs uppercase tracking-widest mb-2">Total Points Earned</h2>
              <div className="text-5xl font-black text-white">{points.toLocaleString()} <span className="text-xl text-gray-500">PTS</span></div>
            </div>

            <div className="bg-[#111113] border border-white/10 p-6 rounded-lg backdrop-blur-md">
              <h2 className="text-gray-400 text-xs uppercase tracking-widest mb-2">Claimed Rewards</h2>
              <div className="text-5xl font-black text-gray-500">{(totalClaimed * 10).toLocaleString()} <span className="text-xl">$BYH</span></div>
            </div>
          </div>

          {/* Claim Section */}
          <div className={`bg-[#111113] border p-8 rounded-lg relative overflow-hidden group transition-all ${isLocked ? 'border-red-500/20 opacity-80' : 'border-teal-500/30 shadow-[0_0_30px_rgba(20,184,166,0.05)]'}`}>
            <div className="absolute top-0 right-0 p-2 text-[8px] text-white/10 font-bold select-none">SOROBAN_DAPP_V1.0</div>
            
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isLocked ? 'bg-red-500 animate-pulse' : 'bg-teal-500 animate-pulse'}`}></span>
              Available for Claim
            </h3>

            <div className="mb-8">
              <div className={`text-6xl font-black mb-2 ${isLocked ? 'text-gray-600' : 'text-teal-400'}`}>
                {isLocked ? '0' : claimableTokens.toLocaleString()}
              </div>
              <p className="text-gray-400 text-sm">$BIYAHE Utility Tokens</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase text-gray-500 mb-1">Stellar Wallet Address</label>
                <input 
                  type="text" 
                  value={stellarAddress}
                  onChange={(e) => setStellarAddress(e.target.value)}
                  placeholder="G..."
                  disabled={isLocked}
                  className="w-full bg-black/50 border border-white/10 rounded p-3 text-sm focus:border-teal-500 outline-none transition-all font-mono disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <button 
                onClick={handleClaim}
                disabled={claiming || claimableTokens <= 0 || isLocked}
                className={`w-full py-4 rounded font-bold uppercase tracking-widest transition-all ${
                  claiming || claimableTokens <= 0 || isLocked
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-teal-500 text-black hover:bg-teal-400 hover:shadow-[0_0_20px_rgba(20,184,166,0.5)]'
                }`}
              >
                {claiming ? 'Processing Uplink...' : isLocked ? 'System Locked' : 'Execute Claim'}
              </button>

              {isLocked && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 uppercase tracking-tight">
                  Error: Trust score insufficient for claim operation. Stabilize score to 75%+ via valid data reports.
                </div>
              )}

              {message && (
                <div className={`p-4 rounded text-sm ${
                  message.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {message.text}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-[10px] text-gray-600 uppercase tracking-widest flex justify-between items-center border-t border-white/5 pt-4">
          <div>CONTRACT ID: {CONTRACT_ID.substring(0, 8)}...{CONTRACT_ID.substring(52)}</div>
          <div>NETWORK: STELLAR_TESTNET // SOROBAN_INTEGRATED</div>
        </div>
      </div>

      <style jsx>{`
        .backdrop-blur-md {
          backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}

const CONTRACT_ID = 'CDZ6PRJM2E6RCGJB5ETJLK3Q2YRPXBSJQGCSWMHJE5PEGGG4SAJXMNOT';
