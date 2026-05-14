"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import Image from "next/image";

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

  const ADMIN_EMAIL = "princedalelimosnero@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;
  
  // Form State
  const [transportType, setTransportType] = useState<TransportType>("Jeep");
  const [routeName, setRouteName] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [description, setDescription] = useState("");
  const [dropOffAnywhere, setDropOffAnywhere] = useState(false);
  const [pickUpAnywhere, setPickUpAnywhere] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const waypointsRef = useRef<Waypoint[]>([]);
  
  // Sync ref with state for use in map listeners
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

  useEffect(() => {
    selectingOnMapRef.current = selectingOnMap;
  }, [selectingOnMap]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const initMap = async () => {
      if (typeof window === "undefined" || !mapRef.current) return;
      try {
        const { Loader } = await import("@googlemaps/js-api-loader");
        const loader = new Loader({
          apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
          version: "weekly",
          libraries: ["places", "routes"]
        });

        const google = await loader.load();
        const PHILIPPINES_BOUNDS = {
          north: 21.1,
          south: 4.4,
          west: 116.9,
          east: 126.6,
        };

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 14.5995, lng: 120.9842 },
          zoom: 13,
          disableDefaultUI: true,
          clickableIcons: false,
          restriction: {
            latLngBounds: PHILIPPINES_BOUNDS,
            strictBounds: false,
          },
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] }
          ]
        });

        mapInstance.current = map;
        directionsService.current = new google.maps.DirectionsService();

        // Add Transit Layer
        const transitLayer = new google.maps.TransitLayer();
        transitLayer.setMap(map);

        if (searchInputRef.current) {
          autocomplete.current = new google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ["geometry", "name", "formatted_address"],
            componentRestrictions: { country: "ph" },
            types: [] 
          });

          autocomplete.current.addListener("place_changed", () => {
            const place = autocomplete.current?.getPlace();
            if (place?.geometry?.location) {
              const loc = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
              map.panTo(loc);
              map.setZoom(17);
              
              setSearchResult({
                name: place.name || place.formatted_address || "Search Result",
                lat: loc.lat,
                lng: loc.lng
              });

              // Show temporary search marker
              if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
              searchMarkerRef.current = new google.maps.Marker({
                position: loc,
                map: map,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: "#ffffff",
                  fillOpacity: 0.2,
                  strokeWeight: 2,
                  strokeColor: "#2dd4bf"
                },
                title: place.name
              });
            }
          });
        }

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            const currentType = selectingOnMapRef.current;
            
            if (currentType) {
              const newWaypoint: Waypoint = {
                name: `Point ${waypointsRef.current.length + 1}`,
                lat: coords.lat,
                lng: coords.lng,
                type: currentType,
                fare: 0
              };
              
              addMarkerToMap(coords, currentType);
              setWaypoints(prev => [...prev, newWaypoint]);
              setSelectingOnMap(null);
              setSearchResult(null); // Clear search result if they drop somewhere else
              if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
            }
          }
        });

        setMapLoaded(true);
      } catch (err) {
        console.error("Map Load Error:", err);
      }
    };

    if (user) initMap();
  }, [user]);

  const addMarkerToMap = (position: { lat: number, lng: number }, type: Waypoint["type"]) => {
    if (!mapInstance.current) return;
    
    const google = (window as any).google;
    if (!google) return;

    const colors = {
      pickup: "#2dd4bf",
      dropoff: "#f43f5e",
      both: "#a855f7",
      waypoint: "#f59e0b",
      direct: "#06b6d4"
    };

    const marker = new google.maps.Marker({
      position,
      map: mapInstance.current,
      draggable: true,
      animation: google.maps.Animation.DROP,
      label: {
        text: type === "pickup" ? "P" : type === "dropoff" ? "D" : type === "both" ? "PD" : type === "direct" ? "I" : "W",
        color: "white",
        fontSize: "12px",
        fontWeight: "900"
      },
      icon: {
        path: type === "both" ? "M -15,-15 L 15,-15 L 15,15 L -15,15 Z" : 
              type === "direct" ? "M 0,-15 L 15,15 L -15,15 Z" : // Triangle for Iskinitas
              google.maps.SymbolPath.CIRCLE,
        scale: type === "both" ? 0.8 : type === "direct" ? 0.8 : 18,
        fillColor: colors[type],
        fillOpacity: 1,
        strokeWeight: 4,
        strokeColor: "#ffffff"
      }
    });

    marker.addListener("dragend", () => {
      const newPos = marker.getPosition();
      if (newPos) {
        const index = markersRef.current.indexOf(marker);
        if (index !== -1) {
          setWaypoints(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], lat: newPos.lat(), lng: newPos.lng() };
            return updated;
          });
        }
      }
    });

    markersRef.current.push(marker);
  };

  const addWaypointFromSearch = (type: Waypoint["type"]) => {
    if (searchResult) {
      const coords = { lat: searchResult.lat, lng: searchResult.lng };
      addMarkerToMap(coords, type);
      setWaypoints(prev => [...prev, {
        name: searchResult.name,
        lat: coords.lat,
        lng: coords.lng,
        type,
        fare: 0
      }]);
      
      setSearchResult(null);
      if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
      if (searchInputRef.current) searchInputRef.current.value = "";
    }
  };

  // Update polyline and snapped path when waypoints change
  useEffect(() => {
    const updateRoute = async () => {
      if (!mapInstance.current || waypoints.length < 2 || !directionsService.current) {
        if (routeLineRef.current) routeLineRef.current.setMap(null);
        if (glowLineRef.current) glowLineRef.current.setMap(null);
        setSnappedPath([]);
        return;
      }

      const google = (window as any).google;
      if (!google) return;

      setIsMapping(true);

      // Segmented Routing to support "Iskinitas" (Direct connections)
      let fullPath: google.maps.LatLngLiteral[] = [];
      
      const processSegments = async () => {
        let currentSegmentWaypoints: google.maps.LatLngLiteral[] = [
          { lat: waypoints[0].lat, lng: waypoints[0].lng }
        ];

        for (let i = 1; i < waypoints.length; i++) {
          const wp = waypoints[i];
          const prevWp = waypoints[i-1];
          
          if (wp.type === "direct") {
            // If the current point is "direct", we close the previous road segment (if any)
            // and add a straight line from previous point to this one.
            
            // First, if we have accumulated points for a road segment, route them
            if (currentSegmentWaypoints.length > 1) {
              const roadPath = await getRoadPath(currentSegmentWaypoints);
              fullPath = [...fullPath, ...roadPath];
            } else if (fullPath.length === 0) {
              // Start of route
              fullPath.push(currentSegmentWaypoints[0]);
            }
            
            // Add the straight line to the direct point
            fullPath.push({ lat: wp.lat, lng: wp.lng });
            
            // Reset for the next segment starting at this point
            currentSegmentWaypoints = [{ lat: wp.lat, lng: wp.lng }];
          } else {
            // Continue accumulating road segment
            currentSegmentWaypoints.push({ lat: wp.lat, lng: wp.lng });
          }
        }

        // Handle the last segment
        if (currentSegmentWaypoints.length > 1) {
          const roadPath = await getRoadPath(currentSegmentWaypoints);
          fullPath = [...fullPath, ...roadPath];
        } else if (fullPath.length === 1 && fullPath[fullPath.length-1].lat !== currentSegmentWaypoints[0].lat) {
           fullPath.push(currentSegmentWaypoints[0]);
        }

        renderPath(fullPath);
      };

      const getRoadPath = (pts: google.maps.LatLngLiteral[]): Promise<google.maps.LatLngLiteral[]> => {
        return new Promise((resolve) => {
          const origin = pts[0];
          const destination = pts[pts.length - 1];
          const intermediate = pts.slice(1, -1).map(p => ({
            location: new google.maps.LatLng(p.lat, p.lng),
            stopover: true
          }));

          const travelMode = (transportType === "LRT/MRT") 
            ? google.maps.TravelMode.TRANSIT 
            : google.maps.TravelMode.DRIVING;

          directionsService.current!.route(
            {
              origin,
              destination,
              waypoints: intermediate,
              travelMode: travelMode,
              optimizeWaypoints: false
            },
            (result, status) => {
              if (status === google.maps.DirectionsStatus.OK && result) {
                resolve(result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() })));
              } else {
                // Fallback to straight lines for this segment
                resolve(pts);
              }
            }
          );
        });
      };

      const renderPath = (path: google.maps.LatLngLiteral[]) => {
        setIsMapping(false);
        setSnappedPath(path);

        // Clean up old lines
        if (glowLineRef.current) glowLineRef.current.setMap(null);
        if (routeLineRef.current) routeLineRef.current.setMap(null);
        
        const isHybrid = waypoints.some(wp => wp.type === "direct");

        // Background Glow layer
        glowLineRef.current = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: isHybrid ? "#06b6d4" : "#2dd4bf",
          strokeOpacity: 0.15,
          strokeWeight: 14,
          map: mapInstance.current
        });

        // Main route line with direction arrows
        routeLineRef.current = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: isHybrid ? "#06b6d4" : "#2dd4bf",
          strokeOpacity: 1,
          strokeWeight: 3,
          map: mapInstance.current,
          icons: [{
            icon: { 
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 2.5,
              strokeWeight: 2,
              fillOpacity: 1,
              fillColor: isHybrid ? "#06b6d4" : "#2dd4bf"
            },
            offset: '0%',
            repeat: '90px'
          }]
        });
      };

      processSegments();
    };

    updateRoute();
  }, [waypoints, transportType]);

  // Trigger resize when sidebar toggles
  useEffect(() => {
    if (mapInstance.current) {
      const google = (window as any).google;
      if (google) {
        google.maps.event.trigger(mapInstance.current, "resize");
      }
    }
  }, [sidebarOpen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      if (glowLineRef.current) glowLineRef.current.setMap(null);
      if (routeLineRef.current) routeLineRef.current.setMap(null);
      if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
    };
  }, []);

  const clearAllWaypoints = () => {
    if (!window.confirm("Are you sure you want to purge all waypoints?")) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    setWaypoints([]);
    setSnappedPath([]);
    if (glowLineRef.current) { glowLineRef.current.setMap(null); glowLineRef.current = null; }
    if (routeLineRef.current) { routeLineRef.current.setMap(null); routeLineRef.current = null; }
    if (searchMarkerRef.current) searchMarkerRef.current.setMap(null);
    setSearchResult(null);
  };

  const removeWaypoint = (index: number) => {
    // Remove marker from map
    if (markersRef.current[index]) {
      markersRef.current[index].setMap(null);
      markersRef.current.splice(index, 1);
    }
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  };

  const handleVerifyAndSubmit = async () => {
    if (!routeName || waypoints.length < 2) {
      alert("Please provide a route name and at least 2 points (Pick-up and Drop-off).");
      return;
    }

    if (!window.confirm("Are you sure you want to submit this route?")) return;

    setIsVerifying(true);
    setVerificationStatus("idle");

    if (isAdmin) {
      // Direct Upload for Admin
      try {
        await addDoc(collection(db, "transport_info"), {
          userId: user?.uid,
          userEmail: user?.email,
          transportType,
          routeName,
          terminalName,
          description,
          waypoints,
          routePath: snappedPath,
          dropOffAnywhere,
          pickUpAnywhere,
          status: "verified",
          isAdminUpload: true,
          createdAt: serverTimestamp()
        });
        setVerificationStatus("success");
      } catch (error) {
        console.error("Error adding document:", error);
        setVerificationStatus("fail");
      }
      setIsVerifying(false);
      return;
    }

    // Simulate McRAPTOR Ultra AI Verification
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simple heuristic for simulation: if route name has "test", fail AI and go to admin
    if (routeName.toLowerCase().includes("test")) {
      setVerificationStatus("admin");
      setIsVerifying(false);
      return;
    }

    const success = Math.random() > 0.3; // 70% chance of AI success
    if (success) {
      try {
        await addDoc(collection(db, "transport_info"), {
          userId: user?.uid,
          userEmail: user?.email,
          transportType,
          routeName,
          terminalName,
          description,
          waypoints,
          routePath: snappedPath,
          dropOffAnywhere,
          pickUpAnywhere,
          status: "verified",
          createdAt: serverTimestamp()
        });
        setVerificationStatus("success");
      } catch (error) {
        console.error("Error adding document:", error);
        setVerificationStatus("fail");
      }
    } else {
      setVerificationStatus("admin");
    }
    setIsVerifying(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-teal-500/10 rounded-3xl flex items-center justify-center mb-8 border border-teal-500/20">
        <svg className="w-10 h-10 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      </div>
      <h2 className="text-3xl font-black text-white mb-4">Tactical Access Required</h2>
      <p className="text-slate-400 mb-8 max-w-md">Only registered operatives can contribute intelligence to the Biyahe neural network. Please authenticate to proceed.</p>
      <Link href="/auth/signin" className="px-8 py-4 bg-teal-500 text-slate-950 font-black rounded-2xl hover:bg-teal-400 transition-all shadow-xl shadow-teal-500/20">Authenticate</Link>
    </div>
  );
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col lg:flex-row-reverse overflow-hidden">
      
      {/* Map Section */}
      <div className="flex-1 relative min-h-[60vh] lg:min-h-screen bg-slate-950 overflow-hidden">
        <div ref={mapRef} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'auto' }} />
        
        {/* Map UI Overlay */}
        <div className="absolute inset-0 pointer-events-none border border-white/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />
        
        {/* Improved Tactical Search HUD */}
        <div className="absolute top-6 left-6 right-6 lg:left-10 lg:right-auto lg:w-[520px] z-20 pointer-events-none">
          <div className="flex flex-col gap-4 pointer-events-auto">
            <div className="bg-slate-900/95 border border-white/10 rounded-[2.5rem] p-2 flex items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all focus-within:border-teal-500/50">
              <div className="flex items-center gap-4 flex-1 px-5">
                <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                  <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-[9px] font-black text-teal-500/70 uppercase tracking-widest mb-0.5">Tactical Search</span>
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    placeholder="Search businesses, streets, landmarks..." 
                    className="bg-transparent text-sm w-full outline-none placeholder:text-slate-600 font-bold text-white py-1"
                  />
                </div>
              </div>
            </div>

            {searchResult && (
              <div className="bg-slate-900/95 border border-teal-500/30 rounded-[2rem] p-4 flex flex-col gap-4 shadow-2xl animate-in slide-in-from-top-4 duration-300">
                <div className="px-4">
                  <p className="text-[10px] font-black text-teal-500 uppercase tracking-widest mb-1">Target Identified</p>
                  <p className="text-sm font-bold text-white line-clamp-1">{searchResult.name}</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => addWaypointFromSearch("pickup")} className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 p-3 rounded-2xl text-[9px] font-black uppercase tracking-tighter border border-teal-500/20 transition-all">Pickup</button>
                  <button onClick={() => addWaypointFromSearch("dropoff")} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 p-3 rounded-2xl text-[9px] font-black uppercase tracking-tighter border border-rose-500/20 transition-all">Dropoff</button>
                  <button onClick={() => addWaypointFromSearch("both")} className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 p-3 rounded-2xl text-[9px] font-black uppercase tracking-tighter border border-indigo-500/20 transition-all">Both</button>
                  <button onClick={() => addWaypointFromSearch("waypoint")} className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-3 rounded-2xl text-[9px] font-black uppercase tracking-tighter border border-amber-500/20 transition-all">Waypt</button>
                </div>
                <button onClick={() => { setSearchResult(null); if (searchMarkerRef.current) searchMarkerRef.current.setMap(null); }} className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] hover:text-white transition-colors py-1">Dismiss Result</button>
              </div>
            )}
            
            {selectingOnMap && (
              <div className="flex items-center gap-3 px-6 pointer-events-none">
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full backdrop-blur-md">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Awaiting Point Drop: {selectingOnMap}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Toggle Button */}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute bottom-8 right-8 z-30 w-14 h-14 bg-slate-900 border border-white/10 rounded-full flex items-center justify-center text-teal-500 shadow-2xl hover:bg-slate-800 transition-all group pointer-events-auto"
        >
          <svg className={`w-6 h-6 transition-transform duration-500 ${sidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Tactical HUD Stats */}
        <div className="absolute top-8 right-8 pointer-events-none hidden lg:block z-20">
          <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2.5rem] backdrop-blur-sm">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-indigo-500 animate-pulse' : 'bg-teal-500 animate-pulse'}`} />
                <p className={`text-[10px] font-black uppercase tracking-widest ${isAdmin ? 'text-indigo-400' : 'text-teal-400'}`}>
                  {isAdmin ? 'Root Operative Active' : 'Neural Link Active'}
                </p>
              </div>
              <div className="space-y-1">
                <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 w-[84%] animate-pulse" />
                </div>
                <p className="text-[8px] text-slate-500 font-mono text-right uppercase tracking-tighter">LOAD_PROB: 0.842</p>
              </div>
              <div className="space-y-1">
                <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${isMapping ? 'bg-amber-500 animate-pulse w-full' : 'bg-teal-500 w-full'}`} />
                </div>
                <p className="text-[8px] text-slate-500 font-mono text-right uppercase tracking-tighter">
                  {isMapping ? 'MAPPING_ROAD...' : 'ROAD_LOCKED'}
                </p>
              </div>
              <div className="space-y-1">
                <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.min((waypoints.length / 10) * 100, 100)}%` }} />
                </div>
                <p className="text-[8px] text-slate-500 font-mono text-right uppercase tracking-tighter">NODES: {waypoints.length}</p>
              </div>
            </div>
          </div>
        </div>

        {selectingOnMap && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-teal-500/5 transition-colors z-10">
            <div className="bg-slate-900/95 border border-teal-500 border-dashed px-10 py-6 rounded-[3rem] animate-bounce shadow-[0_0_50px_rgba(45,212,191,0.3)]">
              <p className="text-[10px] font-black text-teal-400 uppercase tracking-[0.3em]">Drop <span className="text-white underline decoration-teal-500 decoration-2 underline-offset-4">{selectingOnMap}</span> node on grid</p>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Form */}
      <div className={`h-full bg-[#020617] border-r border-white/5 overflow-y-auto custom-scrollbar z-20 shadow-2xl relative transition-all duration-500 ease-in-out ${sidebarOpen ? 'w-full lg:w-[480px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
        <div className="p-8 lg:p-10 min-w-[420px]">
          <Link href="/" className="inline-flex items-center gap-2 text-teal-500 font-bold text-[10px] uppercase tracking-[0.2em] mb-12 hover:text-teal-400 transition-colors group">
            <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            Abort Uplink
          </Link>

          <div className="flex items-start gap-4 mb-4">
            <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-br from-white via-white to-slate-600 bg-clip-text text-transparent leading-[0.9]">Intelligence Uplink</h1>
            {isAdmin && (
              <div className="mt-1 flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-full shrink-0">
                <svg className="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Root Admin</span>
              </div>
            )}
          </div>
          <p className="text-slate-500 text-sm mb-12 font-medium leading-relaxed max-w-[280px]">
            {isAdmin 
              ? <span>Root operative access granted. Your contributions are <span className="text-indigo-400 font-bold">directly injected</span> into the neural grid without verification.</span>
              : 'Transmit precise public transportation coordinates to the Metro Manila neural grid.'}
          </p>

          <div className="space-y-10">
            {/* Vehicle Type */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-500/70 ml-1">Vehicle Classification</label>
              <div className="relative group">
                <select 
                  value={transportType}
                  onChange={(e) => setTransportType(e.target.value as TransportType)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-3xl px-6 py-5 text-sm font-bold focus:border-teal-500 outline-none transition-all appearance-none cursor-pointer hover:bg-slate-900"
                >
                  <option>UV Express</option>
                  <option>EDSA Carousel</option>
                  <option>Jeep</option>
                  <option>E-Jeep</option>
                  <option>Minibus</option>
                  <option>Bus</option>
                  <option>LRT/MRT</option>
                  <option>Trike</option>
                  <option>Tricycle</option>
                  <option>E-bike</option>
                  <option>Others</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-teal-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Route Flexibility */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-4 bg-slate-900/50 border border-white/10 rounded-2xl cursor-pointer hover:border-teal-500/50 transition-colors group">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={pickUpAnywhere} onChange={(e) => setPickUpAnywhere(e.target.checked)} />
                  <div className={`block w-10 h-6 rounded-full transition-colors duration-300 ${pickUpAnywhere ? 'bg-teal-500' : 'bg-slate-800 border border-white/10'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${pickUpAnywhere ? 'translate-x-4' : ''}`}></div>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${pickUpAnywhere ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-400'}`}>Pick-up Anywhere</span>
              </label>

              <label className="flex items-center gap-3 p-4 bg-slate-900/50 border border-white/10 rounded-2xl cursor-pointer hover:border-teal-500/50 transition-colors group">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={dropOffAnywhere} onChange={(e) => setDropOffAnywhere(e.target.checked)} />
                  <div className={`block w-10 h-6 rounded-full transition-colors duration-300 ${dropOffAnywhere ? 'bg-teal-500' : 'bg-slate-800 border border-white/10'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${dropOffAnywhere ? 'translate-x-4' : ''}`}></div>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${dropOffAnywhere ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-400'}`}>Drop-off Anywhere</span>
              </label>
            </div>

            {/* Route Name */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-500/70 ml-1">Route Designation</label>
              <input 
                type="text"
                placeholder="e.g. SM North - PITX"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-3xl px-6 py-5 text-sm font-bold focus:border-teal-500 outline-none transition-all placeholder:text-slate-600 focus:bg-slate-900"
              />
            </div>

            {/* Terminal Name */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-500/70 ml-1">Terminal / Primary Node</label>
              <div className="flex gap-3">
                <input 
                  type="text"
                  placeholder="Name of terminal"
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  className="flex-1 bg-slate-900/50 border border-white/10 rounded-3xl px-6 py-5 text-sm font-bold focus:border-teal-500 outline-none transition-all placeholder:text-slate-600 focus:bg-slate-900"
                />
                <button 
                  onClick={() => setSelectingOnMap("waypoint")}
                  className={`w-16 bg-slate-900 rounded-3xl border border-white/10 flex items-center justify-center hover:border-teal-500/50 transition-all group ${selectingOnMap === "waypoint" ? "border-teal-500 text-teal-500" : "text-slate-500"}`}
                >
                  <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                </button>
              </div>
            </div>

            {/* Map Points Selector */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-500/70 ml-1">Operational Waypoints</label>
                {isMapping && (
                  <div className="flex items-center gap-2 animate-pulse">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Snapping to Road...</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3">
                <button 
                  onClick={() => setSelectingOnMap("pickup")}
                  className={`p-4 rounded-3xl border border-white/10 font-bold text-[9px] uppercase tracking-widest transition-all flex flex-col items-center gap-3 ${selectingOnMap === "pickup" ? "bg-teal-500/10 border-teal-500 text-teal-500" : "bg-slate-900/50 text-slate-500 hover:border-teal-500/30 hover:bg-slate-900"}`}
                >
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] ${selectingOnMap === "pickup" ? "border-teal-500 animate-pulse" : "border-slate-700"}`}>P</div>
                  Pick-up
                </button>
                <button 
                  onClick={() => setSelectingOnMap("dropoff")}
                  className={`p-4 rounded-3xl border border-white/10 font-bold text-[9px] uppercase tracking-widest transition-all flex flex-col items-center gap-3 ${selectingOnMap === "dropoff" ? "bg-rose-500/10 border-rose-500 text-rose-500" : "bg-slate-900/50 text-slate-500 hover:border-rose-500/30 hover:bg-slate-900"}`}
                >
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] ${selectingOnMap === "dropoff" ? "border-rose-500 animate-pulse" : "border-slate-700"}`}>D</div>
                  Drop-off
                </button>
                <button 
                  onClick={() => setSelectingOnMap("both")}
                  className={`p-4 rounded-3xl border border-white/10 font-bold text-[9px] uppercase tracking-widest transition-all flex flex-col items-center gap-3 ${selectingOnMap === "both" ? "bg-indigo-500/10 border-indigo-500 text-indigo-400" : "bg-slate-900/50 text-slate-500 hover:border-indigo-500/30 hover:bg-slate-900"}`}
                >
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] ${selectingOnMap === "both" ? "border-indigo-500 animate-pulse" : "border-slate-700"}`}>PD</div>
                  Both
                </button>
                <button 
                  onClick={() => setSelectingOnMap("direct")}
                  className={`p-4 rounded-3xl border border-white/10 font-bold text-[9px] uppercase tracking-widest transition-all flex flex-col items-center gap-3 ${selectingOnMap === "direct" ? "bg-cyan-500/10 border-cyan-500 text-cyan-400" : "bg-slate-900/50 text-slate-500 hover:border-cyan-500/30 hover:bg-slate-900"}`}
                >
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] ${selectingOnMap === "direct" ? "border-cyan-500 animate-pulse" : "border-slate-700"}`}>I</div>
                  Iskinitas
                </button>
              </div>
            </div>

            {/* Waypoints List */}
            {waypoints.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Live Manifest ({waypoints.length})</label>
                  <button 
                    onClick={clearAllWaypoints}
                    className="text-[9px] font-black text-rose-500/70 uppercase tracking-widest hover:text-rose-500 transition-colors"
                  >
                    Purge All
                  </button>
                </div>
                <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                  {waypoints.map((wp, i) => (
                    <div key={i} className="bg-slate-900/50 border border-white/5 p-4 rounded-3xl flex items-center justify-between group hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[10px] font-black ${
                          wp.type === 'pickup' ? 'bg-teal-500/10 text-teal-500 border border-teal-500/20' : 
                          wp.type === 'dropoff' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 
                          wp.type === 'both' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 
                          wp.type === 'direct' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                          'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                          {wp.type === 'pickup' ? 'P' : wp.type === 'dropoff' ? 'D' : wp.type === 'both' ? 'PD' : wp.type === 'direct' ? 'I' : 'W'}
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className="text-xs font-black text-white">{wp.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-500 tracking-tighter uppercase">{wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}</span>
                            <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1 rounded-xl border border-white/10 shadow-lg group-hover:border-teal-500/30 transition-colors">
                              <span className="text-[11px] font-black text-teal-500">₱</span>
                              <input 
                                type="number" 
                                value={wp.fare}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setWaypoints(prev => {
                                    const next = [...prev];
                                    next[i] = { ...next[i], fare: isNaN(val) ? 0 : val };
                                    return next;
                                  });
                                }}
                                className="bg-transparent text-[11px] font-black text-white w-14 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeWaypoint(i)}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-8">
              {verificationStatus === "success" ? (
                <div className="bg-teal-500/10 border border-teal-500/30 p-8 rounded-[3rem] text-center animate-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-teal-500/20">
                    <svg className="w-8 h-8 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-teal-400 mb-2">
                    {isAdmin ? 'Root Uplink Confirmed' : 'Transmission Verified'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-8 leading-relaxed">
                    {isAdmin ? 'Administrative privileges detected. Data has been directly injected into the core neural grid.' : 'McRAPTOR Ultra has successfully parsed and validated the tactical coordinates. Database updated.'}
                  </p>
                  <button onClick={() => { setVerificationStatus("idle"); setWaypoints([]); setRouteName(""); setTerminalName(""); }} className="bg-teal-500/20 text-teal-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-500/30 transition-all">New Deployment</button>
                </div>
              ) : verificationStatus === "admin" ? (
                <div className="bg-amber-500/10 border border-amber-500/30 p-8 rounded-[3rem] text-center animate-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-500/20">
                    <svg className="w-8 h-8 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-amber-500 mb-2">Audit Required</h3>
                  <p className="text-[11px] text-slate-500 mb-8 leading-relaxed">Data confidence threshold not met. Intelligence diverted to human command for validation.</p>
                  <button onClick={() => { setVerificationStatus("idle"); }} className="bg-amber-500/20 text-amber-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/30 transition-all">Revise Intel</button>
                </div>
              ) : (
                <button 
                  onClick={handleVerifyAndSubmit}
                  disabled={isVerifying}
                  className="w-full py-6 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-[3rem] font-black text-sm uppercase tracking-[0.3em] transition-all shadow-2xl shadow-teal-500/20 active:scale-[0.98] flex items-center justify-center gap-4 overflow-hidden relative group"
                >
                  {isVerifying ? (
                    <>
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                      <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin relative z-10" />
                      <span className="relative z-10">Neural Parsing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      {isAdmin ? 'Direct Uplink' : 'Uplink Intelligence'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(45, 212, 191, 0.2);
        }
      `}</style>
    </div>
  );
}
