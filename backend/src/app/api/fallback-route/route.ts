import { NextResponse } from "next/server";
import koffi from "koffi";
import path from "path";

// Only load the DLL once
const dllPath = path.resolve(process.cwd(), "../core/biyahe_core.dll");
let lib: any;
let McRAPTOR: any;
let create_engine: any;
let destroy_engine: any;
let query_route: any;
let get_stations: any;

try {
  lib = koffi.load(dllPath);
  McRAPTOR = koffi.opaque('McRAPTOR');
  create_engine = lib.func('create_engine', koffi.pointer(McRAPTOR), []);
  destroy_engine = lib.func('destroy_engine', 'void', [koffi.pointer(McRAPTOR)]);
  query_route = lib.func('query_route', 'void', [koffi.pointer(McRAPTOR), 'string', 'string', 'int', 'char*', 'int']);
  get_stations = lib.func('get_stations', 'void', ['char*', 'int']);
} catch (err) {
  console.error("Failed to load biyahe_core.dll", err);
}

// Haversine formula to find closest station
function getClosestStation(lat: number, lon: number, stations: any[]) {
  function toRad(x: number) { return x * Math.PI / 180; }
  let closest = stations[0];
  let minD = Infinity;
  for (const s of stations) {
    const R = 6371; // km
    const dLat = toRad(s.lat - lat);
    const dLon = toRad(s.lon - lon);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat)) * Math.cos(toRad(s.lat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    if (d < minD) {
      minD = d;
      closest = s;
    }
  }
  return closest;
}

export async function POST(req: Request) {
  try {
    if (!lib) {
      return NextResponse.json({ error: "Routing core DLL not loaded" }, { status: 500 });
    }

    const { originLat, originLng, destinationStr, time } = await req.json();

    // 1. Get all stations
    const stationsBuffer = Buffer.alloc(8192);
    get_stations(stationsBuffer, 8192);
    const sResultStr = stationsBuffer.toString('utf-8');
    const sNullIdx = sResultStr.indexOf('\0');
    const sJsonStr = sNullIdx !== -1 ? sResultStr.slice(0, sNullIdx) : sResultStr;
    let stations = [];
    try {
      stations = JSON.parse(sJsonStr);
    } catch (e) {
      console.error("Failed to parse stations:", sJsonStr);
      return NextResponse.json({ error: "Internal station parsing error" }, { status: 500 });
    }

    // 2. Map coordinates & strings to node IDs
    const originStation = getClosestStation(originLat, originLng, stations);
    
    // For destination, try to match by string first, otherwise use fallback logic or another coordinate search
    // The UI provides activeStation string like "LRT-1 Doroteo Jose", "UST, España Blvd", "SM Makati"
    // The DLL has stations: "Doroteo Jose", "Baclaran", "EDSA", "Gil Puyat", "Monumento", "Roosevelt", "Antipolo", "Araneta Center-Cubao", "Recto", "Ayala", "North Avenue", "Taft Avenue"
    
    let destinationStation = stations.find((s: any) => destinationStr.toLowerCase().includes(s.name.toLowerCase()));
    
    // Hardcoded fallbacks if no text match
    if (!destinationStation) {
      if (destinationStr.includes("UST")) destinationStation = stations.find((s: any) => s.id === "lrt2-recto");
      if (destinationStr.includes("SM Makati")) destinationStation = stations.find((s: any) => s.id === "mrt3-ayala");
      if (destinationStr.includes("Barangay 669")) destinationStation = stations.find((s: any) => s.id === "lrt1-doroteo-jose");
    }

    // Default to Taft if nothing matches
    if (!destinationStation) destinationStation = stations.find((s: any) => s.id === "mrt3-taft");

    // 3. Query the Engine
    const engine = create_engine();
    const bufferSize = 8192;
    const resultBuffer = Buffer.alloc(bufferSize);
    
    query_route(engine, originStation.id, destinationStation.id, time || 28800, resultBuffer, bufferSize);
    
    destroy_engine(engine);

    const rResultStr = resultBuffer.toString('utf-8');
    const rNullIdx = rResultStr.indexOf('\0');
    const rJsonStr = rNullIdx !== -1 ? rResultStr.slice(0, rNullIdx) : rResultStr;

    let routes = [];
    try {
      routes = JSON.parse(rJsonStr);
    } catch (e) {
      console.warn("Failed to parse DLL output:", rJsonStr);
    }

    return NextResponse.json({ 
      origin: originStation,
      destination: destinationStation,
      routes 
    });

  } catch (error: any) {
    console.error("FFI Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
