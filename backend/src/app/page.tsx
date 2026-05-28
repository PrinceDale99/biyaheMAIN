"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { Pathfinder, TransportInfo } from "@/lib/pathfinder";
import { TopNav } from "@/components/layout/TopNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { RoutingPanel } from "@/components/layout/RoutingPanel";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { loadGoogleMaps } from "@/lib/google-maps";

// Replace with your Mapbox Access Token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';


type RouteSegment = {
  type: 'walk' | 'transit';
  coordinates: [number, number][];
};
type RouteOption = {
  id: string;
  type: string;
  rides: number;
  fare: number;
  duration: string;
  distance: string;
  geometry?: any; 
  segments?: RouteSegment[];
  instructions: string[];
  comfort?: number;
  reliability?: number;
};

export type RoutingPreference = 'recommended' | 'fastest' | 'cheapest' | 'walk';

const calculateBearing = (start: [number, number], end: [number, number]): number => {
  const startLat = (start[1] * Math.PI) / 180;
  const startLng = (start[0] * Math.PI) / 180;
  const endLat = (end[1] * Math.PI) / 180;
  const endLng = (end[0] * Math.PI) / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

export default function Home() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastLocRef = useRef<[number, number] | null>(null);
  const googleServices = useRef<{
    directionsService: google.maps.DirectionsService | null;
    placesService: google.maps.places.PlacesService | null;
    autocompleteService: google.maps.places.AutocompleteService | null;
  }>({ directionsService: null, placesService: null, autocompleteService: null });
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [activeStation, setActiveStation] = useState("LRT-1 Doroteo Jose");
  const [destinationCoords, setDestinationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [reputation, setReputation] = useState(98.2);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [travelInfo, setTravelInfo] = useState({ distance: "", duration: "" });
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [routingPreference, setRoutingPreference] = useState<RoutingPreference>('recommended');
  const [currentHeading, setCurrentHeading] = useState(0);
  const [showLegend, setShowLegend] = useState(false);
  
  // Backend loading states
  const [backendStatus, setBackendStatus] = useState<"checking" | "active" | "failed">("checking");
  const [backendCheckMessage, setBackendCheckMessage] = useState("Initializing tactical grid...");

  const searchMarker = useRef<mapboxgl.Marker | null>(null);

  const speak = async (text: string) => {
    if (typeof window === 'undefined') return;

    // 1. Try Google TTS API first if online
    if (navigator.onLine) {
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (response.ok) {
          const { audioContent } = await response.json();
          const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
          audio.play();
          return; // Success, exit
        }
      } catch (e) {
        console.warn('[TTS] Google API failed, falling back to browser TTS:', e);
      }
    }

    // 2. Fallback to default Web Speech API
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (isNavigating && instructions.length > 0) {
      const cleanText = instructions[0].replace(/<[^>]*>?/gm, '');
      speak(`Starting navigation. ${cleanText}`);
    }
  }, [isNavigating, instructions]);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 36; // 3 mins total (5s * 36)
    
    const checkBackend = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://biyahemain.onrender.com';
        const res = await fetch(`${backendUrl}/api/health`, { method: 'GET', signal: AbortSignal.timeout(4500) });
        if (res.ok) {
          setBackendStatus("active");
          return;
        }
      } catch (e) {
        // Silently wait for backend to wake up
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        setBackendStatus("failed");
        setBackendCheckMessage("Backend cannot be initialized. Neural link severed.");
      } else {
        setBackendCheckMessage(`Establishing uplink... (Attempt ${attempts}/${maxAttempts})`);
        setTimeout(checkBackend, 5000);
      }
    };
    
    checkBackend();
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      googleServices.current = {
        directionsService: new google.maps.DirectionsService(),
        placesService: new google.maps.places.PlacesService(document.createElement('div')),
        autocompleteService: new google.maps.places.AutocompleteService(),
      };

      if (searchInputRef.current) {
        const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
          componentRestrictions: { country: "ph" },
          fields: ["address_components", "geometry", "name", "formatted_address"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (place.geometry && place.geometry.location) {
            const pos: [number, number] = [place.geometry.location.lng(), place.geometry.location.lat()];
            const coords = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };

            setActiveStation(place.name || place.formatted_address || "");
            setDestinationCoords(coords);

            if (mapInstance.current) {
              mapInstance.current.flyTo({ center: pos, zoom: 16 });

              if (searchMarker.current) searchMarker.current.remove();
              searchMarker.current = new mapboxgl.Marker({ color: '#2dd4bf' })
                .setLngLat(pos)
                .setPopup(new mapboxgl.Popup().setHTML(`<div className="p-3 text-slate-900"><h3 className="font-black uppercase text-xs mb-1">${place.name}</h3><p className="text-[10px] text-slate-600 font-medium">${place.formatted_address}</p></div>`))
                .addTo(mapInstance.current);
            }
          }
        });
      }
    });
  }, []);
  useEffect(() => {
    if (!auth) return;
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
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLoc: [number, number] = [position.coords.longitude, position.coords.latitude];
          let heading = position.coords.heading;

          // Calculate heading if not provided by device
          if (heading === null && lastLocRef.current) {
            const [lng1, lat1] = lastLocRef.current;
            const [lng2, lat2] = newLoc;
            const dist = Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2));
            if (dist > 0.00001) { // ~1m movement
              heading = calculateBearing(lastLocRef.current, newLoc);
            }
          }

          if (mapInstance.current) {
            // Update User Marker
            if (!userMarkerRef.current) {
              const el = document.createElement('div');
              el.className = 'user-location-marker';
              el.innerHTML = `
                <div class="relative w-8 h-8 flex items-center justify-center">
                  <div class="absolute inset-0 bg-teal-500/20 rounded-full animate-ping"></div>
                  <div class="relative w-4 h-4 bg-teal-500 rounded-full border-2 border-slate-900 shadow-[0_0_15px_rgba(20,184,166,0.6)]"></div>
                  <div class="absolute -top-1 pointer-events-none transition-transform duration-300" style="transform: rotate(${heading || 0}deg) translateY(-6px)">
                    <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-teal-400"></div>
                  </div>
                </div>
              `;
              userMarkerRef.current = new mapboxgl.Marker({ element: el })
                .setLngLat(newLoc)
                .addTo(mapInstance.current);
            } else {
              userMarkerRef.current.setLngLat(newLoc);
              const arrow = userMarkerRef.current.getElement().querySelector('.absolute.-top-1') as HTMLElement;
              if (arrow) arrow.style.transform = `rotate(${heading || 0}deg) translateY(-6px)`;
            }

            // Initial fly-to user location
            if (!lastLocRef.current) {
              mapInstance.current.flyTo({ center: newLoc, zoom: 15 });
            }

            if (isNavigating) {
              updateChaseCam(newLoc, heading || 0);
            }
          }

          lastLocRef.current = newLoc;
          setUserLocation(newLoc);
        },
        (error) => console.warn("Geolocation error:", error),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isNavigating]);

  const updateChaseCam = (lngLat: [number, number], heading: number) => {
    if (!mapInstance.current) return;
    setCurrentHeading(heading);
    
    // Low-level camera control for 3D navigation feel
    const camera = mapInstance.current.getFreeCameraOptions();

    // Position camera behind user based on heading
    const rad = (heading || 0) * (Math.PI / 180);
    const offset = 0.0008; // slightly closer for better detail
    const camLng = lngLat[0] - Math.sin(rad) * offset;
    const camLat = lngLat[1] - Math.cos(rad) * offset;
    
    camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
      [camLng, camLat],
      120 // altitude in meters, lower for more immersive 3D
    );

    camera.lookAtPoint(lngLat);
    
    // Apply camera options
    mapInstance.current.setFreeCameraOptions(camera);
  };

  const handleSignOut = async () => {
    if (!window.confirm("Are you sure you want to sign out?")) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || !mapboxgl.accessToken) return;

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/dark-v11', // High-contrast tactical style
      center: [120.9842, 14.5995],
      zoom: 14,
      pitch: 45,
      antialias: true
    });

    mapInstance.current = map;

    map.on('style.load', () => {
      // Add 3D terrain
      map.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
      });
      map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });

      // Add Pedestrian Infrastructure Layers
      // Sidewalks & Pedestrian Lanes
      map.addLayer({
        'id': 'pedestrian-sidewalks',
        'type': 'line',
        'source': 'composite',
        'source-layer': 'road',
        'filter': ['in', ['get', 'class'], ['literal', ['sidewalk', 'pedestrian', 'footway', 'path']]],
        'paint': {
          'line-color': '#2dd4bf',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 3],
          'line-opacity': 0.4
        }
      });

      // Crossings
      map.addLayer({
        'id': 'pedestrian-crossings',
        'type': 'line',
        'source': 'composite',
        'source-layer': 'road',
        'filter': ['==', ['get', 'class'], 'crossing'],
        'paint': {
          'line-color': '#2dd4bf',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 18, 6],
          'line-dasharray': [1, 1],
          'line-opacity': 0.8
        }
      });

      // Stairs
      map.addLayer({
        'id': 'pedestrian-stairs',
        'type': 'line',
        'source': 'composite',
        'source-layer': 'road',
        'filter': ['==', ['get', 'class'], 'stair'],
        'paint': {
          'line-color': '#f43f5e', // Rose
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 4, 18, 12],
          'line-dasharray': [0.2, 0.2],
          'line-opacity': 0.9
        }
      });

      // Bridges & Overpasses
      map.addLayer({
        'id': 'pedestrian-bridges',
        'type': 'line',
        'source': 'composite',
        'source-layer': 'road',
        'filter': ['all', 
          ['==', ['get', 'structure'], 'bridge'],
          ['in', ['get', 'class'], ['literal', ['pedestrian', 'footway', 'path', 'sidewalk']]]
        ],
        'paint': {
          'line-color': '#fbbf24', // Amber
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 4, 18, 12],
          'line-opacity': 0.9,
          'line-blur': 0.5
        }
      });

      // Add 3D buildings
      map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#334155',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.6
        }
      });

      setMapLoaded(true);
    });

    return () => map.remove();
  }, []);

  const MapLegend = () => (
    <div className={`absolute top-24 right-4 z-30 transition-all duration-500 transform ${showLegend ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
      <div className="bg-slate-900/90 border border-teal-500/30 p-5 rounded-3xl backdrop-blur-2xl shadow-2xl w-64 pointer-events-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase text-teal-400 tracking-widest">Tactical Legend</h3>
          <button onClick={() => setShowLegend(false)} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Pedestrian Lane', color: '#2dd4bf', dash: 'dashed' },
            { label: 'Footbridge / Overpass', color: '#fbbf24', dash: 'solid', glow: true },
            { label: 'Stairs / Elevation', color: '#f43f5e', dash: 'dotted' },
            { label: 'Standard Sidewalk', color: '#2dd4bf', opacity: 0.4 },
            { label: 'Transit Route', color: '#2dd4bf', width: 'h-1.5' },
            { label: 'Walking Segment', color: '#94a3b8', dash: 'dashed' }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 flex justify-center">
                <div 
                  className={`w-full ${item.width || 'h-1'} rounded-full ${item.dash === 'dashed' ? 'border-t-2 border-dashed' : item.dash === 'dotted' ? 'border-t-2 border-dotted' : 'bg-current'}`}
                  style={{ 
                    color: item.color, 
                    backgroundColor: (item.dash === 'solid' || !item.dash) ? item.color : 'transparent',
                    opacity: item.opacity || 1,
                    boxShadow: item.glow ? `0 0 10px ${item.color}` : 'none'
                  }}
                />
              </div>
              <span className="text-[10px] font-black uppercase text-slate-300">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-[9px] text-slate-500 leading-tight">Infrastructure types are weighted by safety and effort in route calculations.</p>
        </div>
      </div>
    </div>
  );

  const handleSelectRoute = (option: RouteOption) => {
    setSelectedRoute(option);
    if (!mapInstance.current) return;

    // Clear existing routes
    const existingLayers = ['route-layer-transit', 'route-layer-walk', 'route-layer'];
    const existingSources = ['route-transit', 'route-walk', 'route'];

    existingLayers.forEach(l => {
      if (mapInstance.current?.getLayer(l)) mapInstance.current.removeLayer(l);
    });
    existingSources.forEach(s => {
      if (mapInstance.current?.getSource(s)) mapInstance.current.removeSource(s);
    });

    if (option.segments) {
      const transitSegments = option.segments.filter(s => s.type === 'transit');
      const walkSegments = option.segments.filter(s => s.type === 'walk');

      if (transitSegments.length > 0) {
        mapInstance.current.addSource('route-transit', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: transitSegments.map(s => ({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: s.coordinates }
            }))
          }
        });
        mapInstance.current.addLayer({
          id: 'route-layer-transit',
          type: 'line',
          source: 'route-transit',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2dd4bf', 'line-width': 6, 'line-opacity': 0.8 }
        });
      }

      if (walkSegments.length > 0) {
        mapInstance.current.addSource('route-walk', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: walkSegments.map(s => ({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: s.coordinates }
            }))
          }
        });
        mapInstance.current.addLayer({
          id: 'route-layer-walk',
          type: 'line',
          source: 'route-walk',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 
            'line-color': '#94a3b8', 
            'line-width': 4, 
            'line-opacity': 0.6,
            'line-dasharray': [2, 2]
          }
        });
      }

      // Fit bounds
      const allCoords = option.segments.flatMap(s => s.coordinates);
      if (allCoords.length > 0) {
        const bounds = allCoords.reduce((acc: mapboxgl.LngLatBounds, coord: [number, number]) => {
          return acc.extend(coord);
        }, new mapboxgl.LngLatBounds(allCoords[0], allCoords[0]));
        mapInstance.current.fitBounds(bounds, { padding: 50 });
      }
    } else if (option.geometry) {
      // Fallback for single geometry (e.g. from pathfinder)
      mapInstance.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: option.geometry
        }
      });
      mapInstance.current.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2dd4bf', 'line-width': 6, 'line-opacity': 0.8 }
      });

      const coordinates = option.geometry.coordinates;
      const bounds = coordinates.reduce((acc: mapboxgl.LngLatBounds, coord: [number, number]) => {
        return acc.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
      mapInstance.current.fitBounds(bounds, { padding: 50 });
    }

    setTravelInfo({ distance: option.distance, duration: option.duration });
    setInstructions(option.instructions);
    setAnalysisResult(null);
  };

  const calculateRoute = async () => {
    if (!activeStation || !googleServices.current.directionsService) return;
    setLoading(true);
    
    const origin = userLocation ? { lat: userLocation[1], lng: userLocation[0] } : { lat: 14.5895, lng: 120.9816 };
    const destination = destinationCoords || activeStation;
    
    try {
      const travelMode = routingPreference === 'walk' ? google.maps.TravelMode.WALKING : google.maps.TravelMode.TRANSIT;
      
      const request: google.maps.DirectionsRequest = {
        origin: origin,
        destination: destination,
        travelMode: travelMode,
        transitOptions: travelMode === google.maps.TravelMode.TRANSIT ? {
          modes: [
            google.maps.TransitMode.RAIL, 
            google.maps.TransitMode.SUBWAY, 
            google.maps.TransitMode.TRAIN,
            google.maps.TransitMode.BUS
          ],
          routingPreference: routingPreference === 'cheapest' 
            ? google.maps.TransitRoutePreference.LESS_WALKING 
            : google.maps.TransitRoutePreference.FEWER_TRANSFERS
        } : undefined,
        provideRouteAlternatives: true,
      };

      googleServices.current.directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const options: RouteOption[] = result.routes.map((route, index) => {
            const leg = route.legs[0];
            const transitSteps = leg.steps.filter(step => step.travel_mode === google.maps.TravelMode.TRANSIT);
            
            const segments: RouteSegment[] = leg.steps.map(step => ({
              type: step.travel_mode === google.maps.TravelMode.TRANSIT ? 'transit' : 'walk',
              coordinates: step.path.map(p => [p.lng(), p.lat()])
            }));

            let routeType = "Multi-Modal";
            if (transitSteps.length > 0) {
              // Extract accurate transit line names (e.g., LRT-1, MRT-3, BEEP)
              routeType = transitSteps.map(s => {
                const line = s.transit?.line;
                return line?.short_name || line?.name || "Transit";
              }).join(' → ');
            } else if (travelMode === google.maps.TravelMode.WALKING) {
              routeType = "Walking Only";
            }

            // Accurate ETA from real-time data
            const arrivalTime = leg.arrival_time ? ` (Arrive ${leg.arrival_time.text})` : "";
            const durationText = `${leg.duration?.text}${arrivalTime}`;

            return {
              id: `google-route-${index}`,
              type: routeType,
              rides: transitSteps.length,
              fare: 0, // Google doesn't provide fare for all modes in PH, we keep it 0 or estimate
              duration: durationText,
              distance: leg.distance?.text || "",
              segments: segments,
              instructions: leg.steps.map(step => {
                if (step.travel_mode === google.maps.TravelMode.TRANSIT && step.transit) {
                  const t = step.transit;
                  return `Board ${t.line.short_name || t.line.name} at ${t.departure_stop.name} toward ${t.headsign}. Alight at ${t.arrival_stop.name}.`;
                }
                return step.instructions || "";
              })
            };
          });

          setRouteOptions(options);
          handleSelectRoute(options[0]);
          setJourneyStarted(true);
        } else {
          console.error("Directions request failed:", status);
          fallbackToPathfinder(origin);
        }
        setLoading(false);
      });
    } catch (error) {
      console.error("Routing error:", error);
      setLoading(false);
    }
  };

  const fallbackToPathfinder = async (origin: {lat: number, lng: number}) => {
    try {
      const result = await Pathfinder.findOptimalRoute(origin, activeStation);

      if (!result || !result.path || result.path.length < 2) {
        alert("No route found to that station.");
        return;
      }

      const simulatedPath: [number, number][] = result.path.map(p => [p.node.lng, p.node.lat]);

      // Calculate instructions
      const pathInstructions: string[] = [];
      let currentTransitRoute = "";
      
      result.path.forEach((p, idx) => {
        if (p.edge?.type === 'walk') {
          let action = "Walk";
          if ((p.node.type as string) === "stairs") action = "Take stairs";
          if ((p.node.type as string) === "footbridge") action = "Cross footbridge";
          if ((p.node.type as string) === "overpass") action = "Use overpass";
          if ((p.node.type as string) === "pedestrian_lane") action = "Use pedestrian lane";

          if (idx === 0) pathInstructions.push(`${action} to ${p.node.name} (${Math.round(p.edge.distance)}m)`);
          else if (currentTransitRoute) {
            pathInstructions.push(`Alight at ${result.path[idx-1].node.name} and ${action.toLowerCase()} to ${p.node.name}`);
            currentTransitRoute = "";
          } else {
            pathInstructions.push(`${action} to ${p.node.name}`);
          }
        } else if (p.edge?.type === 'transit') {
          if (p.edge.routeName !== currentTransitRoute) {
            pathInstructions.push(`Board ${p.edge.vehicleType} (${p.edge.routeName}) at ${result.path[idx-1].node.name}`);
            currentTransitRoute = p.edge.routeName || "";
          }
        }
      });
      pathInstructions.push(`Arrive at ${result.path[result.path.length-1].node.name}.`);

      const segments: RouteSegment[] = result.path.map((p, idx) => ({
        type: p.edge?.type === 'transit' ? 'transit' : 'walk',
        coordinates: idx === 0 ? [[origin.lng, origin.lat], [p.node.lng, p.node.lat]] : [
          [result.path[idx-1].node.lng, result.path[idx-1].node.lat],
          [p.node.lng, p.node.lat]
        ]
      }));

      const options: RouteOption[] = [
        {
          id: 'biyahe-optimal',
          type: "Fastest Local Route",
          rides: result.path.filter(p => p.edge?.type === 'transit').length,
          fare: 15,
          duration: `${Math.round(result.totalTime / 60)} mins`,
          distance: `${(result.totalDistance / 1000).toFixed(1)} km`,
          segments: segments,
          instructions: pathInstructions,
          comfort: result.comfort,
          reliability: result.reliability
        }
      ];

      setRouteOptions(options);
      handleSelectRoute(options[0]);
      setJourneyStarted(true);
    } catch (error) {
      console.error("Fallback error:", error);
      alert("No route found. Please check your destination.");
    }
  };

  const startNavigation = () => {
    setIsNavigating(true);
    if (mapInstance.current) {
      mapInstance.current.setZoom(18);
      mapInstance.current.setPitch(60);
    }
  };

  const analyzeRoute = async () => {
    if (routeOptions.length === 0) return;
    setIsAnalyzing(true);
    try {
      const { AIAnalyzer } = await import("@/lib/ai-analyzer");
      const result = await AIAnalyzer.analyzeOptimalRoute(
        routeOptions.map(r => ({
          type: r.type,
          duration: r.duration,
          distance: r.distance,
          fare: r.fare,
          rides: r.rides,
          instructions: r.instructions
        })),
        activeStation,
        routingPreference
      );
      setAnalysisResult(result);
    } catch (error) {
      console.error("AI Analysis error:", error);
      setAnalysisResult("System encountered an error during analysis. Proceed with the recommended route.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col">
      {/* Background Map Layer */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${mapLoaded ? 'opacity-100' : 'opacity-20'}`}>
        <div ref={mapRef} className="h-full w-full" />
      </div>

      {/* Floating Legend Toggle */}
      {mapLoaded && !isNavigating && (
        <button 
          onClick={() => setShowLegend(!showLegend)}
          className="absolute top-24 right-4 z-40 p-3 bg-slate-900/80 border border-white/10 rounded-2xl backdrop-blur-xl text-teal-400 hover:text-white hover:border-teal-500/50 transition-all active:scale-95 group shadow-2xl"
          title="Map Legend"
        >
          <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>
      )}

      {/* Tactical Navigation Overlay */}
      {isNavigating && (
        <div className="absolute inset-0 pointer-events-none z-20">
          
          {/* Desktop Top Bar */}
          <div className="hidden md:flex absolute top-8 left-6 right-6 justify-between items-start">
            <div className="w-1/3"></div>
            <div className="w-1/3 flex justify-center">
              <span className="text-teal-400 font-black tracking-widest text-xs uppercase bg-slate-900/80 px-5 py-2 rounded-full backdrop-blur-md border border-teal-500/30 shadow-lg">THE 3D ARROW GUIDE</span>
            </div>
            <div className="w-1/3 flex justify-end pointer-events-auto">
              <button 
                onClick={() => setIsNavigating(false)}
                className="px-6 py-2.5 bg-slate-900/90 border-2 border-white text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all active:scale-95 shadow-xl"
              >
                CANCEL
              </button>
            </div>
          </div>

          {/* Mobile Top Bar */}
          <div className="md:hidden absolute top-4 left-4 right-4 flex flex-col gap-3">
            <div className="relative bg-slate-900/95 border border-teal-500/30 rounded-[2rem] p-5 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center pointer-events-auto">
              <p className="text-white font-black text-xl text-center">
                {travelInfo.distance} left, ETA {travelInfo.duration}
              </p>
              <button 
                onClick={() => setIsNavigating(false)}
                className="absolute -top-2 -right-2 w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white border-2 border-slate-700 shadow-xl hover:bg-red-500 transition-colors active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="pl-3">
              <span className="text-slate-300 font-black tracking-widest text-[10px] uppercase leading-snug flex flex-col drop-shadow-md">
                <span>The 3D</span>
                <span>Arrow</span>
                <span>Guide</span>
              </span>
            </div>
          </div>

          {/* Center Compass Arrow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div 
              className="w-32 h-32 border-2 border-teal-500/20 rounded-full flex items-center justify-center backdrop-blur-sm bg-teal-500/5 shadow-[0_0_80px_rgba(20,184,166,0.1)] transition-transform duration-500 ease-out"
              style={{ transform: `rotate(${currentHeading}deg)` }}
            >
              <div className="relative">
                <svg className="w-16 h-16 text-teal-400 filter drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                </svg>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-black text-teal-500 tracking-tighter">N</div>
              </div>
            </div>
          </div>
          
          {/* Desktop Bottom Bar */}
          <div className="hidden md:flex absolute bottom-10 left-6 right-6 justify-between items-end">
            <div className="w-1/3"></div>
            <div className="w-1/3 flex justify-center pointer-events-auto">
              <div className="bg-slate-900/90 border border-teal-500/30 px-6 py-4 rounded-3xl backdrop-blur-2xl max-w-md w-full text-center shadow-2xl">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                  <span className="text-[9px] font-black text-teal-500 uppercase tracking-[0.2em]">Next Maneuver</span>
                </div>
                <p className="text-base font-black text-white leading-tight" dangerouslySetInnerHTML={{ __html: instructions[0] || 'Proceed to destination' }} />
              </div>
            </div>
            <div className="w-1/3 flex justify-end pb-2">
              <div className="text-right bg-slate-900/80 border border-white/10 px-5 py-3 rounded-xl backdrop-blur-md shadow-xl">
                <p className="text-white font-black text-base">
                  {travelInfo.distance} left
                </p>
                <p className="text-teal-400 font-bold text-xs uppercase tracking-wider mt-0.5">
                  ETA {travelInfo.duration}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Bottom Bar */}
          <div className="md:hidden absolute bottom-6 left-4 right-4 flex justify-center pointer-events-auto">
            <div className="bg-slate-900/95 border border-teal-500/30 px-6 py-6 rounded-[2rem] backdrop-blur-xl w-full text-center shadow-2xl">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                <span className="text-[9px] font-black text-teal-500 uppercase tracking-[0.2em]">Next Maneuver</span>
              </div>
              <p className="text-xl md:text-2xl font-black text-white leading-tight" dangerouslySetInnerHTML={{ __html: instructions[0] || 'Proceed to destination' }} />
            </div>
          </div>

        </div>
      )}

      {/* Backend Loading Overlay */}
      {backendStatus !== 'active' && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="glass-card-teal p-8 md:p-12 max-w-md w-full flex flex-col items-center border-teal-500/20">
            {backendStatus === 'checking' ? (
              <>
                <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin mb-6" />
                <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">Connecting to Core</h2>
                <p className="text-teal-400 text-sm font-mono animate-pulse">{backendCheckMessage}</p>
                <p className="text-slate-500 text-xs mt-4">Waking up the neural grid... this may take up to 3 minutes.</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-black text-red-400 uppercase tracking-wider mb-2">Connection Failed</h2>
                <p className="text-slate-400 text-sm mb-6">{backendCheckMessage}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Retry Connection
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Interface Overlay */}
      <div className={`relative z-10 flex flex-col h-full pointer-events-none ${(isNavigating || backendStatus !== 'active') ? 'hidden' : ''}`}>
        <div className={`pointer-events-auto transition-all duration-500 ${journeyStarted ? 'hidden md:block' : ''}`}>
          <TopNav 
            user={user} 
            reputation={reputation} 
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery} 
            searchInputRef={searchInputRef}
            handleSignOut={handleSignOut}
          />
        </div>

        <main className="flex-1 p-2 pb-4 md:p-8 flex flex-col overflow-hidden min-h-0 relative">
          <MapLegend />
          <div className="max-w-screen-2xl mx-auto w-full h-full flex flex-col lg:flex-row gap-4 md:gap-8 items-end justify-end lg:justify-start pointer-events-none min-h-0">
            <div className="pointer-events-auto w-full lg:w-auto flex flex-col justify-end h-full min-h-0">
              <RoutingPanel 
                activeStation={activeStation}
                journeyStarted={journeyStarted}
                routeOptions={routeOptions}
                selectedRoute={selectedRoute}
                handleSelectRoute={handleSelectRoute}
                calculateRoute={calculateRoute}
                setJourneyStarted={setJourneyStarted}
                travelInfo={travelInfo}
                instructions={instructions}
                analyzeRoute={analyzeRoute}
                isAnalyzing={isAnalyzing}
                analysisResult={analysisResult}
                loading={loading}
                routingPreference={routingPreference}
                setRoutingPreference={setRoutingPreference}
                startNavigation={(!isNavigating && journeyStarted) ? startNavigation : undefined}
              />
            </div>
            
            {/* System Status */}
            <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-4 flex-1 pointer-events-auto">
              {[
                { label: 'Transit Points', val: '12.8k', trend: '+12%' },
                { label: 'Active Contributions', val: '842', trend: '+5%' },
                { label: 'Response Time', val: '24ms', trend: '-2ms' },
                { label: 'Server Load', val: '14.2%', trend: 'Normal' },
              ].map((stat, i) => (
                <div key={i} className="glass-card-teal p-6 group cursor-crosshair">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{stat.label}</p>
                    <span className="text-[8px] font-mono text-teal-500/60">{stat.trend}</span>
                  </div>
                  <p className="text-2xl font-black text-teal-400 group-hover:scale-110 transition-transform origin-left">{stat.val}</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        <div className="pointer-events-auto">
          <BottomNav activeTab="Map" />
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Outfit:wght@400;700;900&display=swap');
      `}</style>
    </div>
  );
}
