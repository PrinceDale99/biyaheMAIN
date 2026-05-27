"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { TopNav } from "@/components/layout/TopNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { GlassCard } from "@/components/ui/GlassCard";
import { TacticalButton } from "@/components/ui/TacticalButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { loadGoogleMaps } from "@/lib/google-maps";

type TransportType = "UV Express" | "EDSA Carousel" | "Jeep" | "E-Jeep" | "Minibus" | "Bus" | "LRT/MRT" | "Trike" | "Tricycle" | "E-bike" | "Others";

interface Waypoint {
  name: string;
  lat: number;
  lng: number;
  type: "pickup" | "dropoff" | "both" | "waypoint" | "direct";
  fare: number;
}

export default function ContributePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "success" | "fail" | "admin">("idle");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [reputation, setReputation] = useState(98.2);
  const [searchQuery, setSearchQuery] = useState("");

  const ADMIN_EMAIL = "princedalelimosnero@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;
  
  const [transportType, setTransportType] = useState<TransportType>("Jeep");
  const [routeName, setRouteName] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [description, setDescription] = useState("");
  const [dropOffAnywhere, setDropOffAnywhere] = useState(false);
  const [pickUpAnywhere, setPickUpAnywhere] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const waypointsRef = useRef<Waypoint[]>([]);
  
  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const glowLineRef = useRef<google.maps.Polyline | null>(null);
  const [selectingOnMap, setSelectingOnMap] = useState<Waypoint["type"] | null>(null);
  const selectingOnMapRef = useRef<Waypoint["type"] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchResult, setSearchResult] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const searchMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsService = useRef<google.maps.DirectionsService | null>(null);
  const [snappedPath, setSnappedPath] = useState<google.maps.LatLngLiteral[]>([]);
  const [isMapping, setIsMapping] = useState(false);
  const [existingRoutes, setExistingRoutes] = useState<any[]>([]);

  useEffect(() => {
    selectingOnMapRef.current = selectingOnMap;
  }, [selectingOnMap]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const { ReputationEngine } = await import("@/lib/reputation");
        const score = await ReputationEngine.getScore(currentUser.uid);
        setReputation(score);
        
        // Fetch existing routes to show on map
        const querySnapshot = await getDocs(collection(db, "transport_info"));
        const routes = querySnapshot.docs.map(doc => doc.data());
        setExistingRoutes(routes);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (!window.confirm("Are you sure you want to sign out?")) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const removeWaypoint = (index: number) => {
    if (markersRef.current[index]) {
      markersRef.current[index].setMap(null);
      markersRef.current.splice(index, 1);
    }
    setWaypoints(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
  };

  useEffect(() => {
    const initMap = async () => {
      if (typeof window === "undefined" || !mapRef.current) return;
      try {
        await loadGoogleMaps();

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 14.5995, lng: 120.9842 },
          zoom: 13,
          disableDefaultUI: true,
          clickableIcons: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] }
          ]
        });

        mapInstance.current = map;
        directionsService.current = new google.maps.DirectionsService();

        // Draw existing routes as small faint lines
        existingRoutes.forEach(route => {
          if (route.routePath && route.routePath.length > 0) {
            const color = route.transportType === "LRT/MRT" ? "#818cf8" : 
                          route.transportType === "EDSA Carousel" ? "#fbbf24" :
                          route.transportType === "Ferry" ? "#0ea5e9" : "#475569";
            
            new google.maps.Polyline({
              path: route.routePath,
              strokeColor: color,
              strokeOpacity: 0.3,
              strokeWeight: 2,
              map: map
            });
          }
        });

        if (searchInputRef.current) {
          autocomplete.current = new google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ["geometry", "name", "formatted_address"],
            componentRestrictions: { country: "ph" }
          });

          autocomplete.current.addListener("place_changed", () => {
            const place = autocomplete.current?.getPlace();
            if (place?.geometry?.location) {
              const loc = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
              map.panTo(loc);
              map.setZoom(17);
              setSearchResult({ name: place.name || place.formatted_address || "Target", lat: loc.lat, lng: loc.lng });
              if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
              searchMarkerRef.current = new google.maps.Marker({ position: loc, map, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#ffffff", fillOpacity: 0.3, strokeWeight: 2, strokeColor: "#2dd4bf" } });
            }
          });
        }

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const currentType = selectingOnMapRef.current;
            if (currentType) {
              const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
              addMarkerToMap(coords, currentType);
              setWaypoints(prev => [...prev, { name: `Point ${prev.length + 1}`, lat: coords.lat, lng: coords.lng, type: currentType, fare: 0 }]);
              setSelectingOnMap(null);
              setSearchResult(null);
              if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
            }
          }
        });

        setMapLoaded(true);

        // Re-draw current waypoints if map re-initialized
        if (waypointsRef.current.length > 0) {
          markersRef.current = []; // Clear old refs as the map is new
          waypointsRef.current.forEach(wp => {
            addMarkerToMap({ lat: wp.lat, lng: wp.lng }, wp.type);
          });
        }
      } catch (err) { console.error("Map Load Error:", err); }
    };
    if (user && existingRoutes.length >= 0) initMap();
  }, [user, existingRoutes]);

  const addMarkerToMap = (position: { lat: number, lng: number }, type: Waypoint["type"]) => {
    const google = (window as any).google;
    if (!google || !mapInstance.current) return;
    const colors = { pickup: "#2dd4bf", dropoff: "#f43f5e", both: "#a855f7", waypoint: "#f59e0b", direct: "#06b6d4" };
    const marker = new google.maps.Marker({
      position, map: mapInstance.current, draggable: true,
      label: { text: type === "pickup" ? "P" : type === "dropoff" ? "D" : type === "both" ? "PD" : type === "direct" ? "I" : "W", color: "white", fontSize: "10px", fontWeight: "900" },
      icon: { path: type === "both" ? "M -10,-10 L 10,-10 L 10,10 L -10,10 Z" : google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: colors[type], fillOpacity: 1, strokeWeight: 2, strokeColor: "#ffffff" }
    });
    marker.addListener("dragend", () => {
      const newPos = marker.getPosition();
      if (newPos) {
        const index = markersRef.current.indexOf(marker);
        if (index !== -1) setWaypoints(prev => { const next = [...prev]; next[index] = { ...next[index], lat: newPos.lat(), lng: newPos.lng() }; return next; });
      }
    });
    markersRef.current.push(marker);
  };

  const addWaypointFromSearch = (type: Waypoint["type"]) => {
    if (searchResult) {
      addMarkerToMap({ lat: searchResult.lat, lng: searchResult.lng }, type);
      setWaypoints(prev => [...prev, { name: searchResult.name, lat: searchResult.lat, lng: searchResult.lng, type, fare: 0 }]);
      setSearchResult(null);
      if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
      setSearchQuery("");
    }
  };

  useEffect(() => {
    const updateRoute = async () => {
      if (!mapInstance.current || waypoints.length < 2 || !directionsService.current) {
        if (glowLineRef.current) glowLineRef.current.setMap(null);
        if (routeLineRef.current) routeLineRef.current.setMap(null);
        return;
      }
      setIsMapping(true);
      const path: google.maps.LatLngLiteral[] = waypoints.map(w => ({ lat: w.lat, lng: w.lng }));
      setSnappedPath(path);
      if (glowLineRef.current) glowLineRef.current.setMap(null);
      if (routeLineRef.current) routeLineRef.current.setMap(null);
      glowLineRef.current = new google.maps.Polyline({ path, strokeColor: "#2dd4bf", strokeOpacity: 0.1, strokeWeight: 10, map: mapInstance.current });
      routeLineRef.current = new google.maps.Polyline({ path, strokeColor: "#2dd4bf", strokeOpacity: 1, strokeWeight: 3, map: mapInstance.current });
      setIsMapping(false);
    };
    updateRoute();
  }, [waypoints]);

  const handleVerifyAndSubmit = async () => {
    if (!routeName || waypoints.length < 2) return alert("Route Name and at least 2 waypoints are required.");
    setIsVerifying(true);
    try {
      await addDoc(collection(db, "transport_info"), {
        userId: user?.uid, transportType, routeName, terminalName, description, waypoints, routePath: snappedPath, dropOffAnywhere, pickUpAnywhere, status: isAdmin ? "verified" : "pending", createdAt: serverTimestamp()
      });
      setVerificationStatus("success");
      // Reset form after success
      setTimeout(() => {
        setRouteName("");
        setWaypoints([]);
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        setVerificationStatus("idle");
      }, 3000);
    } catch (err) { 
      console.error("Submission Error:", err);
      setVerificationStatus("fail"); 
    }
    setIsVerifying(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-12 h-12 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <GlassCard className="p-12 max-w-md" variant="teal">
        <h2 className="text-3xl font-black text-white mb-4">Sign In Required</h2>
        <p className="text-slate-400 mb-8">Please sign in to contribute routes to the network.</p>
        <Link href="/auth/signin"><TacticalButton variant="primary" fullWidth>Sign In</TacticalButton></Link>
      </GlassCard>
    </div>
  );

  return (
    <div className="relative h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col">
      <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${mapLoaded ? 'opacity-100' : 'opacity-20'}`}>
        <div ref={mapRef} className="h-full w-full" />
      </div>

      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        <div className="pointer-events-auto">
          <TopNav user={user} reputation={reputation} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchInputRef={searchInputRef} handleSignOut={handleSignOut} />
        </div>

        <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 md:p-8 overflow-hidden">
          <div className={`flex flex-col gap-6 transition-all duration-500 ${sidebarOpen ? 'w-full lg:w-[450px]' : 'w-0 opacity-0 pointer-events-none'}`}>
            <GlassCard className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 pointer-events-auto" variant="teal">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black tracking-tighter uppercase">Add Route</h2>
                <StatusBadge label={isAdmin ? "Admin Access" : "Contributor Mode"} status="online" />
              </div>

              {verificationStatus === "success" ? (
                <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-2xl font-black mb-2">Route Submitted!</h3>
                  <p className="text-slate-400 text-sm">Your contribution is being verified by the network. Transit points will be awarded soon.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Type of Transport</label>
                    <select value={transportType} onChange={(e) => setTransportType(e.target.value as TransportType)} className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-teal-500 outline-none transition-all appearance-none cursor-pointer">
                      <option value="Jeep">Jeepney</option>
                      <option value="E-Jeep">E-Jeepney</option>
                      <option value="UV Express">UV Express</option>
                      <option value="Bus">Public Bus</option>
                      <option value="EDSA Carousel">EDSA Carousel</option>
                      <option value="LRT/MRT">LRT / MRT</option>
                      <option value="Minibus">Minibus</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Route Name</label>
                    <input type="text" placeholder="e.g. SM North - PITX" value={routeName} onChange={(e) => setRouteName(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-teal-500 outline-none transition-all" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setSelectingOnMap("pickup")} className={`p-4 rounded-2xl border transition-all text-center ${selectingOnMap === 'pickup' ? 'bg-teal-500/20 border-teal-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      <p className="text-[10px] font-black uppercase mb-1">Pickup</p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-tighter">Click on Map</p>
                    </button>
                    <button onClick={() => setSelectingOnMap("dropoff")} className={`p-4 rounded-2xl border transition-all text-center ${selectingOnMap === 'dropoff' ? 'bg-rose-500/20 border-rose-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      <p className="text-[10px] font-black uppercase mb-1">Dropoff</p>
                      <p className="text-[8px] text-slate-500 uppercase tracking-tighter">Click on Map</p>
                    </button>
                  </div>

                  {waypoints.length > 0 && (
                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                      {waypoints.map((wp, i) => (
                        <div key={i} className="bg-white/5 p-3 rounded-xl flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${wp.type === 'pickup' ? 'bg-teal-500' : 'bg-rose-500'}`} />
                            <span className="text-xs font-bold truncate max-w-[200px]">{wp.name}</span>
                          </div>
                          <button onClick={() => removeWaypoint(i)} className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <TacticalButton variant="primary" fullWidth onClick={handleVerifyAndSubmit} disabled={isVerifying || waypoints.length < 2}>
                    {isVerifying ? 'Verifying Neural Data...' : 'Submit Route Contribution'}
                  </TacticalButton>
                  
                  {verificationStatus === "fail" && (
                    <p className="text-[10px] text-red-400 font-black uppercase text-center animate-pulse">Transmission failed. Try again.</p>
                  )}
                </div>
              )}
            </GlassCard>
          </div>

          <div className="flex-1 relative pointer-events-none">
            {searchResult && (
              <GlassCard className="absolute top-4 left-4 p-4 z-20 w-64 pointer-events-auto animate-in slide-in-from-top-4" variant="teal">
                <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-1">Location Found</p>
                <p className="text-sm font-bold truncate mb-3">{searchResult.name}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => addWaypointFromSearch("pickup")} className="text-[9px] font-black uppercase p-2 bg-teal-500/10 rounded-lg border border-teal-500/20 text-teal-500">Pickup</button>
                  <button onClick={() => addWaypointFromSearch("dropoff")} className="text-[9px] font-black uppercase p-2 bg-rose-500/10 rounded-lg border border-rose-500/20 text-rose-500">Dropoff</button>
                </div>
              </GlassCard>
            )}
            
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="absolute bottom-4 left-4 z-20 p-3 bg-slate-900 border border-white/10 rounded-full text-teal-500 shadow-2xl pointer-events-auto">
              <svg className={`w-5 h-5 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 19l-7-7 7-7" /></svg>
            </button>
          </div>
        </main>

        <div className="pointer-events-auto">
          <BottomNav activeTab="Map" />
        </div>
      </div>
    </div>
  );
}

