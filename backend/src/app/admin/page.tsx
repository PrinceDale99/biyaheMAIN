"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, getDocs, doc, deleteDoc, orderBy, updateDoc, setDoc, getDoc, increment, runTransaction } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RouteData {
  id: string;
  userId: string;
  userEmail: string;
  transportType: string;
  routeName: string;
  terminalName: string;
  description: string;
  status: string;
  isAdminUpload?: boolean;
  createdAt: any;
  waypoints: any[];
}

interface UserProfile {
  id: string;
  email: string;
  reputation: number;
  points: number;
  totalClaimed: number;
  stellarAddress?: string;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"routes" | "users" | "funds">("routes");
  
  // Routes State
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Users State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [newReputation, setNewReputation] = useState<{[key: string]: string}>({});
  const [newPoints, setNewPoints] = useState<{[key: string]: string}>({});

  // Treasury State
  const [treasury, setTreasury] = useState<{ balance: number; totalInjected: number; totalDistributed: number } | null>(null);
  const [addFundsAmount, setAddFundsAmount] = useState<string>("");
  const [fundingUser, setFundingUser] = useState<boolean>(false);
  const [fundMessage, setFundMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const router = useRouter();
  const ADMIN_EMAIL = "princedalelimosnero@gmail.com";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
        router.push("/");
      } else {
        fetchAllData();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchRoutes(), fetchUsers(), fetchTreasury()]);
    setLoading(false);
  };

  const fetchTreasury = async () => {
    try {
      const snap = await getDoc(doc(db, "system", "treasury"));
      if (snap.exists()) {
        const d = snap.data();
        setTreasury({
          balance: d.balance ?? 0,
          totalInjected: d.totalInjected ?? 0,
          totalDistributed: d.totalDistributed ?? 0,
        });
      } else {
        setTreasury({ balance: 0, totalInjected: 0, totalDistributed: 0 });
      }
    } catch (e) {
      console.error("Error fetching treasury:", e);
    }
  };

  const fetchRoutes = async () => {
    try {
      const q = query(collection(db, "transport_info"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const routesData: RouteData[] = [];
      querySnapshot.forEach((doc) => {
        routesData.push({ id: doc.id, ...doc.data() } as RouteData);
      });
      setRoutes(routesData);
    } catch (error) {
      console.error("Error fetching routes:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersData: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleDelete = async (routeId: string) => {
    if (!window.confirm("WARNING: Are you sure you want to permanently delete this route? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(routeId);
    try {
      await deleteDoc(doc(db, "transport_info", routeId));
      setRoutes(routes.filter((route) => route.id !== routeId));
    } catch (error) {
      console.error("Error deleting route:", error);
      alert("Failed to delete the route.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdateReputation = async (userId: string) => {
    const repVal = parseFloat(newReputation[userId]);
    const pointVal = parseInt(newPoints[userId]);
    
    if (isNaN(repVal) && isNaN(pointVal)) return;

    setUpdatingUser(userId);
    try {
      const userRef = doc(db, "users", userId);
      const updates: any = {};
      if (!isNaN(repVal)) updates.reputation = repVal;
      if (!isNaN(pointVal)) updates.points = pointVal;

      await updateDoc(userRef, updates);
      
      setUsers(users.map(u => u.id === userId ? { 
        ...u, 
        reputation: !isNaN(repVal) ? repVal : u.reputation,
        points: !isNaN(pointVal) ? pointVal : u.points
      } : u));
      
      alert(`Updated user data successfully.`);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user.");
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleAddFunds = async () => {
    const amount = parseInt(addFundsAmount);
    if (isNaN(amount) || amount <= 0) {
      setFundMessage({ text: "Enter a valid amount greater than 0.", type: "error" });
      return;
    }
    setFundingUser(true);
    setFundMessage(null);
    try {
      const treasuryRef = doc(db, "system", "treasury");
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(treasuryRef);
        const current = snap.exists() ? snap.data() : { balance: 0, totalInjected: 0, totalDistributed: 0 };
        tx.set(treasuryRef, {
          balance: (current.balance ?? 0) + amount,
          totalInjected: (current.totalInjected ?? 0) + amount,
          totalDistributed: current.totalDistributed ?? 0,
          lastFundedAt: Date.now(),
        }, { merge: true });
      });
      setTreasury(prev => prev
        ? { ...prev, balance: prev.balance + amount, totalInjected: prev.totalInjected + amount }
        : { balance: amount, totalInjected: amount, totalDistributed: 0 }
      );
      setFundMessage({ text: `✅ Injected ${amount.toLocaleString()} pts into the treasury. New balance: ${((treasury?.balance ?? 0) + amount).toLocaleString()} pts`, type: "success" });
      setAddFundsAmount("");
    } catch (err) {
      setFundMessage({ text: "Transaction failed. Try again.", type: "error" });
    } finally {
      setFundingUser(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Root Access Granted</span>
            </div>
            <h1 className="text-4xl font-black text-white">Neural Core Admin</h1>
            <p className="text-slate-500 text-sm mt-2">Manage and oversee the Metro Manila transport network & user economies.</p>
          </div>
          <div className="flex gap-4">
            <Link href="/" className="px-6 py-3 bg-slate-900 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
              Return to Grid
            </Link>
          </div>
        </header>

        <div className="flex gap-2 mb-8 bg-slate-900/50 p-1 rounded-2xl w-fit border border-white/5">
          <button 
            onClick={() => setActiveTab("routes")}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'routes' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Route Records
          </button>
          <button 
            onClick={() => setActiveTab("users")}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            User Economies
          </button>
          <button 
            onClick={() => { setActiveTab("funds"); setFundMessage(null); }}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'funds' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            💰 Fund Injection
          </button>
        </div>

        <main>
          {activeTab === "routes" ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Submitted Routes ({routes.length})</h2>
                <button onClick={fetchRoutes} className="text-[10px] font-black uppercase tracking-widest text-teal-500 hover:text-teal-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Refresh Data
                </button>
              </div>

              <div className="grid gap-6">
                {routes.length === 0 ? (
                  <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-12 text-center">
                    <p className="text-slate-500 font-medium">No transport routes found.</p>
                  </div>
                ) : (
                  routes.map((route) => (
                    <div key={route.id} className="bg-slate-900 border border-white/5 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-white/10 transition-colors group">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className="px-3 py-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {route.transportType}
                          </span>
                          <span className={`px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest ${route.status === 'verified' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                            {route.status}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">{route.routeName}</h3>
                        <p className="text-sm text-slate-400">{route.terminalName}</p>
                        <p className="text-xs text-slate-500 mt-2 font-mono">{route.userEmail}</p>
                      </div>
                      
                      <button 
                        onClick={() => handleDelete(route.id)}
                        disabled={isDeleting === route.id}
                        className="px-6 py-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                      >
                        {isDeleting === route.id ? "Purging..." : "Purge Record"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">User Trust & Balances ({users.length})</h2>
                <button onClick={fetchUsers} className="text-[10px] font-black uppercase tracking-widest text-teal-500 hover:text-teal-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Sync Ledger
                </button>
              </div>

              <div className="grid gap-6">
                {users.length === 0 ? (
                  <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-12 text-center">
                    <p className="text-slate-500 font-medium">No users found in the system ledger.</p>
                  </div>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="bg-slate-900 border border-white/5 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-white/10 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-white">{u.email}</h3>
                          {u.reputation >= 75 ? (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase border border-emerald-500/20 rounded">Earning Active</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[8px] font-black uppercase border border-white/5 rounded">Below Threshold</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono mb-4">{u.id}</p>
                        <div className="flex gap-8">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Trust Score</p>
                            <p className={`text-2xl font-black ${u.reputation >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>{u.reputation?.toFixed(1) || 0}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Balance</p>
                            <p className="text-2xl font-black text-indigo-400">{u.points || 0} <span className="text-xs text-slate-600">PTS</span></p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Claimed</p>
                            <p className="text-2xl font-black text-slate-300">{(u.totalClaimed * 10).toLocaleString()} <span className="text-xs text-slate-600">$BYH</span></p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 min-w-[240px] bg-white/5 p-4 rounded-2xl">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Modify Trust (%)</p>
                          <input 
                            type="number"
                            placeholder="75.0"
                            className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none w-full mb-3"
                            value={newReputation[u.id] || ""}
                            onChange={(e) => setNewReputation({...newReputation, [u.id]: e.target.value})}
                          />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Assign Points</p>
                          <input 
                            type="number"
                            placeholder="100"
                            className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none w-full mb-3"
                            value={newPoints[u.id] || ""}
                            onChange={(e) => setNewPoints({...newPoints, [u.id]: e.target.value})}
                          />
                        </div>
                        <button 
                          onClick={() => handleUpdateReputation(u.id)}
                          disabled={updatingUser === u.id || (!newReputation[u.id] && !newPoints[u.id])}
                          className="w-full bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition-all disabled:opacity-50"
                        >
                          {updatingUser === u.id ? "Syncing..." : "Commit Changes"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === "funds" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-xl font-bold">System Treasury</h2>
                <p className="text-slate-500 text-sm mt-1">Pre-fund the reward pool. All automated user rewards are drawn from this treasury.</p>
              </div>

              {/* Treasury Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-emerald-500/20 p-5 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Available Balance</p>
                  <p className="text-3xl font-black text-emerald-400">{(treasury?.balance ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-600 mt-1">pts</p>
                </div>
                <div className="bg-slate-900 border border-white/5 p-5 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Total Injected</p>
                  <p className="text-3xl font-black text-indigo-400">{(treasury?.totalInjected ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-600 mt-1">pts</p>
                </div>
                <div className="bg-slate-900 border border-white/5 p-5 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Distributed</p>
                  <p className="text-3xl font-black text-amber-400">{(treasury?.totalDistributed ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-600 mt-1">pts</p>
                </div>
              </div>

              {/* Treasury health bar */}
              {treasury && treasury.totalInjected > 0 && (
                <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl">
                  <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                    <span>Treasury Health</span>
                    <span>{Math.round((treasury.balance / treasury.totalInjected) * 100)}% remaining</span>
                  </div>
                  <div className="w-full bg-black/50 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                      style={{ width: `${Math.min(100, Math.round((treasury.balance / treasury.totalInjected) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {treasury && treasury.balance < 50 && (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <span className="text-xl">⚠️</span>
                  <p className="text-amber-400 text-sm font-medium">Treasury is running low. Users with 75%+ trust will not receive rewards until you add more funds.</p>
                </div>
              )}

              {/* Inject form */}
              <div className="bg-slate-900 border border-emerald-500/20 p-8 rounded-3xl space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-2">Points to Add to Treasury</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 10000"
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none text-white"
                  />
                  {addFundsAmount && !isNaN(parseInt(addFundsAmount)) && parseInt(addFundsAmount) > 0 && (
                    <p className="text-xs text-slate-500 mt-2">
                      New treasury balance: <span className="text-emerald-400 font-bold">{((treasury?.balance ?? 0) + parseInt(addFundsAmount)).toLocaleString()} pts</span>
                      <span className="text-slate-600 ml-2">≈ {Math.floor(((treasury?.balance ?? 0) + parseInt(addFundsAmount)) / 10)} rewards available</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={handleAddFunds}
                  disabled={fundingUser || !addFundsAmount || parseInt(addFundsAmount) <= 0}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {fundingUser ? "Processing..." : "⚡ Fund the Treasury"}
                </button>

                {fundMessage && (
                  <div className={`p-4 rounded-xl text-sm ${
                    fundMessage.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {fundMessage.text}
                  </div>
                )}

                <div className="border-t border-white/5 pt-4">
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    Each verified contribution from a 75%+ trust user costs <span className="text-slate-400 font-bold">10 pts</span> from the treasury.
                    The treasury is locked — rewards cannot exceed the pool balance.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
