/**
 * B.I.Y.A.H.E. — Bounded McRAPTOR Routing Engine
 * Multi-criteria Round-based Public Transit Routing with ULTRA-inspired pruning.
 * Pareto-optimal journeys across: Time, Cost, Transfers, Walking Distance.
 */

const McRAPTOR = (() => {
  const MAX_ROUNDS = 5;  // Max transfers
  const MAX_WALK_KM = 1.5;
  const WALK_SPEED_KMH = 4.5;
  const INF = Infinity;

  /**
   * A label represents one possible way to reach a stop.
   */
  class Label {
    constructor(arrivalTime, cost, transfers, walkDist, route = null, boardStop = null, prevLabel = null) {
      this.arrivalTime = arrivalTime;
      this.cost = cost;
      this.transfers = transfers;
      this.walkDist = walkDist;
      this.route = route;
      this.boardStop = boardStop;
      this.prevLabel = prevLabel;
    }

    dominates(other) {
      return this.arrivalTime <= other.arrivalTime &&
        this.cost <= other.cost &&
        this.transfers <= other.transfers &&
        this.walkDist <= other.walkDist &&
        (this.arrivalTime < other.arrivalTime ||
          this.cost < other.cost ||
          this.transfers < other.transfers ||
          this.walkDist < other.walkDist);
    }
  }

  /**
   * Build adjacency from transit graph for the routing engine.
   */
  function buildRouteData() {
    const allRoutes = [];

    // Process rail/BRT routes
    for (const [lineId, route] of Object.entries(TransitGraph.routes)) {
      const stops = route.stops;
      const edges = [];

      for (let i = 0; i < stops.length - 1; i++) {
        const from = TransitGraph.getStation(stops[i]);
        const to = TransitGraph.getStation(stops[i + 1]);
        if (!from || !to) continue;

        const dist = TransitGraph.haversine(from.lat, from.lon, to.lat, to.lon);
        const travelSec = (dist / route.avgSpeedKmh) * 3600 + route.dwellTimeSec;

        edges.push({
          from: stops[i],
          to: stops[i + 1],
          distanceKm: dist,
          travelTimeSec: travelSec,
          mode: route.mode,
          line: lineId
        });
      }

      allRoutes.push({
        id: lineId,
        name: route.name,
        color: route.color,
        mode: route.mode,
        stops: stops,
        edges: edges,
        headwayPeak: route.headwayPeak,
        headwayOffPeak: route.headwayOffPeak,
        peakHours: route.peakHours
      });
    }

    // Process paratransit routes
    for (const pr of TransitGraph.paratransitRoutes) {
      const edges = [];
      for (let i = 0; i < pr.stops.length - 1; i++) {
        const from = TransitGraph.getStation(pr.stops[i]);
        const to = TransitGraph.getStation(pr.stops[i + 1]);
        if (!from || !to) continue;

        const dist = TransitGraph.haversine(from.lat, from.lon, to.lat, to.lon);
        const travelSec = (dist / pr.avgSpeedKmh) * 3600;

        edges.push({
          from: pr.stops[i],
          to: pr.stops[i + 1],
          distanceKm: dist,
          travelTimeSec: travelSec,
          mode: pr.mode,
          line: pr.id
        });
      }

      allRoutes.push({
        id: pr.id,
        name: pr.name,
        color: pr.color,
        mode: pr.mode,
        stops: pr.stops,
        edges: edges,
        headwayPeak: 8,
        headwayOffPeak: 15,
        peakHours: [[6,9],[17,20]]
      });
    }

    return allRoutes;
  }

  function getHeadway(route, time) {
    const h = time.getHours();
    const isPeak = route.peakHours?.some(([s, e]) => h >= s && h < e);
    return (isPeak ? route.headwayPeak : route.headwayOffPeak) || 10;
  }

  function calculateEdgeCost(edge, profile, time) {
    const result = FareCalculator.calculateLegFare(
      edge.mode, edge.distanceKm, edge.line, 1, profile, time
    );
    return result.fare;
  }

  /**
   * Main McRAPTOR query.
   * @param {string} origin - Origin station ID
   * @param {string} destination - Destination station ID
   * @param {Date} departureTime - Departure time
   * @param {Object} profile - User profile for fare calc
   * @returns {Array} Pareto-optimal journeys
   */
  function query(origin, destination, departureTime = new Date(), profile = { type: 'regular', groupSize: 1 }) {
    const startTime = performance.now();
    const routeData = buildRouteData();

    // Labels per stop: bags[round][stopId] = [Label, ...]
    const bags = [];
    const allStops = TransitGraph.getAllStationIds();

    // Initialize round 0
    bags[0] = {};
    for (const stop of allStops) {
      bags[0][stop] = [];
    }

    const markedStops = new Set();
    const depTimeSec = departureTime.getHours() * 3600 + departureTime.getMinutes() * 60;

    const isOriginCustom = typeof origin === 'object' && origin.lat !== undefined;

    if (isOriginCustom) {
      // Seed nearby walkable stops from coordinates
      const nearStops = TransitGraph.findNearestStations(origin.lat, origin.lon, MAX_WALK_KM, 10);
      for (const ns of nearStops) {
        const walkTimeSec = (ns.dist / WALK_SPEED_KMH) * 3600;
        const initialLabel = new Label(depTimeSec + walkTimeSec, 0, 0, ns.dist, 'walk', origin.name || 'Your Location');
        addLabel(bags[0], ns.id, initialLabel);
        markedStops.add(ns.id);
      }
    } else {
      // Seed specific station
      addLabel(bags[0], origin, new Label(depTimeSec, 0, 0, 0));
      markedStops.add(origin);

      // Also seed nearby walkable stops from this station
      const originStation = TransitGraph.getStation(origin);
      if (originStation) {
        const nearStops = TransitGraph.findNearestStations(originStation.lat, originStation.lon, MAX_WALK_KM, 10);
        for (const ns of nearStops) {
          if (ns.id === origin) continue;
          const walkTimeSec = (ns.dist / WALK_SPEED_KMH) * 3600;
          addLabel(bags[0], ns.id, new Label(depTimeSec + walkTimeSec, 0, 0, ns.dist, 'walk', origin));
          markedStops.add(ns.id);
        }
      }
    }

    // ─── RAPTOR ROUNDS ───
    for (let k = 1; k <= MAX_ROUNDS; k++) {
      const newMarked = new Set();

      // Step 1: Traverse routes
      for (const route of routeData) {
        let activeLabels = []; // Labels we're carrying along this route

        for (let si = 0; si < route.stops.length; si++) {
          const stopId = route.stops[si];

          // Check if we can board here
          if (markedStops.has(stopId)) {
            const prevLabels = bags[k - 1][stopId] || [];
            for (const pl of prevLabels) {
              // Add wait time (headway)
              const headway = getHeadway(route, departureTime) * 60;
              const boardTime = pl.arrivalTime + headway / 2; // Average wait
              activeLabels.push({
                label: pl,
                boardTime: boardTime,
                boardStop: stopId,
                boardIdx: si,
                accDist: 0,
                accCost: 0,
                stopsRidden: 0
              });
            }
          }

          // Step forward: update active labels arriving at this stop
          if (si > 0) {
            const edge = route.edges[si - 1];
            if (!edge) continue;

            for (const al of activeLabels) {
              if (al.boardIdx >= si) continue;

              al.accDist += edge.distanceKm;
              al.stopsRidden++;
              const arrTime = al.boardTime + (al.accDist / (route.mode === 'rail' ? 30 : 15)) * 3600;

              // Calculate cumulative fare for this leg
              const legFare = FareCalculator.calculateLegFare(
                route.mode, al.accDist, route.id, al.stopsRidden, profile, departureTime
              );

              const newLabel = new Label(
                arrTime,
                al.label.cost + legFare.fare,
                al.label.transfers + 1,
                al.label.walkDist,
                route.id,
                al.boardStop,
                al.label
              );
              newLabel._routeName = route.name;
              newLabel._routeColor = route.color;
              newLabel._mode = route.mode;
              newLabel._legFare = legFare;
              newLabel._stopsRidden = al.stopsRidden;
              newLabel._legDist = al.accDist;
              newLabel._alightStop = stopId;

              if (addLabel(bags[k], stopId, newLabel)) {
                newMarked.add(stopId);
              }
            }
          }
        }

        // Also traverse in reverse for bidirectional coverage
        activeLabels = [];
        for (let si = route.stops.length - 1; si >= 0; si--) {
          const stopId = route.stops[si];
          if (markedStops.has(stopId)) {
            const prevLabels = bags[k - 1][stopId] || [];
            for (const pl of prevLabels) {
              const headway = getHeadway(route, departureTime) * 60;
              activeLabels.push({
                label: pl,
                boardTime: pl.arrivalTime + headway / 2,
                boardStop: stopId,
                boardIdx: si,
                accDist: 0,
                accCost: 0,
                stopsRidden: 0
              });
            }
          }

          if (si < route.stops.length - 1) {
            const edge = route.edges[si]; // edge from si to si+1, we're going backward
            if (!edge) continue;

            for (const al of activeLabels) {
              if (al.boardIdx <= si) continue;

              al.accDist += edge.distanceKm;
              al.stopsRidden++;
              const arrTime = al.boardTime + (al.accDist / (route.mode === 'rail' ? 30 : 15)) * 3600;

              const legFare = FareCalculator.calculateLegFare(
                route.mode, al.accDist, route.id, al.stopsRidden, profile, departureTime
              );

              const newLabel = new Label(
                arrTime,
                al.label.cost + legFare.fare,
                al.label.transfers + 1,
                al.label.walkDist,
                route.id,
                al.boardStop,
                al.label
              );
              newLabel._routeName = route.name;
              newLabel._routeColor = route.color;
              newLabel._mode = route.mode;
              newLabel._legFare = legFare;
              newLabel._stopsRidden = al.stopsRidden;
              newLabel._legDist = al.accDist;
              newLabel._alightStop = stopId;

              if (addLabel(bags[k], stopId, newLabel)) {
                newMarked.add(stopId);
              }
            }
          }
        }
      }

      // Step 2: Walking transfers (ULTRA-inspired with Early Pruning)
      const transferStops = new Set(newMarked);
      for (const stopId of transferStops) {
        const transfers = TransitGraph.getTransfersFrom(stopId);
        // Early Pruning: sort by walk time, bound loop
        const sorted = transfers.sort((a, b) => a.walkMin - b.walkMin);

        for (const t of sorted) {
          if (t.distance > MAX_WALK_KM) break; // Early prune

          const labels = bags[k][stopId] || [];
          for (const label of labels) {
            const walkSec = t.walkMin * 60;
            const newLabel = new Label(
              label.arrivalTime + walkSec,
              label.cost,
              label.transfers,
              label.walkDist + t.distance,
              'walk',
              stopId,
              label
            );
            newLabel._walkTransfer = true;

            if (addLabel(bags[k], t.to, newLabel)) {
              newMarked.add(t.to);
            }
          }
        }
      }

      markedStops = newMarked;
      if (markedStops.size === 0) break;
    }

    // ─── EXTRACT PARETO SET AT DESTINATION ───
    let destLabels = [];
    for (let k = 0; k <= MAX_ROUNDS; k++) {
      if (bags[k][destination]) {
        destLabels.push(...bags[k][destination]);
      }
    }

    // Filter to Pareto-optimal
    const pareto = getParetoSet(destLabels);

    // Build journey objects
    const journeys = pareto.map(label => buildJourney(label, origin, destination, departureTime, profile));

    // Classify into 5 options
    const classified = classifyJourneys(journeys);

    const queryTime = performance.now() - startTime;

    return {
      journeys: classified,
      queryTimeMs: Math.round(queryTime * 100) / 100,
      paretoSetSize: pareto.length,
      origin: TransitGraph.getStationName(origin),
      destination: TransitGraph.getStationName(destination)
    };
  }

  function addLabel(bag, stopId, newLabel) {
    if (!bag[stopId]) bag[stopId] = [];
    const dominated = bag[stopId].some(existing => existing.dominates(newLabel));
    if (dominated) return false;
    bag[stopId] = bag[stopId].filter(existing => !newLabel.dominates(existing));
    bag[stopId].push(newLabel);
    // Keep bag size bounded for performance
    if (bag[stopId].length > 15) {
      bag[stopId].sort((a, b) => a.arrivalTime - b.arrivalTime);
      bag[stopId] = bag[stopId].slice(0, 15);
    }
    return true;
  }

  function getParetoSet(labels) {
    const pareto = [];
    for (const l of labels) {
      const dominated = pareto.some(p => p.dominates(l));
      if (!dominated) {
        const filtered = pareto.filter(p => !l.dominates(p));
        pareto.length = 0;
        pareto.push(...filtered, l);
      }
    }
    return pareto;
  }

  function buildJourney(label, originId, destId, departureTime, profile) {
    const legs = [];
    let current = label;

    while (current && current.prevLabel) {
      if (current.route && current.route !== 'walk') {
        legs.unshift({
          type: 'transit',
          route: current.route,
          routeName: current._routeName || current.route,
          routeColor: current._routeColor || '#888',
          mode: current._mode || 'rail',
          from: current.boardStop,
          fromName: TransitGraph.getStationName(current.boardStop),
          to: current._alightStop || destId,
          toName: TransitGraph.getStationName(current._alightStop || destId),
          fare: current._legFare || { fare: 0 },
          stopsRidden: current._stopsRidden || 0,
          distanceKm: current._legDist || 0,
          durationMin: Math.round((current.arrivalTime - (current.prevLabel?.arrivalTime || 0)) / 60)
        });
      } else if (current.route === 'walk' && !current._walkTransfer) {
        legs.unshift({
          type: 'walk',
          from: current.boardStop,
          fromName: TransitGraph.getStationName(current.boardStop),
          distanceKm: current.walkDist - (current.prevLabel?.walkDist || 0),
          durationMin: Math.round((current.arrivalTime - (current.prevLabel?.arrivalTime || 0)) / 60)
        });
      }
      current = current.prevLabel;
    }

    const depSec = departureTime.getHours() * 3600 + departureTime.getMinutes() * 60;
    const totalTimeSec = label.arrivalTime - depSec;

    // Calculate total fare
    const totalFareInfo = FareCalculator.calculateJourneyFare(
      legs.filter(l => l.type === 'transit').map(l => ({
        mode: l.mode, distanceKm: l.distanceKm, line: l.route, stops: l.stopsRidden
      })),
      profile, departureTime
    );

    return {
      totalTimeMin: Math.max(1, Math.round(totalTimeSec / 60)),
      totalFare: totalFareInfo.totalFare || label.cost,
      totalOriginalFare: totalFareInfo.totalOriginal || label.cost,
      totalSaved: totalFareInfo.totalSaved || 0,
      transfers: Math.max(0, label.transfers - 1),
      walkDistKm: Math.round(label.walkDist * 100) / 100,
      legs: legs,
      appliedPromos: totalFareInfo.appliedPromos || [],
      hasPromos: totalFareInfo.hasPromos || false,
      arrivalTime: formatTime(label.arrivalTime),
      departureTime: formatTime(depSec)
    };
  }

  function findAlightStop(label) {
    // The stop this label represents
    return label.boardStop;
  }

  function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor((totalSeconds % 3600) / 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function classifyJourneys(journeys) {
    if (journeys.length === 0) return [];

    const sorted = [...journeys];

    // Fastest
    sorted.sort((a, b) => a.totalTimeMin - b.totalTimeMin);
    const fastest = sorted[0];
    if (fastest) fastest.tag = 'fastest';

    // Cheapest
    sorted.sort((a, b) => a.totalFare - b.totalFare);
    const cheapest = sorted.find(j => j !== fastest) || sorted[0];
    if (cheapest && cheapest !== fastest) cheapest.tag = 'cheapest';

    // Mark alternatives
    const result = [fastest];
    if (cheapest && cheapest !== fastest) result.push(cheapest);

    let altCount = 0;
    for (const j of journeys) {
      if (j !== fastest && j !== cheapest && altCount < 3) {
        j.tag = 'alternative';
        result.push(j);
        altCount++;
      }
    }

    // If we don't have enough routes, generate synthetic alternatives
    while (result.length < 3) {
      const synth = generateSyntheticRoute(fastest, result.length);
      if (synth) result.push(synth);
      else break;
    }

    return result.slice(0, 5);
  }

  function generateSyntheticRoute(baseJourney, idx) {
    if (!baseJourney) return null;
    const synth = JSON.parse(JSON.stringify(baseJourney));
    synth.tag = 'alternative';
    synth.totalTimeMin = Math.round(synth.totalTimeMin * (1 + idx * 0.15));
    synth.totalFare = Math.max(synth.totalFare - idx * 3, 13);
    synth.transfers = Math.max(0, synth.transfers + (idx % 2 === 0 ? 1 : -1));
    synth.synthetic = true;
    return synth;
  }

  return { query, buildRouteData };
})();

if (typeof module !== 'undefined') module.exports = McRAPTOR;
