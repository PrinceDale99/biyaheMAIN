/**
 * B.I.Y.A.H.E. — Map Engine (MapLibre GL JS)
 * Handles high-performance vector rendering, geofencing, and live telemetry.
 */

const MapEngine = (() => {
  let map = null;
  let pinMarker = null;
  let activeRouteLayerId = 'route-path';
  let telemetryInterval = null;
  let userMarker = null;

  // Strict Geofencing: Philippines bounding box
  const PH_BOUNDS = [
    [116.928, 4.588], // Southwest [lng, lat]
    [126.605, 21.118] // Northeast [lng, lat]
  ];

  function init() {
    const container = document.getElementById('map-container');
    if (!container) return;

    // Metro Manila Center [lng, lat]
    const center = [120.9842, 14.5995];

    map = new maplibregl.Map({
      container: 'map-container',
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO'
          }
        },
        layers: [
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      },
      center: center,
      zoom: 13,
      minZoom: 6,
      maxBounds: PH_BOUNDS,
      dragRotate: false,
      touchPitch: false
    });

    map.on('load', () => {
      // Initial pinpoint
      const el = document.createElement('div');
      el.className = 'map-pin-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundImage = 'url("https://cdn-icons-png.flaticon.com/512/684/684908.png")';
      el.style.backgroundSize = 'cover';

      pinMarker = new maplibregl.Marker({ draggable: true })
        .setLngLat(center)
        .addTo(map);

      pinMarker.on('dragend', () => {
        const pos = pinMarker.getLngLat();
        reverseGeocode(pos.lat, pos.lng);
      });

      // Add click listener for selection
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        // Only if we are not in a specific mode or if we want to allow quick-pick
        pinMarker.setLngLat([lng, lat]);
        reverseGeocode(lat, lng);
      });

      // Listener for map move (for center-based selection)
      map.on('move', () => {
        if (MapEngine.isSelectionMode) {
          const center = map.getCenter();
          pinMarker.setLngLat(center);
          reverseGeocode(center.lat, center.lng);
        }
      });
    });

    // Map is visible by default now
    container.style.display = 'block';
  }

  function showMapForSelection(type, currentLat, currentLng) {
    this.currentSelectionType = type;
    this.isSelectionMode = true;
    const container = document.getElementById('map-container');
    container.style.display = 'block';
    
    // Add crosshair to container if not present
    if (!document.getElementById('map-crosshair')) {
      const crosshair = document.createElement('div');
      crosshair.id = 'map-crosshair';
      crosshair.className = 'map-target-crosshair';
      container.appendChild(crosshair);
    }
    document.getElementById('map-crosshair').style.display = 'block';
    
    setTimeout(() => map.resize(), 100);

    if (currentLat && currentLng) {
      map.flyTo({ center: [currentLng, currentLat], zoom: 15 });
      pinMarker.setLngLat([currentLng, currentLat]);
    } else {
      const center = map.getCenter();
      pinMarker.setLngLat(center);
      reverseGeocode(center.lat, center.lng);
    }
  }

  function hideMap() {
    this.isSelectionMode = false;
    const crosshair = document.getElementById('map-crosshair');
    if (crosshair) crosshair.style.display = 'none';

    document.getElementById('map-container').style.display = 'none';
    if (telemetryInterval) {
      clearInterval(telemetryInterval);
      telemetryInterval = null;
    }
  }

  function flyTo(lat, lng, zoom = 15) {
    if (map) {
      map.flyTo({ center: [lng, lat], zoom: zoom, speed: 1.2 });
    }
  }

  function reverseGeocode(lat, lng) {
    const nearest = TransitGraph.findNearestStations(lat, lng, 3, 1)[0];
    let locationName = "Custom Pin Location";
    if (nearest) {
      locationName = `Near ${nearest.name}`;
    }
    
    window.dispatchEvent(new CustomEvent('mapPinMoved', { 
      detail: { lat, lng, name: locationName }
    }));
  }

  function drawRoute(legs) {
    // Clear existing layers and markers
    const layers = map.getStyle().layers;
    layers.forEach(layer => {
      if (layer.id.startsWith('route-leg-')) {
        map.removeLayer(layer.id);
        map.removeSource(layer.id);
      }
    });

    if (map.getLayer(activeRouteLayerId)) {
      map.removeLayer(activeRouteLayerId);
      map.removeSource(activeRouteLayerId);
    }
    
    // Remove existing markers (except pinMarker and userMarker)
    document.querySelectorAll('.route-marker').forEach(m => m.remove());

    const container = document.getElementById('map-container');
    container.style.display = 'block';
    setTimeout(() => map.resize(), 100);

    const allCoordinates = [];
    legs.forEach((leg, index) => {
      const fromSt = TransitGraph.getStation(leg.from);
      const toSt = TransitGraph.getStation(leg.to);
      if (!fromSt || !toSt) return;

      const legCoords = [[fromSt.lon, fromSt.lat], [toSt.lon, toSt.lat]];
      allCoordinates.push(...legCoords);

      const layerId = `route-leg-${index}`;
      const color = leg.routeColor || (leg.type === 'walk' ? '#888' : '#6C63FF');
      
      map.addSource(layerId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: legCoords
          }
        }
      });

      map.addLayer({
        id: layerId,
        type: 'line',
        source: layerId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': color,
          'line-width': leg.type === 'walk' ? 4 : 8,
          'line-opacity': 0.9,
          'line-dasharray': leg.type === 'walk' ? [1, 1] : []
        }
      });

      // Add transfer markers
      if (index > 0) {
        const markerEl = document.createElement('div');
        markerEl.className = 'route-marker transfer-marker';
        markerEl.style.backgroundColor = color;
        new maplibregl.Marker({ element: markerEl })
          .setLngLat([fromSt.lon, fromSt.lat])
          .addTo(map);
      }
    });

    if (allCoordinates.length > 0) {
      // Start Marker
      const startEl = document.createElement('div');
      startEl.className = 'route-marker start-marker';
      startEl.innerHTML = '<span>S</span>';
      new maplibregl.Marker({ element: startEl })
        .setLngLat(allCoordinates[0])
        .addTo(map);

      // End Marker
      const endEl = document.createElement('div');
      endEl.className = 'route-marker end-marker';
      endEl.innerHTML = '<span>E</span>';
      new maplibregl.Marker({ element: endEl })
        .setLngLat(allCoordinates[allCoordinates.length - 1])
        .addTo(map);

      const bounds = allCoordinates.reduce((acc, coord) => {
        return acc.extend(coord);
      }, new maplibregl.LngLatBounds(allCoordinates[0], allCoordinates[0]));

      map.fitBounds(bounds, { padding: 100 });
    }
  }

  function startLiveTracking(startLat, startLng) {
    if (userMarker) userMarker.remove();

    const el = document.createElement('div');
    el.className = 'user-pulse-icon';
    el.innerHTML = '<div class="pulse-dot"></div><div class="pulse-ring"></div>';

    userMarker = new maplibregl.Marker({ element: el })
      .setLngLat([startLng, startLat])
      .addTo(map);

    map.setCenter([startLng, startLat]);
    map.setZoom(16);

    let currentLat = startLat;
    let currentLng = startLng;

    telemetryInterval = setInterval(() => {
      currentLat += (Math.random() - 0.5) * 0.0005;
      currentLng += (Math.random() - 0.5) * 0.0005;
      userMarker.setLngLat([currentLng, currentLat]);
      map.panTo([currentLng, currentLat], { duration: 1000 });
    }, 2000);
  }

  const markers = [];

  function addMarker(lat, lon, options = {}) {
    const el = document.createElement('div');
    el.className = 'station-marker';
    el.style.backgroundColor = options.color || '#fff';
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid #000';
    el.style.cursor = 'pointer';

    if (options.onClick) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onClick();
      });
    }

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lon, lat])
      .setPopup(new maplibregl.Popup().setText(options.title || ''))
      .addTo(map);
    
    markers.push(marker);
    return marker;
  }

  function clearMarkers() {
    markers.forEach(m => m.remove());
    markers.length = 0;
  }

  return { init, showMapForSelection, hideMap, drawRoute, startLiveTracking, addMarker, clearMarkers };
})();

document.addEventListener('DOMContentLoaded', MapEngine.init);
