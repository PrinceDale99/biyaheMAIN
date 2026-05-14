/**
 * B.I.Y.A.H.E. Transit Graph — Metro Manila Multi-Modal Network
 * Contains stations, routes, connections, and transfer points.
 */

const TransitGraph = (() => {
  // Haversine distance in km
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─── STATIONS ───
  const stations = {
    // LRT-1 (Green Line) — Baclaran to Roosevelt
    'lrt1-baclaran':      { name: 'Baclaran',           lat: 14.5342, lon: 120.9986, lines: ['lrt1'], zone: 'south' },
    'lrt1-edsa':          { name: 'EDSA',               lat: 14.5390, lon: 121.0005, lines: ['lrt1'], zone: 'south' },
    'lrt1-libertad':      { name: 'Libertad',           lat: 14.5476, lon: 120.9985, lines: ['lrt1'], zone: 'south' },
    'lrt1-gil-puyat':     { name: 'Gil Puyat',          lat: 14.5543, lon: 120.9972, lines: ['lrt1'], zone: 'central' },
    'lrt1-vito-cruz':     { name: 'Vito Cruz',          lat: 14.5634, lon: 120.9949, lines: ['lrt1'], zone: 'central' },
    'lrt1-quirino':       { name: 'Quirino',            lat: 14.5703, lon: 120.9917, lines: ['lrt1'], zone: 'central' },
    'lrt1-pedro-gil':     { name: 'Pedro Gil',          lat: 14.5767, lon: 120.9882, lines: ['lrt1'], zone: 'central' },
    'lrt1-un-avenue':     { name: 'UN Avenue',          lat: 14.5822, lon: 120.9847, lines: ['lrt1'], zone: 'central' },
    'lrt1-central':       { name: 'Central Terminal',   lat: 14.5928, lon: 120.9815, lines: ['lrt1'], zone: 'central' },
    'lrt1-carriedo':      { name: 'Carriedo',           lat: 14.5990, lon: 120.9811, lines: ['lrt1'], zone: 'central' },
    'lrt1-doroteo-jose':  { name: 'Doroteo Jose',      lat: 14.6054, lon: 120.9822, lines: ['lrt1','lrt2'], zone: 'central' },
    'lrt1-bambang':       { name: 'Bambang',            lat: 14.6112, lon: 120.9824, lines: ['lrt1'], zone: 'north' },
    'lrt1-tayuman':       { name: 'Tayuman',            lat: 14.6168, lon: 120.9826, lines: ['lrt1'], zone: 'north' },
    'lrt1-blumentritt':   { name: 'Blumentritt',        lat: 14.6225, lon: 120.9832, lines: ['lrt1'], zone: 'north' },
    'lrt1-abad-santos':   { name: 'Abad Santos',        lat: 14.6308, lon: 120.9816, lines: ['lrt1'], zone: 'north' },
    'lrt1-r-papa':        { name: 'R. Papa',            lat: 14.6363, lon: 120.9826, lines: ['lrt1'], zone: 'north' },
    'lrt1-5th-avenue':    { name: '5th Avenue',         lat: 14.6443, lon: 120.9836, lines: ['lrt1'], zone: 'north' },
    'lrt1-monumento':     { name: 'Monumento',          lat: 14.6545, lon: 120.9838, lines: ['lrt1'], zone: 'north' },
    'lrt1-balintawak':    { name: 'Balintawak',         lat: 14.6575, lon: 121.0040, lines: ['lrt1'], zone: 'north' },
    'lrt1-roosevelt':     { name: 'Roosevelt',          lat: 14.6575, lon: 121.0210, lines: ['lrt1','mrt3'], zone: 'north' },

    // LRT-2 (Purple Line) — Recto to Antipolo
    'lrt2-recto':         { name: 'Recto',              lat: 14.6033, lon: 120.9833, lines: ['lrt2'], zone: 'central' },
    'lrt2-legarda':       { name: 'Legarda',            lat: 14.6011, lon: 120.9906, lines: ['lrt2'], zone: 'central' },
    'lrt2-pureza':        { name: 'Pureza',             lat: 14.6019, lon: 121.0023, lines: ['lrt2'], zone: 'central' },
    'lrt2-v-mapa':        { name: 'V. Mapa',            lat: 14.6041, lon: 121.0095, lines: ['lrt2'], zone: 'central' },
    'lrt2-j-ruiz':        { name: 'J. Ruiz',            lat: 14.6102, lon: 121.0263, lines: ['lrt2'], zone: 'east' },
    'lrt2-gilmore':       { name: 'Gilmore',            lat: 14.6131, lon: 121.0342, lines: ['lrt2'], zone: 'east' },
    'lrt2-betty-go':      { name: 'Betty Go-Belmonte',  lat: 14.6177, lon: 121.0430, lines: ['lrt2'], zone: 'east' },
    'lrt2-cubao':         { name: 'Araneta Center-Cubao', lat: 14.6225, lon: 121.0530, lines: ['lrt2','mrt3'], zone: 'east' },
    'lrt2-anonas':        { name: 'Anonas',             lat: 14.6280, lon: 121.0650, lines: ['lrt2'], zone: 'east' },
    'lrt2-katipunan':     { name: 'Katipunan',          lat: 14.6310, lon: 121.0730, lines: ['lrt2'], zone: 'east' },
    'lrt2-santolan':      { name: 'Santolan',           lat: 14.6220, lon: 121.0860, lines: ['lrt2'], zone: 'east' },
    'lrt2-marikina':      { name: 'Marikina-Pasig',     lat: 14.6210, lon: 121.1000, lines: ['lrt2'], zone: 'east' },
    'lrt2-antipolo':      { name: 'Antipolo',           lat: 14.6248, lon: 121.1210, lines: ['lrt2'], zone: 'east' },

    // MRT-3 (Blue Line) — North Avenue to Taft Avenue
    'mrt3-north':         { name: 'North Avenue',       lat: 14.6527, lon: 121.0330, lines: ['mrt3'], zone: 'north' },
    'mrt3-quezon':        { name: 'Quezon Avenue',      lat: 14.6427, lon: 121.0387, lines: ['mrt3'], zone: 'north' },
    'mrt3-gma-kamuning':  { name: 'GMA Kamuning',      lat: 14.6350, lon: 121.0435, lines: ['mrt3'], zone: 'north' },
    'mrt3-cubao':         { name: 'Araneta Center-Cubao', lat: 14.6190, lon: 121.0530, lines: ['mrt3','lrt2'], zone: 'east' },
    'mrt3-santolan':      { name: 'Santolan-Annapolis', lat: 14.6072, lon: 121.0564, lines: ['mrt3'], zone: 'east' },
    'mrt3-ortigas':       { name: 'Ortigas',            lat: 14.5878, lon: 121.0565, lines: ['mrt3'], zone: 'east' },
    'mrt3-shaw':          { name: 'Shaw Boulevard',     lat: 14.5812, lon: 121.0536, lines: ['mrt3'], zone: 'east' },
    'mrt3-boni':          { name: 'Boni',               lat: 14.5735, lon: 121.0480, lines: ['mrt3'], zone: 'central' },
    'mrt3-guadalupe':     { name: 'Guadalupe',          lat: 14.5670, lon: 121.0456, lines: ['mrt3'], zone: 'central' },
    'mrt3-buendia':       { name: 'Buendia',            lat: 14.5543, lon: 121.0340, lines: ['mrt3'], zone: 'central' },
    'mrt3-ayala':         { name: 'Ayala',              lat: 14.5494, lon: 121.0278, lines: ['mrt3'], zone: 'central' },
    'mrt3-magallanes':    { name: 'Magallanes',         lat: 14.5420, lon: 121.0194, lines: ['mrt3'], zone: 'south' },
    'mrt3-taft':          { name: 'Taft Avenue',        lat: 14.5375, lon: 121.0010, lines: ['mrt3','lrt1'], zone: 'south' },

    // EDSA Carousel (Bus Rapid Transit) — Key Stops
    'edsa-monumento':     { name: 'Monumento (Carousel)', lat: 14.6545, lon: 120.9840, lines: ['carousel'], zone: 'north' },
    'edsa-balintawak':    { name: 'Balintawak (Carousel)', lat: 14.6575, lon: 121.0040, lines: ['carousel'], zone: 'north' },
    'edsa-sm-north':      { name: 'SM North EDSA (Carousel)', lat: 14.6560, lon: 121.0295, lines: ['carousel'], zone: 'north' },
    'edsa-quezon':        { name: 'Quezon Ave (Carousel)', lat: 14.6430, lon: 121.0390, lines: ['carousel'], zone: 'north' },
    'edsa-kamuning':      { name: 'Kamuning (Carousel)', lat: 14.6350, lon: 121.0435, lines: ['carousel'], zone: 'north' },
    'edsa-cubao':         { name: 'Cubao (Carousel)',   lat: 14.6190, lon: 121.0530, lines: ['carousel'], zone: 'east' },
    'edsa-santolan':      { name: 'Santolan (Carousel)',lat: 14.6072, lon: 121.0564, lines: ['carousel'], zone: 'east' },
    'edsa-ortigas':       { name: 'Ortigas (Carousel)', lat: 14.5878, lon: 121.0565, lines: ['carousel'], zone: 'east' },
    'edsa-shaw':          { name: 'Shaw (Carousel)',    lat: 14.5812, lon: 121.0536, lines: ['carousel'], zone: 'east' },
    'edsa-guadalupe':     { name: 'Guadalupe (Carousel)', lat: 14.5670, lon: 121.0456, lines: ['carousel'], zone: 'central' },
    'edsa-philam':        { name: 'Philam (Carousel)',  lat: 14.5590, lon: 121.0390, lines: ['carousel'], zone: 'central' },
    'edsa-buendia':       { name: 'Buendia (Carousel)', lat: 14.5543, lon: 121.0340, lines: ['carousel'], zone: 'central' },
    'edsa-ayala':         { name: 'Ayala (Carousel)',   lat: 14.5494, lon: 121.0278, lines: ['carousel'], zone: 'central' },
    'edsa-magallanes':    { name: 'Magallanes (Carousel)', lat: 14.5420, lon: 121.0194, lines: ['carousel'], zone: 'south' },
    'edsa-taft':          { name: 'Taft (Carousel)',    lat: 14.5375, lon: 121.0010, lines: ['carousel'], zone: 'south' },

    // Major Hubs (Jeepney/Bus terminals)
    'hub-quiapo':         { name: 'Quiapo',             lat: 14.5985, lon: 120.9840, lines: ['jeepney','bus'], zone: 'central' },
    'hub-divisoria':      { name: 'Divisoria',          lat: 14.6010, lon: 120.9720, lines: ['jeepney'], zone: 'central' },
    'hub-cubao-terminal': { name: 'Cubao Terminal',     lat: 14.6200, lon: 121.0560, lines: ['jeepney','bus'], zone: 'east' },
    'hub-pasay':          { name: 'Pasay Terminal',     lat: 14.5378, lon: 121.0003, lines: ['bus','jeepney'], zone: 'south' },
    'hub-fairview':       { name: 'Fairview Terminal',  lat: 14.7193, lon: 121.0787, lines: ['jeepney','bus'], zone: 'north' },
    'hub-sm-moa':         { name: 'SM Mall of Asia',    lat: 14.5351, lon: 120.9836, lines: ['jeepney','bus'], zone: 'south' },
    'hub-makati-cbd':     { name: 'Makati CBD',         lat: 14.5547, lon: 121.0244, lines: ['jeepney','bus'], zone: 'central' },
    'hub-bgc':            { name: 'BGC Transport Hub',  lat: 14.5517, lon: 121.0456, lines: ['bus'], zone: 'central' },
    'hub-alabang':        { name: 'Alabang',            lat: 14.4234, lon: 121.0480, lines: ['bus','jeepney'], zone: 'south' },
    'hub-novaliches':     { name: 'Novaliches',         lat: 14.7090, lon: 121.0450, lines: ['jeepney'], zone: 'north' },
    'hub-commonwealth':   { name: 'Commonwealth',       lat: 14.6880, lon: 121.0850, lines: ['jeepney','bus'], zone: 'north' },
    'hub-espana':         { name: 'España Blvd',        lat: 14.6100, lon: 120.9920, lines: ['jeepney'], zone: 'central' },
    
    // Pasig River Ferry Stations
    'ferry-pinagbuhatan': { name: 'Pinagbuhatan Ferry', lat: 14.5492, lon: 121.0910, lines: ['ferry'], zone: 'east' },
    'ferry-guadalupe':    { name: 'Guadalupe Ferry',    lat: 14.5685, lon: 121.0455, lines: ['ferry'], zone: 'central' },
    'ferry-valenzuela':   { name: 'Valenzuela Ferry',   lat: 14.5772, lon: 121.0261, lines: ['ferry'], zone: 'central' },
    'ferry-lawton':       { name: 'Lawton Ferry',       lat: 14.5947, lon: 120.9782, lines: ['ferry'], zone: 'central' },
    'ferry-escolta':      { name: 'Escolta Ferry',      lat: 14.5964, lon: 120.9774, lines: ['ferry'], zone: 'central' },
  };

  // ─── ROUTE DEFINITIONS ───
  const routes = {
    lrt1: {
      name: 'LRT Line 1', color: '#2E7D32', mode: 'rail',
      stops: ['lrt1-baclaran','lrt1-edsa','lrt1-libertad','lrt1-gil-puyat','lrt1-vito-cruz',
        'lrt1-quirino','lrt1-pedro-gil','lrt1-un-avenue','lrt1-central','lrt1-carriedo',
        'lrt1-doroteo-jose','lrt1-bambang','lrt1-tayuman','lrt1-blumentritt','lrt1-abad-santos',
        'lrt1-r-papa','lrt1-5th-avenue','lrt1-monumento','lrt1-balintawak','lrt1-roosevelt'],
      avgSpeedKmh: 30, dwellTimeSec: 30, baseFare: 15, perKmRate: 1.50,
      headwayPeak: 4, headwayOffPeak: 8, peakHours: [[6,9],[17,20]]
    },
    lrt2: {
      name: 'LRT Line 2', color: '#7B1FA2', mode: 'rail',
      stops: ['lrt1-doroteo-jose','lrt2-recto','lrt2-legarda','lrt2-pureza','lrt2-v-mapa',
        'lrt2-j-ruiz','lrt2-gilmore','lrt2-betty-go','lrt2-cubao','lrt2-anonas',
        'lrt2-katipunan','lrt2-santolan','lrt2-marikina','lrt2-antipolo'],
      avgSpeedKmh: 35, dwellTimeSec: 30, baseFare: 15, perKmRate: 1.50,
      headwayPeak: 5, headwayOffPeak: 10, peakHours: [[6,9],[17,20]]
    },
    mrt3: {
      name: 'MRT-3', color: '#1565C0', mode: 'rail',
      stops: ['mrt3-north','mrt3-quezon','mrt3-gma-kamuning','mrt3-cubao','mrt3-santolan',
        'mrt3-ortigas','mrt3-shaw','mrt3-boni','mrt3-guadalupe','mrt3-buendia',
        'mrt3-ayala','mrt3-magallanes','mrt3-taft'],
      avgSpeedKmh: 25, dwellTimeSec: 45, baseFare: 15, perKmRate: 1.50,
      headwayPeak: 5, headwayOffPeak: 10, peakHours: [[6,9],[17,20]]
    },
    carousel: {
      name: 'EDSA Carousel', color: '#E65100', mode: 'brt',
      stops: ['edsa-monumento','edsa-balintawak','edsa-sm-north','edsa-quezon','edsa-kamuning',
        'edsa-cubao','edsa-santolan','edsa-ortigas','edsa-shaw','edsa-guadalupe',
        'edsa-philam','edsa-buendia','edsa-ayala','edsa-magallanes','edsa-taft'],
      avgSpeedKmh: 18, dwellTimeSec: 60, baseFare: 13, perKmRate: 0,
      headwayPeak: 5, headwayOffPeak: 12, peakHours: [[6,9],[17,20]]
    },
  };

  // ─── TRANSFERS (walking connections between nearby stations) ───
  const transfers = [
    { from: 'lrt1-doroteo-jose', to: 'lrt2-recto', walkMin: 5, distance: 0.3 },
    { from: 'lrt2-cubao', to: 'mrt3-cubao', walkMin: 8, distance: 0.4 },
    { from: 'lrt1-roosevelt', to: 'mrt3-north', walkMin: 12, distance: 0.8 },
    { from: 'mrt3-taft', to: 'lrt1-edsa', walkMin: 6, distance: 0.3 },
    { from: 'mrt3-taft', to: 'edsa-taft', walkMin: 3, distance: 0.15 },
    { from: 'mrt3-north', to: 'edsa-sm-north', walkMin: 5, distance: 0.25 },
    { from: 'mrt3-cubao', to: 'edsa-cubao', walkMin: 4, distance: 0.2 },
    { from: 'mrt3-ortigas', to: 'edsa-ortigas', walkMin: 3, distance: 0.15 },
    { from: 'mrt3-shaw', to: 'edsa-shaw', walkMin: 3, distance: 0.15 },
    { from: 'mrt3-guadalupe', to: 'edsa-guadalupe', walkMin: 4, distance: 0.2 },
    { from: 'mrt3-buendia', to: 'edsa-buendia', walkMin: 3, distance: 0.15 },
    { from: 'mrt3-ayala', to: 'edsa-ayala', walkMin: 4, distance: 0.2 },
    { from: 'mrt3-magallanes', to: 'edsa-magallanes', walkMin: 3, distance: 0.15 },
    { from: 'lrt1-monumento', to: 'edsa-monumento', walkMin: 5, distance: 0.3 },
    { from: 'lrt1-baclaran', to: 'hub-sm-moa', walkMin: 15, distance: 0.9 },
    { from: 'lrt1-carriedo', to: 'hub-quiapo', walkMin: 4, distance: 0.2 },
    { from: 'lrt2-cubao', to: 'hub-cubao-terminal', walkMin: 5, distance: 0.3 },
    { from: 'mrt3-ayala', to: 'hub-makati-cbd', walkMin: 8, distance: 0.5 },
    { from: 'mrt3-ayala', to: 'hub-bgc', walkMin: 15, distance: 1.0 },
    { from: 'lrt1-edsa', to: 'hub-pasay', walkMin: 5, distance: 0.3 },
    { from: 'lrt2-recto', to: 'hub-divisoria', walkMin: 10, distance: 0.6 },
    { from: 'hub-espana', to: 'lrt2-legarda', walkMin: 8, distance: 0.5 },
    { from: 'mrt3-guadalupe', to: 'ferry-guadalupe', walkMin: 6, distance: 0.3 },
    { from: 'lrt1-central', to: 'ferry-lawton', walkMin: 5, distance: 0.25 },
  ];

  // ─── JEEPNEY/BUS ROUTES (simplified major corridors) ───
  const paratransitRoutes = [
    { id: 'jeep-espana-quiapo', name: 'Jeepney: España–Quiapo', mode: 'trad_jeepney', color: '#FF6F00',
      stops: ['hub-espana','lrt2-legarda','lrt1-doroteo-jose','hub-quiapo','hub-divisoria'],
      avgSpeedKmh: 12 },
    { id: 'jeep-cubao-divisoria', name: 'Jeepney: Cubao–Divisoria', mode: 'trad_jeepney', color: '#FF6F00',
      stops: ['hub-cubao-terminal','lrt2-v-mapa','hub-quiapo','hub-divisoria'],
      avgSpeedKmh: 10 },
    { id: 'bus-cubao-alabang', name: 'Bus: Cubao–Alabang', mode: 'aircon_bus', color: '#0D47A1',
      stops: ['hub-cubao-terminal','mrt3-ortigas','mrt3-ayala','hub-makati-cbd','hub-alabang'],
      avgSpeedKmh: 15 },
    { id: 'jeep-fairview-quiapo', name: 'Jeepney: Fairview–Quiapo', mode: 'trad_jeepney', color: '#FF6F00',
      stops: ['hub-fairview','hub-novaliches','hub-commonwealth','mrt3-north','hub-quiapo'],
      avgSpeedKmh: 11 },
    { id: 'bus-fairview-cubao', name: 'Bus: Fairview–Cubao', mode: 'ordinary_bus', color: '#1976D2',
      stops: ['hub-fairview','hub-commonwealth','mrt3-north','mrt3-quezon','hub-cubao-terminal'],
      avgSpeedKmh: 14 },
    { id: 'jeep-makati-moa', name: 'Jeepney: Makati–MOA', mode: 'modern_jeepney', color: '#43A047',
      stops: ['hub-makati-cbd','mrt3-magallanes','lrt1-baclaran','hub-sm-moa'],
      avgSpeedKmh: 11 },
    { id: 'bus-pasay-bgc', name: 'Bus: Pasay–BGC', mode: 'aircon_bus', color: '#0D47A1',
      stops: ['hub-pasay','lrt1-edsa','hub-makati-cbd','hub-bgc'],
      avgSpeedKmh: 13 },
      
    // Point-to-Point (P2P) Buses
    { id: 'p2p-fairview-makati', name: 'P2P: Fairview–Makati', mode: 'p2p_bus', color: '#880E4F',
      stops: ['hub-fairview', 'hub-makati-cbd'],
      avgSpeedKmh: 20 },
      
    // UV Express
    { id: 'uv-novaliches-cubao', name: 'UV Express: Nova–Cubao', mode: 'uv_express', color: '#4A148C',
      stops: ['hub-novaliches', 'hub-commonwealth', 'hub-cubao-terminal'],
      avgSpeedKmh: 18 },
      
    // Pasig River Ferry System
    { id: 'ferry-pasig-manila', name: 'Pasig River Ferry', mode: 'ferry', color: '#00BCD4',
      stops: ['ferry-pinagbuhatan', 'ferry-guadalupe', 'ferry-valenzuela', 'ferry-lawton', 'ferry-escolta'],
      avgSpeedKmh: 15 },
      
    // Micro-mobility & MC Taxis (Simulated typical routes)
    { id: 'mc-bgc-ortigas', name: 'MC Taxi (Angkas/Joyride)', mode: 'mc_taxi', color: '#00E676',
      stops: ['hub-bgc', 'mrt3-ortigas'],
      avgSpeedKmh: 25 },
    { id: 'trike-pasay-moa', name: 'Tricycle', mode: 'tricycle', color: '#FFC107',
      stops: ['hub-pasay', 'hub-sm-moa'],
      avgSpeedKmh: 10 },
    { id: 'pedicab-divisoria', name: 'Pedicab', mode: 'pedicab', color: '#8D6E63',
      stops: ['lrt2-recto', 'hub-divisoria'],
      avgSpeedKmh: 5 },
  ];

  // Make transfers bidirectional
  const biTransfers = [];
  transfers.forEach(t => {
    biTransfers.push(t);
    biTransfers.push({ from: t.to, to: t.from, walkMin: t.walkMin, distance: t.distance });
  });

  return {
    stations,
    routes,
    paratransitRoutes,
    transfers: biTransfers,
    haversine,

    getStation(id) { return stations[id]; },
    getStationName(id) { return stations[id]?.name || id; },

    getAllStationIds() { return Object.keys(stations); },

    getTransfersFrom(stationId) {
      return biTransfers.filter(t => t.from === stationId);
    },

    findNearestStations(lat, lon, maxKm = 1.5, limit = 5) {
      return Object.entries(stations)
        .map(([id, s]) => ({ id, ...s, dist: haversine(lat, lon, s.lat, s.lon) }))
        .filter(s => s.dist <= maxKm)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, limit);
    },

    searchStations(query) {
      const q = query.toLowerCase().trim();
      if (!q) return [];
      return Object.entries(stations)
        .filter(([id, s]) => s.name.toLowerCase().includes(q) || id.includes(q))
        .map(([id, s]) => ({ id, ...s }))
        .slice(0, 10);
    }
  };
})();

if (typeof module !== 'undefined') module.exports = TransitGraph;
