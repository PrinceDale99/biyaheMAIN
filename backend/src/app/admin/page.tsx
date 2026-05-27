"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, getDocs, doc, deleteDoc, orderBy, updateDoc, getDoc, runTransaction } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TacticalButton } from "@/components/ui/TacticalButton";

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
  
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [newReputation, setNewReputation] = useState<{[key: string]: string}>({});
  const [newPoints, setNewPoints] = useState<{[key: string]: string}>({});

  const [treasury, setTreasury] = useState<{ balance: number; totalInjected: number; totalDistributed: number } | null>(null);
  const [addFundsAmount, setAddFundsAmount] = useState<string>("");
  const [fundingUser, setFundingUser] = useState<boolean>(false);
  const [fundMessage, setFundMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const router = useRouter();
  const ADMIN_EMAIL = "princedalelimosnero@gmail.com";

  useEffect(() => {
    if (!auth) return;
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
    if (!db) return;
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
    } catch (e) { console.error(e); }
  };

  const fetchRoutes = async () => {
    if (!db) return;
    try {
      const q = query(collection(db, "transport_info"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const routesData: RouteData[] = [];
      querySnapshot.forEach((doc) => { routesData.push({ id: doc.id, ...doc.data() } as RouteData); });
      setRoutes(routesData);
    } catch (error) { console.error(error); }
  };

  const fetchUsers = async () => {
    if (!db) return;
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersData: UserProfile[] = [];
      querySnapshot.forEach((doc) => { usersData.push({ id: doc.id, ...doc.data() } as UserProfile); });
      setUsers(usersData);
    } catch (error) { console.error(error); }
  };

  const handleDelete = async (routeId: string) => {
    if (!window.confirm("WARNING: Purge this record from the neural grid?") || !db) return;
    setIsDeleting(routeId);
    try {
      await deleteDoc(doc(db, "transport_info", routeId));
      setRoutes(routes.filter((route) => route.id !== routeId));
    } catch (e) { alert("Purge failed."); }
    setIsDeleting(null);
  };

  const handleUpdateReputation = async (userId: string) => {
    if (!db) return;
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
      setUsers(users.map(u => u.id === userId ? { ...u, reputation: !isNaN(repVal) ? repVal : u.reputation, points: !isNaN(pointVal) ? pointVal : u.points } : u));
      alert(`Ledger synchronized.`);
    } catch (e) { alert("Sync failed."); }
    setUpdatingUser(null);
  };

  const handleAddFunds = async () => {
    if (!db) return;
    const amount = parseInt(addFundsAmount);
    if (isNaN(amount) || amount <= 0) return setFundMessage({ text: "Enter valid amount.", type: "error" });
    setFundingUser(true);
    try {
      const treasuryRef = doc(db, "system", "treasury");
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(treasuryRef);
        const current = snap.exists() ? snap.data() : { balance: 0, totalInjected: 0, totalDistributed: 0 };
        tx.set(treasuryRef, { balance: (current.balance ?? 0) + amount, totalInjected: (current.totalInjected ?? 0) + amount, totalDistributed: current.totalDistributed ?? 0 }, { merge: true });
      });
      setTreasury(prev => prev ? { ...prev, balance: prev.balance + amount, totalInjected: prev.totalInjected + amount } : { balance: amount, totalInjected: amount, totalDistributed: 0 });
      setFundMessage({ text: `Injection successful.`, type: "success" });
      setAddFundsAmount("");
    } catch (err) { setFundMessage({ text: "Injection failed.", type: "error" }); }
    setFundingUser(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      <div className="fixed inset-0 z-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-white/5 pb-8">
          <div>
            <StatusBadge label="Root Access Granted" className="mb-2" />
            <h1 className="text-4xl font-black tracking-tighter uppercase">Admin Dashboard</h1>
            <p className="text-slate-500 text-sm mt-2">Manage the Biyahe network and user rewards.</p>
          </div>
          <Link href="/"><TacticalButton variant="outline">Return to Map</TacticalButton></Link>
        </header>

        <div className="flex gap-2 mb-12 overflow-x-auto pb-2 custom-scrollbar">
          {["routes", "users", "funds"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab ? 'bg-teal-500 text-slate-950' : 'bg-white/5 text-slate-500 hover:text-white'}`}>
              {tab === 'funds' ? '💰 Add Funds' : `${tab} records`}
            </button>
          ))}
        </div>

        <main className="animate-in fade-in duration-700">
          {activeTab === "routes" && (
            <div className="grid gap-6">
              {routes.map((route) => (
                <GlassCard key={route.id} className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-teal-500/20" variant="teal">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full text-[9px] font-black uppercase tracking-widest">{route.transportType}</span>
                      <span className={`px-3 py-1 border rounded-full text-[9px] font-black uppercase tracking-widest ${route.status === 'verified' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>{route.status}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{route.routeName}</h3>
                    <p className="text-sm text-slate-500 font-mono">{route.userEmail}</p>
                  </div>
                  <TacticalButton variant="outline" onClick={() => handleDelete(route.id)} disabled={isDeleting === route.id} className="!py-3 border-red-500/20 text-red-400 hover:bg-red-500/10">
                    {isDeleting === route.id ? "Deleting..." : "Delete Record"}
                  </TacticalButton>
                </GlassCard>
              ))}
            </div>
          )}

          {activeTab === "users" && (
            <div className="grid gap-6">
              {users.map((u) => (
                <GlassCard key={u.id} className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8" variant="teal">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">{u.email}</h3>
                      {u.reputation >= 75 && <span className="px-2 py-0.5 bg-teal-500/10 text-teal-500 text-[8px] font-black uppercase border border-teal-500/20 rounded">Active</span>}
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono mb-6">{u.id}</p>
                    <div className="grid grid-cols-3 gap-6 max-w-sm">
                      <div><p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Trust</p><p className="text-2xl font-black text-teal-400">{u.reputation?.toFixed(1)}%</p></div>
                      <div><p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Balance</p><p className="text-2xl font-black text-white">{u.points}</p></div>
                      <div><p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Claimed</p><p className="text-2xl font-black text-slate-500">{u.totalClaimed * 10}</p></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 min-w-[300px] bg-black/20 p-4 rounded-2xl border border-white/5">
                    <input type="number" placeholder="Trust%" className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-white" value={newReputation[u.id] || ""} onChange={(e) => setNewReputation({...newReputation, [u.id]: e.target.value})} />
                    <input type="number" placeholder="Points" className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-white" value={newPoints[u.id] || ""} onChange={(e) => setNewPoints({...newPoints, [u.id]: e.target.value})} />
                    <TacticalButton variant="primary" fullWidth className="col-span-2 !py-2.5 !text-[9px]" onClick={() => handleUpdateReputation(u.id)} disabled={updatingUser === u.id}>
                      {updatingUser === u.id ? "Saving..." : "Update User"}
                    </TacticalButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {activeTab === "funds" && (
            <GlassCard className="max-w-2xl p-8 md:p-12 mx-auto" variant="teal">
              <h2 className="text-2xl font-black uppercase mb-2">Rewards Fund</h2>
              <p className="text-slate-500 text-sm mb-10">Add points to the global reward pool.</p>
              <div className="grid grid-cols-3 gap-4 mb-10">
                <div className="bg-black/20 p-5 rounded-2xl border border-white/5"><p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Balance</p><p className="text-3xl font-black text-teal-400">{treasury?.balance?.toLocaleString()}</p></div>
                <div className="bg-black/20 p-5 rounded-2xl border border-white/5"><p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Total</p><p className="text-3xl font-black text-white">{treasury?.totalInjected?.toLocaleString()}</p></div>
                <div className="bg-black/20 p-5 rounded-2xl border border-white/5"><p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Payouts</p><p className="text-3xl font-black text-slate-500">{treasury?.totalDistributed?.toLocaleString()}</p></div>
              </div>
              <div className="space-y-6">
                <input type="number" placeholder="Points to add..." value={addFundsAmount} onChange={(e) => setAddFundsAmount(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-teal-500 outline-none" />
                <TacticalButton variant="primary" fullWidth onClick={handleAddFunds} disabled={fundingUser || !addFundsAmount}>
                  {fundingUser ? "Processing..." : "Add Points"}
                </TacticalButton>
                {fundMessage && <div className={`p-4 rounded-xl text-[10px] font-black uppercase text-center ${fundMessage.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{fundMessage.text}</div>}
              </div>
            </GlassCard>
          )}
        </main>
      </div>
    </div>
  );
}

