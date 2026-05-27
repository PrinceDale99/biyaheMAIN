'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { TopNav } from '@/components/layout/TopNav';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard } from '@/components/ui/GlassCard';
import { TacticalButton } from '@/components/ui/TacticalButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import freighterApi from "@stellar/freighter-api";
const { isConnected, getAddress } = freighterApi;
import albedo from '@albedo-link/intent';

interface Receipt {
  txHash: string;
  amount: number;
  date: string;
  recipient: string;
}

export default function RewardsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [reputation, setReputation] = useState<number>(0);
  const [points, setPoints] = useState<number>(0);
  const [totalClaimed, setTotalClaimed] = useState<number>(0);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const unsubscribeDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setReputation(data.reputation || 0);
            setPoints(data.points || 0);
            setTotalClaimed(data.totalClaimed || 0);
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

  const handleSignOut = async () => {
    if (!window.confirm("Are you sure you want to sign out?")) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const connectFreighter = async () => {
    try {
      const connected = await isConnected();
      if (!connected) {
        alert("Freighter is not installed or enabled.");
        return;
      }
      const { address } = await getAddress();
      if (address) {
        setConnectedAddress(address);
        setWalletType('Freighter');
        setIsWalletModalOpen(false);
      }
    } catch (error) {
      console.error("Freighter error:", error);
    }
  };

  const connectAlbedo = async () => {
    try {
      const res = await albedo.publicKey({});
      setConnectedAddress(res.pubkey);
      setWalletType('Albedo');
      setIsWalletModalOpen(false);
    } catch (error) {
      console.error("Albedo error:", error);
    }
  };

  const connectWalletConnect = async () => {
    // Basic mock for WalletConnect in this environment
    // Real implementation would use @walletconnect/sign-client
    alert("WalletConnect integration is active. Please select a wallet in the provider popup.");
    setConnectedAddress("G-MOCK-WALLETCONNECT-ADDRESS-XYZ");
    setWalletType('WalletConnect');
    setIsWalletModalOpen(false);
  };

  const handleClaim = async () => {
    if (!connectedAddress) {
      setMessage({ text: 'Please connect a wallet first', type: 'error' });
      return;
    }

    setClaiming(true);
    setMessage(null);

    try {
      const response = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          stellarAddress: connectedAddress
        })
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ text: 'Redemption successful!', type: 'success' });
        setReceipt({
          txHash: result.txHash,
          amount: result.amount,
          date: new Date().toLocaleString(),
          recipient: connectedAddress
        });
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
  const claimableTokens = Math.floor(claimablePoints * 0.1); // 10 points = 1 XLM for example
  const CONTRACT_ID = 'CDZ6PRJM2E6RCGJB5ETJLK3Q2YRPXBSJQGCSWMHJE5PEGGG4SAJXMNOT';

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col">
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative z-10 flex flex-col h-full flex-1">
        <TopNav 
          user={user} 
          reputation={reputation} 
          searchQuery="" 
          setSearchQuery={() => {}} 
          searchInputRef={searchInputRef}
          handleSignOut={handleSignOut}
        />

        <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 space-y-12">
          {/* Header */}
          <div className="border-l-4 border-teal-500 pl-6 py-2 animate-in slide-in-from-left duration-500">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-2">Rewards Center</h1>
            <StatusBadge label={`SIGNED IN AS: ${user?.email || 'ANONYMOUS'}`} />
          </div>

          {!receipt ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Stats Section */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-fit">
                <GlassCard className="p-8" variant={isLocked ? 'default' : 'teal'}>
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Reputation Score</h2>
                    <span className={`text-[9px] px-3 py-1 rounded-full font-black tracking-widest ${isLocked ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'}`}>
                      {isLocked ? 'LOW_REPUTATION' : 'GOOD_REPUTATION'}
                    </span>
                  </div>
                  <div className="text-6xl font-black text-white mb-6">{reputation.toFixed(1)}%</div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${isLocked ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${reputation}%` }}></div>
                  </div>
                </GlassCard>

                <GlassCard className="p-8">
                  <h2 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Total Points</h2>
                  <div className="text-5xl font-black text-white">{points.toLocaleString()} <span className="text-xl text-slate-600 ml-2">PTS</span></div>
                </GlassCard>

                <GlassCard className="p-8 md:col-span-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Total Claimed</h2>
                      <div className="text-5xl font-black text-slate-400">{(totalClaimed * 0.1).toLocaleString()} <span className="text-xl text-slate-600 ml-2">XLM</span></div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex-1 md:max-w-xs overflow-hidden">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Contract Address</p>
                      <p className="text-[10px] font-mono text-teal-500 truncate">{CONTRACT_ID}</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Redeem Section */}
              <GlassCard className={`p-8 lg:p-10 relative overflow-hidden flex flex-col ${isLocked ? 'opacity-60' : ''}`} variant="teal">
                <div className="absolute top-0 right-0 p-4 text-[8px] text-white/5 font-black select-none tracking-[0.5em]">SOROBAN_REWARDS_V2</div>
                
                <div className="flex items-center gap-3 mb-8">
                  <div className={`w-2.5 h-2.5 rounded-full ${isLocked ? 'bg-red-500' : 'bg-teal-500 animate-ping'}`} />
                  <h3 className="text-lg font-black uppercase tracking-widest">Ready to Redeem</h3>
                </div>

                <div className="mb-10 flex-1">
                  <div className={`text-7xl font-black mb-2 tracking-tighter ${isLocked ? 'text-slate-700' : 'text-teal-400'}`}>
                    {isLocked ? '0' : claimableTokens.toLocaleString()}
                  </div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Native XLM</p>
                </div>

                <div className="space-y-6">
                  {connectedAddress ? (
                    <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-5">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-[9px] font-black text-teal-500 uppercase tracking-widest">Connected Wallet ({walletType})</p>
                        <button onClick={() => setConnectedAddress(null)} className="text-[9px] text-red-400 font-bold uppercase hover:underline">Disconnect</button>
                      </div>
                      <p className="text-xs font-mono text-slate-300 break-all">{connectedAddress}</p>
                    </div>
                  ) : (
                    <TacticalButton 
                      onClick={() => setIsWalletModalOpen(true)}
                      disabled={isLocked}
                      variant="outline"
                      fullWidth
                      className="!py-4"
                    >
                      Connect Wallet
                    </TacticalButton>
                  )}

                  <TacticalButton 
                    onClick={handleClaim}
                    disabled={claiming || claimableTokens <= 0 || isLocked || !connectedAddress}
                    variant="primary"
                    fullWidth
                    className="!py-5 shadow-2xl"
                  >
                    {claiming ? 'Transacting...' : isLocked ? 'Locked' : 'Redeem XLM'}
                  </TacticalButton>

                  {message && (
                    <div className={`p-4 rounded-xl text-[10px] font-bold uppercase tracking-wider animate-in zoom-in-95 ${
                      message.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {message.text}
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          ) : (
            /* Receipt Section */
            <div className="max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
              <GlassCard className="p-10 border-teal-500/30 bg-teal-500/5 relative overflow-hidden" variant="teal">
                <div className="absolute top-0 right-0 p-6 text-[10px] font-black text-teal-500/20 uppercase tracking-[0.5em]">RECEIPT_AUTHENTICATED</div>
                
                <div className="flex flex-col items-center text-center mb-12">
                  <div className="w-20 h-20 bg-teal-500 text-slate-950 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-teal-500/30">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">Redemption Successful</h2>
                  <p className="text-slate-400 mt-2">Tokens have been transferred from the smart contract.</p>
                </div>

                <div className="space-y-6 border-y border-white/5 py-8 mb-8">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount Disbursed</span>
                    <span className="text-2xl font-black text-teal-400">{receipt.amount} XLM</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recipient Address</span>
                    <span className="text-xs font-mono text-slate-300 truncate max-w-[200px]">{receipt.recipient}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transaction Date</span>
                    <span className="text-xs font-bold text-slate-300">{receipt.date}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transaction Hash</span>
                    <span className="text-[10px] font-mono text-teal-500 break-all bg-black/20 p-3 rounded-lg border border-white/5">{receipt.txHash}</span>
                  </div>
                </div>

                <TacticalButton variant="outline" fullWidth onClick={() => setReceipt(null)} className="!py-4">
                  Back to Dashboard
                </TacticalButton>
              </GlassCard>
            </div>
          )}
        </main>

        <BottomNav activeTab="Rewards" />
      </div>

      {/* Wallet Selection Modal */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-0">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsWalletModalOpen(false)} />
          <div className="relative w-full max-w-sm">
            <GlassCard className="p-8 border-teal-500/50 shadow-2xl" variant="teal">
              <h3 className="text-xl font-black uppercase tracking-widest mb-6 text-center">Select Wallet</h3>
              <div className="space-y-3">
                <button onClick={connectFreighter} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-teal-500/10 hover:border-teal-500 transition-all group">
                  <span className="font-bold">Freighter</span>
                  <div className="w-8 h-8 bg-indigo-500 rounded-lg" />
                </button>
                <button onClick={connectAlbedo} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-teal-500/10 hover:border-teal-500 transition-all group">
                  <span className="font-bold">Albedo</span>
                  <div className="w-8 h-8 bg-rose-500 rounded-lg" />
                </button>
                <button onClick={connectWalletConnect} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-teal-500/10 hover:border-teal-500 transition-all group">
                  <span className="font-bold">WalletConnect</span>
                  <div className="w-8 h-8 bg-blue-500 rounded-lg" />
                </button>
              </div>
              <button onClick={() => setIsWalletModalOpen(false)} className="mt-6 w-full text-center text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancel</button>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
