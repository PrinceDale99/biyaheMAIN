import koffi from 'koffi';
import path from 'path';

import os from 'os';

// Define the DLL path based on OS
const ext = os.platform() === 'win32' ? 'dll' : 'so';
// Look for it in the same directory first (for deployment), then in the sibling core directory (for local dev)
let dllPath = path.resolve(process.cwd(), `biyahe_core.${ext}`);
if (!require('fs').existsSync(dllPath)) {
  dllPath = path.resolve(process.cwd(), `../core/biyahe_core.${ext}`);
}
const finalDllPath = dllPath;

// Load the library
const lib = koffi.load(finalDllPath);

// Define types - use anonymous pointers to avoid duplicate type name errors in Next.js
const McRAPTOR_Ptr = koffi.pointer(koffi.opaque());

// Define functions
const create_engine = lib.func('create_engine', McRAPTOR_Ptr, []);
const destroy_engine = lib.func('destroy_engine', 'void', [McRAPTOR_Ptr]);
const query_route = lib.func('query_route', 'void', [McRAPTOR_Ptr, 'const char *', 'const char *', 'int', koffi.out(koffi.pointer('char')), 'int']);
const get_stations = lib.func('get_stations', 'void', [koffi.out(koffi.pointer('char')), 'int']);

export interface RouteResult {
  arrival: number;
  cost: number;
  transfers: number;
  walk: number;
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export class CoreBridge {
  private engine: any;

  constructor() {
    this.engine = create_engine();
  }

  dispose() {
    if (this.engine) {
      destroy_engine(this.engine);
      this.engine = null;
    }
  }

  queryRoute(origin: string, destination: string, departureTime: number): RouteResult[] {
    const bufferSize = 8192;
    const buffer = Buffer.alloc(bufferSize);
    query_route(this.engine, origin, destination, departureTime, buffer, bufferSize);
    
    const resultStr = buffer.toString('utf8').replace(/\0/g, '');
    try {
      return JSON.parse(resultStr);
    } catch (e) {
      console.error('Failed to parse route results:', resultStr);
      return [];
    }
  }

  getStations(): Station[] {
    const bufferSize = 16384;
    const buffer = Buffer.alloc(bufferSize);
    get_stations(buffer, bufferSize);
    
    const resultStr = buffer.toString('utf8').replace(/\0/g, '');
    try {
      return JSON.parse(resultStr);
    } catch (e) {
      console.error('Failed to parse stations:', resultStr);
      return [];
    }
  }
}
