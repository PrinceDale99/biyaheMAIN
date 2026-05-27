import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

export interface Waypoint {
  name: string;
  lat: number;
  lng: number;
  type: "pickup" | "dropoff" | "both" | "waypoint" | "direct";
  fare: number;
}

export interface TransportInfo {
  id: string;
  transportType: string;
  routeName: string;
  terminalName: string;
  waypoints: Waypoint[];
  routePath: { lat: number; lng: number }[];
  dropOffAnywhere: boolean;
  pickUpAnywhere: boolean;
}

export interface PathNode {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: Waypoint["type"] | "origin" | "destination";
  routeId?: string; // If this node belongs to a specific route
}

export interface PathEdge {
  from: string;
  to: string;
  weight: number; // Time in seconds
  distance: number; // Meters
  type: "transit" | "walk";
  routeId?: string;
  routeName?: string;
  vehicleType?: string;
}

export class Pathfinder {
  private static haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static getAvgSpeed(type: string): number {
    switch (type.toLowerCase()) {
      case "jeep": return 15 / 3.6; // 15 km/h -> m/s
      case "uv express": return 25 / 3.6;
      case "bus": return 20 / 3.6;
      case "lrt/mrt": return 35 / 3.6;
      case "trike": return 12 / 3.6;
      case "walk": return 4 / 3.6; // 4 km/h
      default: return 15 / 3.6;
    }
  }

  static async findOptimalRoute(
    origin: { lat: number; lng: number },
    destination: string | { lat: number; lng: number },
    data?: TransportInfo[]
  ) {
    let transportData = data;
    if (!transportData) {
      const querySnapshot = await getDocs(collection(db, "transport_info"));
      transportData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransportInfo));
    }

    const nodes: Map<string, PathNode> = new Map();
    const edges: PathEdge[] = [];

    nodes.set("origin", { id: "origin", ...origin, name: "Current Location", type: "origin" });
    
    let destCoords: { lat: number; lng: number } = { lat: 14.6091, lng: 120.9893 }; // Default (Manila)
    if (typeof destination === 'string') {
      // Try to find a waypoint with a matching name
      for (const route of transportData) {
        const wp = route.waypoints.find(w => w.name.toLowerCase().includes(destination.toLowerCase()));
        if (wp) {
          destCoords = { lat: wp.lat, lng: wp.lng };
          break;
        }
      }
    } else {
      destCoords = destination;
    }
    nodes.set("destination", { id: "destination", ...destCoords, name: "Destination", type: "destination" });

    transportData.forEach(route => {
      route.waypoints.forEach((wp, idx) => {
        const nodeId = `${route.id}-wp-${idx}`;
        nodes.set(nodeId, {
          id: nodeId,
          lat: wp.lat,
          lng: wp.lng,
          name: wp.name,
          type: wp.type,
          routeId: route.id
        });

        if (idx > 0) {
          const prevNodeId = `${route.id}-wp-${idx - 1}`;
          const dist = this.haversine(route.waypoints[idx - 1].lat, route.waypoints[idx - 1].lng, wp.lat, wp.lng);
          const speed = this.getAvgSpeed(route.transportType);
          
          edges.push({
            from: prevNodeId,
            to: nodeId,
            weight: dist / speed,
            distance: dist,
            type: "transit",
            routeId: route.id,
            routeName: route.routeName,
            vehicleType: route.transportType
          });

          edges.push({
            from: nodeId,
            to: prevNodeId,
            weight: dist / speed,
            distance: dist,
            type: "transit",
            routeId: route.id,
            routeName: route.routeName,
            vehicleType: route.transportType
          });
        }
      });
    });

    const allNodes = Array.from(nodes.values());
    allNodes.forEach(node => {
      if (node.id === "origin" || node.id === "destination") return;
      
      if (node.type === "pickup" || node.type === "both") {
        const dist = this.haversine(origin.lat, origin.lng, node.lat, node.lng);
        if (dist < 2000) {
          edges.push({
            from: "origin",
            to: node.id,
            weight: dist / this.getAvgSpeed("walk"),
            distance: dist,
            type: "walk"
          });
        }
      }

      if (node.type === "dropoff" || node.type === "both") {
        const dist = this.haversine(destCoords.lat, destCoords.lng, node.lat, node.lng);
        if (dist < 2000) {
          edges.push({
            from: node.id,
            to: "destination",
            weight: dist / this.getAvgSpeed("walk"),
            distance: dist,
            type: "walk"
          });
        }
      }

      allNodes.forEach(otherNode => {
        if (node.id === otherNode.id || node.routeId === otherNode.routeId) return;
        if (node.id === "origin" || node.id === "destination" || otherNode.id === "origin" || otherNode.id === "destination") return;

        const dist = this.haversine(node.lat, node.lng, otherNode.lat, otherNode.lng);
        if (dist < 300) {
          edges.push({
            from: node.id,
            to: otherNode.id,
            weight: (dist / this.getAvgSpeed("walk")) + 120,
            distance: dist,
            type: "walk"
          });
        }
      });

      // Handle Iskinitas (Direct connections) - Give them a shortcut bonus
      if (node.type === "direct") {
        edges.forEach(e => {
          if (e.to === node.id || e.from === node.id) {
            e.weight *= 0.7; // 30% Shortcut Bonus for Iskinitas/Footbridges
          }
        });
      }
    });

    return this.dijkstra(nodes, edges, "origin", "destination");
  }

  private static dijkstra(nodes: Map<string, PathNode>, edges: PathEdge[], start: string, end: string) {
    const distances: Record<string, number> = {};
    const previous: Record<string, { nodeId: string; edge?: PathEdge } | null> = {};
    const queue: Set<string> = new Set();

    nodes.forEach((_, id) => {
      distances[id] = Infinity;
      previous[id] = null;
      queue.add(id);
    });

    distances[start] = 0;

    while (queue.size > 0) {
      let minNode: string | null = null;
      queue.forEach(id => {
        if (minNode === null || distances[id] < distances[minNode]) {
          minNode = id;
        }
      });

      if (minNode === null || distances[minNode] === Infinity || minNode === end) break;

      queue.delete(minNode);

      const neighbors = edges.filter(e => e.from === minNode);
      for (const edge of neighbors) {
        const alt = distances[minNode] + edge.weight;
        if (alt < distances[edge.to]) {
          distances[edge.to] = alt;
          previous[edge.to] = { nodeId: minNode, edge };
        }
      }
    }

    const path: { node: PathNode; edge?: PathEdge }[] = [];
    let curr: string | null = end;
    if (previous[end] === null) return null;

    while (curr !== null) {
      const prevInfo = previous[curr];
      path.unshift({ node: nodes.get(curr)!, edge: prevInfo?.edge });
      curr = prevInfo ? prevInfo.nodeId : null;
    }

    return {
      totalTime: distances[end],
      totalDistance: path.reduce((acc, p) => acc + (p.edge?.distance || 0), 0),
      path: path
    };
  }
}
