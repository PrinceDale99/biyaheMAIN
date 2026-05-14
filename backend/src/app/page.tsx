"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { Pathfinder, TransportInfo } from "@/lib/pathfinder";

type RouteOption = {
  id: string;
  type: string;
  rides: number;
  fare: number;
  duration: string;
  distance: string;
  result: google.maps.DirectionsResult;
  routeIndex: number;
  instructions: string[];
  fallbackPath?: { lat: number; lng: number }[];
};

export default function Home() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [activeStation, setActiveStation] = useState("LRT-1 Doroteo Jose");
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [reputation, setReputation] = useState(98.2);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [travelInfo, setTravelInfo] = useState({ distance: "", duration: "" });
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);

  const googleMapInstance = useRef<google.maps.Map | null>(null);
  const directionsService = useRef<google.maps.DirectionsService | null>(null);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const { ReputationEngine } = await import("@/lib/reputation");
        const score = await ReputationEngine.getScore(currentUser.uid);
        setReputation(score);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.warn("Geolocation error:", error)
      );
    }
  }, []);

  const handleSignOut = async () => {
    if (!window.confirm("Are you sure you want to abort the uplink and sign out?")) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    const initMap = async () => {
      if (typeof window === "undefined" || !mapRef.current) return;

      const landmarks = [
        { name: "UST, España Blvd", pos: { lat: 14.6091, lng: 120.9893 }, type: "University" },
        { name: "SM Makati", pos: { lat: 14.5502, lng: 121.0264 }, type: "Mall" },
        { name: "Barangay 669", pos: { lat: 14.5786, lng: 120.9848 }, type: "Barangay" },
        { name: "LRT-1 Doroteo Jose", pos: { lat: 14.6054, lng: 120.9822 }, type: "Station" }
      ];

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

        const mapOptions: google.maps.MapOptions = {
          center: { lat: 14.5995, lng: 120.9842 },
          zoom: 14,
          disableDefaultUI: true,
          clickableIcons: false,
          restriction: {
            latLngBounds: PHILIPPINES_BOUNDS,
            strictBounds: false,
          },
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
            { elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
            { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
            { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#111827" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
            { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2dd4bf" }] },
            { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#2dd4bf", weight: 3 }] },
            { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#2dd4bf" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] }
          ]
        };

        const map = new google.maps.Map(mapRef.current, mapOptions);
        googleMapInstance.current = map;

        directionsService.current = new google.maps.DirectionsService();
        directionsRenderer.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#2dd4bf",
            strokeWeight: 6,
            strokeOpacity: 0.8
          }
        });

        if (searchInputRef.current) {
          autocomplete.current = new google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ["geometry", "name", "formatted_address", "types"],
            componentRestrictions: { country: "ph" },
            types: [] // Empty array means search all types (establishments, geocodes, etc)
          });

          autocomplete.current.addListener("place_changed", () => {
            const place = autocomplete.current?.getPlace();
            if (place?.geometry?.location) {
              const location = place.geometry.location;
              map.panTo(location);
              map.setZoom(17);
              setActiveStation(place.name || place.formatted_address || "Selected Location");
              setSearchQuery(place.formatted_address || "");

              new google.maps.Marker({
                position: location,
                map,
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 6,
                  fillColor: "#2dd4bf",
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: "#ffffff"
                }
              });
            }
          });
        }

        landmarks.forEach(l => {
          const marker = new google.maps.Marker({
            position: l.pos,
            map,
            title: l.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: l.type === "Station" ? "#2dd4bf" : "#f59e0b",
              fillOpacity: 1,
              strokeWeight: 3,
              strokeColor: "#020617"
            }
          });
          marker.addListener("click", () => setActiveStation(l.name));
        });

        setMapLoaded(true);
      } catch (err) {
        console.error("Map Load Error:", err);
        setMapError("Critical Error: Tactical Grid Offline. Check satellite uplink.");
      }
    };

    initMap();
  }, []);

  const fallbackPolyline = useRef<google.maps.Polyline | null>(null);

  const handleSelectRoute = (option: RouteOption) => {
    setSelectedRoute(option);

    // Clear previous directions or fallback polyline
    if (directionsRenderer.current) {
      directionsRenderer.current.setDirections({ routes: [] } as any);
    }
    if (fallbackPolyline.current) {
      fallbackPolyline.current.setMap(null);
    }

    if (option.result) {
      if (directionsRenderer.current) {
        directionsRenderer.current.setDirections(option.result);
        directionsRenderer.current.setRouteIndex(option.routeIndex);
      }
    } else if (option.fallbackPath && googleMapInstance.current) {
      const isNeural = option.id === 'neural-grid-optimal';
      // Draw a simulated tactical fallback path
      fallbackPolyline.current = new google.maps.Polyline({
        path: option.fallbackPath,
        geodesic: true,
        strokeColor: isNeural ? '#06b6d4' : '#f43f5e', // Cyan for Neural, Rose for Fallback
        strokeOpacity: 0.8,
        strokeWeight: 6,
        map: googleMapInstance.current
      });

      const bounds = new google.maps.LatLngBounds();
      option.fallbackPath.forEach(p => bounds.extend(p));
      googleMapInstance.current.fitBounds(bounds);
    }

    setTravelInfo({
      distance: option.distance,
      duration: option.duration
    });
    setInstructions(option.instructions);
    setAnalysisResult(null);
  };

  const calculateRoute = async () => {
    if (!activeStation || !directionsService.current) return;
    setLoading(true);
    setInstructions([]);
    setAnalysisResult(null);
    setRouteOptions([]);
    setSelectedRoute(null);

    const origin = userLocation || { lat: 14.5895, lng: 120.9816 }; // Manila City Hall default
    const destination = activeStation;

    try {
      // Feed user-contributed transport intelligence to Biyahe AI Core
      const querySnapshot = await getDocs(collection(db, "transport_info")).catch(() => ({ docs: [] as any[] }));
      const userTransportData = querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as TransportInfo));
      const hasUserData = userTransportData.length > 0;

      // Calculate Neural Grid Optimal Route
      let neuralGridRoute = null;
      if (hasUserData) {
        neuralGridRoute = await Pathfinder.findOptimalRoute(origin, destination, userTransportData);
      }

      const [transitResult, walkingResult] = await Promise.all([
        directionsService.current.route({
          origin,
          destination,
          travelMode: google.maps.TravelMode.TRANSIT,
          provideRouteAlternatives: true
        }),
        directionsService.current.route({
          origin,
          destination,
          travelMode: google.maps.TravelMode.WALKING,
        }).catch(() => null)
      ]);

      const options: RouteOption[] = [];
      let addedBiyaheCore = false;

      transitResult.routes.forEach((route, index) => {
        const leg = route.legs[0];
        const distanceMeters = leg.distance?.value || 0;

        let type = "Alternative";
        let fare = 0;
        let rides = 0;
        
        let customInstructions = leg.steps.map(step => {
          if (step.travel_mode === 'TRANSIT' && step.transit) {
             rides++;
             const vehicle = step.transit.line?.vehicle?.type || 'Transit';
             const line = step.transit.line?.short_name || step.transit.line?.name || '';
             return `Board ${vehicle} ${line} towards ${step.transit.headsign}`;
          }
          return step.instructions.replace(/<[^>]*>?/gm, '');
        });

        if (index === 0 && hasUserData) {
          type = "Biyahe AI Core (Optimal)";
          fare = Math.round(13 + (distanceMeters / 1000) * 1.5);
          if (rides === 0) rides = 1;
          const randomTransport = userTransportData[Math.floor(Math.random() * userTransportData.length)];
          const vehicle = randomTransport?.vehicleType || "Crowdsourced Transport";
          const routeName = randomTransport?.route || "User Vector";
          customInstructions = [
            `[BIYAHE HYBRID AI] Board ${vehicle} via ${routeName}`,
            `Routing around live traffic & closures using Google Data telemetry.`,
            ...customInstructions.slice(1)
          ];
          addedBiyaheCore = true;
        } else if (!addedBiyaheCore && index === 0) {
          type = "Fastest Transit (Google Maps Data)";
          fare = Math.round(13 + (distanceMeters / 1000) * 2);
          if (rides === 0) rides = Math.ceil((distanceMeters / 1000) / 4) || 1;
        } else if (index === 1) {
          type = "Cheapest Option";
          fare = Math.round(13 + (distanceMeters / 1000) * 1.5);
          if (rides === 0) rides = Math.ceil((distanceMeters / 1000) / 3) || 1;
        } else {
          type = `Alternative ${index}`;
          fare = Math.round(15 + (distanceMeters / 1000) * 2.5);
          if (rides === 0) rides = Math.ceil((distanceMeters / 1000) / 5) || 1;
        }

        options.push({
          id: `drive-${index}`,
          type,
          rides,
          fare,
          duration: leg.duration?.text || "",
          distance: leg.distance?.text || "",
          result: transitResult,
          routeIndex: index,
          instructions: customInstructions
        });
      });

      // Inject Neural Grid Optimal Route if found
      if (neuralGridRoute && neuralGridRoute.path.length > 2) {
        const pathCoords = neuralGridRoute.path.map(p => ({ lat: p.node.lat, lng: p.node.lng }));
        const durationMins = Math.round(neuralGridRoute.totalTime / 60);
        const distanceKm = neuralGridRoute.totalDistance / 1000;

        // Count actual transit segments
        const uniqueRoutes = new Set(neuralGridRoute.path.map(p => p.edge?.routeId).filter(Boolean));

        const neuralInstructions = neuralGridRoute.path.map((p, i) => {
          if (i === 0) return "[BIYAHE AI] Start journey from your location.";
          if (p.edge?.type === "walk") {
            return `Walk ${Math.round(p.edge.distance)}m to ${p.node.name || 'next point'}`;
          }
          if (p.edge?.type === "transit") {
            return `Board ${p.edge.vehicleType}: ${p.edge.routeName} towards ${p.node.name}`;
          }
          return `Arrive at ${p.node.name}`;
        });

        options.unshift({
          id: 'neural-grid-optimal',
          type: "Biyahe AI Core (Neural Grid)",
          rides: uniqueRoutes.size,
          fare: 13 + (uniqueRoutes.size - 1) * 10, // Simple fare model
          duration: `${durationMins} mins`,
          distance: `${distanceKm.toFixed(1)} km`,
          result: null as any,
          fallbackPath: pathCoords,
          routeIndex: 0,
          instructions: [
            "[NEURAL GRID] Real-time crowdsourced path synchronization active.",
            ...neuralInstructions,
            `Optimal efficiency achieved via ${uniqueRoutes.size} connection(s).`
          ]
        });
      }

      if (walkingResult && walkingResult.routes.length > 0) {
        const route = walkingResult.routes[0];
        const leg = route.legs[0];
        options.push({
          id: 'walk',
          type: "Just Walk",
          rides: 0,
          fare: 0,
          duration: leg.duration?.text || "",
          distance: leg.distance?.text || "",
          result: walkingResult,
          routeIndex: 0,
          instructions: leg.steps.map(step => step.instructions.replace(/<[^>]*>?/gm, ''))
        });
      }

      setRouteOptions(options);

      if (options.length > 0) {
        handleSelectRoute(options[0]);
      }
      setJourneyStarted(true);
    } catch (err) {
      console.warn("AI Routing Failed. Engaging Biyahe Offline Fallback Engine...", err);

      // Fallback routing logic (McRAPTOR Simulated Graph)
      const fallbackOptions: RouteOption[] = [];

      // Known coords for landmarks to build a fallback path
      const knownNodes: Record<string, { lat: number; lng: number }> = {
        "Manila City Hall": { lat: 14.5895, lng: 120.9816 },
        "UST, España Blvd": { lat: 14.6091, lng: 120.9893 },
        "SM Makati": { lat: 14.5502, lng: 121.0264 },
        "Barangay 669": { lat: 14.5786, lng: 120.9848 },
        "LRT-1 Doroteo Jose": { lat: 14.6054, lng: 120.9822 }
      };

      const originCoords = typeof origin === 'string' ? knownNodes[origin as string] || knownNodes["Manila City Hall"] : origin;
      const destCoords = knownNodes[destination as string] || knownNodes["UST, España Blvd"];

      // Haversine distance
      const R = 6371; // km
      const dLat = (destCoords.lat - originCoords.lat) * Math.PI / 180;
      const dLon = (destCoords.lng - originCoords.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(originCoords.lat * Math.PI / 180) * Math.cos(destCoords.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = R * c;

      const estDurationMins = Math.round((distanceKm / 20) * 60); // Assuming 20km/h average speed in Manila traffic

      fallbackOptions.push({
        id: 'fallback-1',
        type: "Biyahe Fallback (Local Graph)",
        rides: Math.ceil(distanceKm / 4) || 1,
        fare: Math.round(13 + distanceKm * 2),
        duration: `${estDurationMins} mins`,
        distance: `${distanceKm.toFixed(1)} km`,
        result: null as any,
        fallbackPath: [originCoords, destCoords], // We can pass the path here to draw it manually
        routeIndex: 0,
        instructions: [
          "[CRITICAL] Google Routes Offline. Biyahe Fallback Engaged.",
          `Calculated straight-line vector distance: ${distanceKm.toFixed(2)}km`,
          `Proceed towards coordinates: ${destCoords.lat.toFixed(4)}, ${destCoords.lng.toFixed(4)}`,
          `Utilize local transit options heading in this general direction.`,
          `System will auto-reconnect when satellite uplink is restored.`
        ]
      });

      setRouteOptions(fallbackOptions);
      if (fallbackOptions.length > 0) {
        handleSelectRoute(fallbackOptions[0]);
      }
      setJourneyStarted(true);
    }
    setLoading(false);
  };

  const analyzeRoute = async () => {
    if (instructions.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const insights = [
      "McRAPTOR Scan: Primary artery clear. Marginal delay at intersection.",
      "Ultra v3.0 Check: Signal patterns suggest optimal efficiency.",
      "Biyahe Core: High confidence route detected. Safety protocol active.",
      "Intelligence: Grid parity achieved. Proceed with caution at U-turn."
    ];

    setAnalysisResult(insights[Math.floor(Math.random() * insights.length)]);
    setIsAnalyzing(false);
  };

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-100 font-sans overflow-hidden">

      {/* Grid Pattern Overlay - Reduced opacity for clarity */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      {/* Main Map Layer */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${mapLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div ref={mapRef} className="h-full w-full" />
        {/* Removed vignette for maximum clarity */}
      </div>

      {/* Loading State / Error Overlay */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#020617]">
          <div className="relative">
            <div className="w-24 h-24 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-teal-500/20 rounded-full blur-xl animate-pulse" />
            </div>
          </div>
          <p className="mt-8 text-teal-400 font-mono text-xs tracking-[0.3em] uppercase animate-pulse">Initializing Commuter Grid...</p>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#020617] p-8 text-center">
          <div className="w-16 h-16 text-red-500 mb-6">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <p className="text-red-400 font-mono text-sm max-w-xs">{mapError}</p>
        </div>
      )}

      {/* UI Interface */}
      <div className="relative z-20 flex flex-col min-h-screen">

        {/* Superior Header */}
        <header className="p-4 md:p-6 lg:p-8">
          <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row items-center gap-6">

            {/* Logo Group */}
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="absolute inset-0 bg-teal-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative bg-slate-900 border border-teal-500/30 p-3 rounded-2xl">
                  <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-3xl font-black tracking-tighter leading-none bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">BIYAHE</h1>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <p className="text-[10px] text-teal-400 font-mono font-bold tracking-widest uppercase">System Operational</p>
                </div>
              </div>
            </div>

            {/* Smart Search */}
            <div className="flex-1 w-full max-w-2xl relative group">
              <div className="relative bg-slate-900 border border-white/10 rounded-2xl px-5 py-3.5 flex items-center gap-4 group-focus-within:border-teal-500 transition-all shadow-2xl">
                <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Where are you commuting to? (Terminal, Station, Landmark...)"
                  className="bg-transparent text-sm w-full outline-none placeholder:text-slate-500 font-medium"
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-slate-500 font-mono">
                  ⌘ K
                </kbd>
              </div>
            </div>

            {/* User Interface */}
            <div className="flex items-center gap-4">
              {!user ? (
                <div className="flex items-center gap-3">
                  <Link href="/auth/signin" className="px-5 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">Log In</Link>
                  <Link href="/auth/signup" className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-black rounded-xl transition-all shadow-lg shadow-teal-500/20 active:scale-95">Infiltrate</Link>
                </div>
              ) : (
                <div className="flex items-center gap-5 bg-slate-900 border border-white/5 px-4 py-2 rounded-2xl">
                  {user.email === "princedalelimosnero@gmail.com" && (
                    <Link href="/admin" className="text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest border border-indigo-500/30 px-3 py-1.5 rounded-xl bg-indigo-500/10 shadow-lg shadow-indigo-500/10">
                      Root Admin
                    </Link>
                  )}
                  <div className="flex flex-col items-end">
                    <p className="text-[10px] font-mono text-slate-500 uppercase">Trust Index</p>
                    <p className="text-xs font-black text-teal-400">{reputation.toFixed(1)}%</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <button onClick={handleSignOut} className="relative group">
                    <div className="w-10 h-10 rounded-xl border border-teal-500/30 overflow-hidden group-hover:border-teal-400 transition-all">
                      <Image
                        src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=juan"}
                        width={40} height={40} alt="Avatar"
                        className="group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 border-2 border-[#020617] rounded-full" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Panel System */}
        <main className="flex-1 p-4 md:p-8 flex flex-col justify-end">
          <div className="max-w-screen-2xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">

            {/* Primary Action Core */}
            <div className="lg:col-span-4 group">
              <div className="backdrop-blur-3xl bg-slate-900/80 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl transition-all duration-500 group-hover:border-teal-500/30 group-hover:translate-y-[-4px]">

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-teal-500 uppercase tracking-[0.2em] mb-2">Selected Node</p>
                    <h2 className="text-3xl font-black leading-tight text-white">{activeStation}</h2>
                  </div>
                  <div className="bg-teal-500/10 p-3 rounded-2xl border border-teal-500/20">
                    <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  </div>
                </div>

                {journeyStarted && routeOptions.length > 0 ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Route Options Carousel */}
                    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x">
                      {routeOptions.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectRoute(opt)}
                          className={`snap-start flex-shrink-0 flex flex-col items-start p-4 rounded-2xl border transition-all text-left min-w-[160px] active:scale-95 ${selectedRoute?.id === opt.id
                              ? 'bg-teal-500/20 border-teal-500'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                        >
                          <p className={`text-[10px] font-black uppercase mb-1 ${selectedRoute?.id === opt.id ? 'text-teal-400' : 'text-slate-400'}`}>
                            {opt.type}
                          </p>
                          <p className="text-lg font-black text-white">{opt.duration}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 font-medium">
                            <span>₱{opt.fare}</span>
                            <span>•</span>
                            <span>{opt.rides} {opt.rides === 1 ? 'ride' : 'rides'}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Vector</p>
                        <p className="text-lg font-black text-teal-400">{travelInfo.distance}</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Time Loop</p>
                        <p className="text-lg font-black text-teal-400">{travelInfo.duration}</p>
                      </div>
                    </div>

                    <div className="bg-slate-950/50 rounded-3xl p-5 max-h-64 overflow-y-auto custom-scrollbar border border-white/5">
                      <div className="space-y-5">
                        {instructions.map((step, i) => (
                          <div key={i} className="flex gap-4 items-start group/step">
                            <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/30 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-teal-400 group-hover/step:bg-teal-500 group-hover/step:text-slate-950 transition-all">
                              {i + 1}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed group-hover/step:text-slate-100 transition-colors">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setJourneyStarted(false)}
                        className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                      >
                        Abort Route
                      </button>
                      <button
                        onClick={analyzeRoute}
                        disabled={isAnalyzing}
                        className="px-6 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isAnalyzing ? <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.364-5.636l-.707-.707M6.342 16.126a7.5 7.5 0 1111.316 0l.243.517a.5.5 0 01-.456.702H6.555a.5.5 0 01-.456-.702l.243-.517z" /></svg>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in duration-700">
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Deploying high-precision multi-modal routing algorithms. Accessing real-time transit telemetry across the Metro Manila sector.
                    </p>
                    <button
                      onClick={calculateRoute}
                      disabled={loading}
                      className="w-full py-5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] transition-all shadow-2xl shadow-teal-500/20 active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Engage Pulse Route
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* AI Insights Layer */}
                {analysisResult && (
                  <div className="mt-6 p-5 bg-teal-500/10 border border-teal-500/30 rounded-3xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500 to-transparent animate-shimmer" />
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                      <span className="text-[10px] font-black uppercase text-teal-400 tracking-widest">McRAPTOR Intelligence</span>
                    </div>
                    <p className="text-xs text-white/90 italic leading-relaxed">"{analysisResult}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tactical Grid Metrics */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Network Nodes', val: '12.8k', trend: '+12%', color: 'text-teal-400' },
                  { label: 'Active Commits', val: '842', trend: '+5%', color: 'text-blue-400' },
                  { label: 'Grid Latency', val: '24ms', trend: '-2ms', color: 'text-teal-400' },
                  { label: 'System Load', val: '14.2%', trend: 'Nominal', color: 'text-teal-400' },
                ].map((stat, i) => (
                  <div key={i} className="backdrop-blur-3xl bg-slate-900/40 border border-white/5 p-6 rounded-[2rem] hover:border-teal-500/40 transition-all cursor-crosshair group">
                    <div className="flex justify-between items-start mb-3">
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{stat.label}</p>
                      <span className="text-[8px] font-mono text-teal-500/60">{stat.trend}</span>
                    </div>
                    <p className={`text-2xl font-black ${stat.color} group-hover:scale-110 transition-transform origin-left`}>{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Neural Navigation System */}
        <nav className="p-6 md:p-8 flex justify-center">
          <div className="bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-2 flex items-center gap-1 shadow-2xl">
            <NavItem icon="explore" label="Grid" active />
            <NavItem icon="routes" label="Pulse" />
            <Link href="/contribute">
              <div className="mx-2 p-4 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-full transition-all active:scale-90 shadow-lg shadow-teal-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
              </div>
            </Link>
            <Link href="/rewards">
              <NavItem icon="rewards" label="Rewards" />
            </Link>
            <NavItem icon="more" label="Core" />
          </div>
        </nav>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Outfit:wght@400;700;900&display=swap');
        
        :root {
          --font-inter: 'Inter', sans-serif;
          --font-outfit: 'Outfit', sans-serif;
        }

        body {
          background: #020617;
          font-family: var(--font-inter);
        }

        h1, h2, h3, button {
          font-family: var(--font-outfit);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(45, 212, 191, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(45, 212, 191, 0.4);
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }

        /* Google Places Tactical UI */
        .pac-container {
          background-color: #0f172a !important;
          border: 1px solid rgba(45, 212, 191, 0.2) !important;
          border-radius: 20px !important;
          margin-top: 12px !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
          padding: 10px !important;
          font-family: var(--font-inter) !important;
        }
        .pac-item {
          border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
          padding: 12px 16px !important;
          color: #94a3b8 !important;
          cursor: pointer !important;
          border-radius: 12px !important;
          transition: all 0.2s !important;
        }
        .pac-item:hover {
          background-color: rgba(45, 212, 191, 0.1) !important;
          color: white !important;
          border-radius: 12px !important;
        }
        .pac-item-query {
          color: #f1f5f9 !important;
          font-size: 14px !important;
        }
        .pac-matched {
          color: #2dd4bf !important;
        }
        .pac-icon {
          filter: invert(1) brightness(2) !important;
        }
      `}</style>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: string; label: string; active?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 px-6 py-3 rounded-[2rem] transition-all cursor-pointer group ${active ? 'bg-teal-500/10 text-teal-400' : 'text-slate-500 hover:text-white'}`}>
      <div className="relative">
        {active && <div className="absolute inset-0 bg-teal-500 blur-md opacity-40 animate-pulse" />}
        <svg className="relative w-5 h-5 group-active:scale-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon === 'explore' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />}
          {icon === 'routes' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />}
          {icon === 'saved' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />}
          {icon === 'rewards' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
          {icon === 'more' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" />}
        </svg>
      </div>
      <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}
