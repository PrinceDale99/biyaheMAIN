/**
 * B.I.Y.A.H.E. — Main Application Controller
 * Handles UI state, search, route display, and user interactions.
 */

const App = (() => {
  let state = {
    screen: 'home', // home | results | detail
    origin: null,
    destination: null,
    originText: '',
    destText: '',
    profile: { type: 'regular', groupSize: 1 },
    results: null,
    selectedJourney: null,
    searchFocused: null, // 'origin' | 'destination'
    searchResults: [],
    departureTime: new Date(),
  };

  // DOM refs
  const $ = id => document.getElementById(id);

  function init() {
    render();
    bindEvents();
    updateClock();
    setInterval(updateClock, 60000);

    // Particles
    createParticles();
  }

  function updateClock() {
    const now = new Date();
    const el = $('current-time');
    if (el) {
      el.textContent = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    }
    state.departureTime = now;
  }

  function createParticles() {
    const container = $('particles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 8 + 's';
      p.style.animationDuration = (6 + Math.random() * 6) + 's';
      p.style.width = p.style.height = (2 + Math.random() * 4) + 'px';
      container.appendChild(p);
    }
  }

  function bindEvents() {
    document.addEventListener('click', e => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;

      switch (action) {
        case 'focus-origin':
          state.searchFocused = 'origin';
          renderSearchOverlay();
          break;
        case 'focus-dest':
          state.searchFocused = 'destination';
          renderSearchOverlay();
          break;
        case 'map-select':
          closeSearchOverlay();
          state.screen = 'map-selection';
          render();
          MapEngine.showMapForSelection(state.searchFocused);
          break;
        case 'confirm-pin':
          state.screen = 'home';
          MapEngine.hideMap();
          render();
          break;
        case 'swap-stops':
          swapStops();
          break;
        case 'search-route':
          searchRoute();
          break;
        case 'go-home':
          state.screen = 'home';
          state.results = null;
          state.selectedJourney = null;
          render();
          break;
        case 'select-journey':
          selectJourney(parseInt(target.dataset.index));
          break;
        case 'back-results':
          state.screen = 'results';
          state.selectedJourney = null;
          render();
          break;
        case 'close-search':
          closeSearchOverlay();
          break;
        case 'set-profile':
          state.profile.type = target.dataset.profileType;
          document.querySelectorAll('.profile-chip').forEach(c => c.classList.remove('active'));
          target.classList.add('active');
          break;
        case 'quick-route':
          setQuickRoute(target.dataset.from, target.dataset.to, target.dataset.fromText, target.dataset.toText);
          break;
      }
    });

    document.addEventListener('input', e => {
      if (e.target.id === 'search-input') {
        const query = e.target.value;
        state.searchResults = TransitGraph.searchStations(query);
        renderSearchResults();
      }
    });

    window.addEventListener('mapPinMoved', e => {
      const { lat, lng, name } = e.detail;
      const nearest = TransitGraph.findNearestStations(lat, lng, 5, 1)[0];
      const stationId = nearest ? nearest.id : null;
      
      // If on home screen and no focus, assume picking destination
      const focus = state.searchFocused || (state.screen === 'home' ? 'destination' : null);

      if (focus === 'origin') {
        state.originText = name;
        state.origin = stationId;
      } else if (focus === 'destination') {
        state.destText = name;
        state.destination = stationId;
        
        // If we are on home screen, maybe show a toast or update the UI
        if (state.screen === 'home') {
          render();
        }
      }
      
      const pinLabel = document.getElementById('pin-label');
      if (pinLabel) pinLabel.textContent = name;
    });
  }

  function setQuickRoute(from, to, fromText, toText) {
    state.origin = from;
    state.destination = to;
    state.originText = fromText;
    state.destText = toText;
    searchRoute();
  }

  function swapStops() {
    [state.origin, state.destination] = [state.destination, state.origin];
    [state.originText, state.destText] = [state.destText, state.originText];
    render();
  }

  function selectStation(stationId, stationName) {
    if (state.searchFocused === 'origin') {
      state.origin = stationId;
      state.originText = stationName;
    } else {
      state.destination = stationId;
      state.destText = stationName;
    }
    closeSearchOverlay();
    render();
  }

  function closeSearchOverlay() {
    state.searchFocused = null;
    state.searchResults = [];
    const overlay = $('search-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
    }
  }

  function searchRoute() {
    if (!state.origin || !state.destination) {
      showToast('Please select both origin and destination');
      return;
    }
    if (state.origin === state.destination) {
      showToast('Origin and destination cannot be the same');
      return;
    }

    // Show loading
    state.screen = 'loading';
    render();

    setTimeout(() => {
      const results = McRAPTOR.query(state.origin, state.destination, state.departureTime, state.profile);
      state.results = results;
      state.screen = 'results';
      render();
    }, 600);
  }

  function selectJourney(index) {
    if (!state.results) return;
    state.selectedJourney = state.results.journeys[index];
    state.screen = 'detail';
    render();
  }

  function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ─── RENDER ───
  function render() {
    const app = $('app');
    
    // Ensure map is hidden unless explicitly needed
    // Map visibility management
    if (typeof MapEngine !== 'undefined') {
      const container = document.getElementById('map-container');
      if (state.screen === 'home' || state.screen === 'detail' || state.screen === 'map-selection') {
        if (container) container.style.display = 'block';
      } else {
        if (container) container.style.display = 'none';
      }
    }

    switch (state.screen) {
      case 'home': app.innerHTML = renderHome(); break;
      case 'loading': app.innerHTML = renderLoading(); break;
      case 'results': app.innerHTML = renderResults(); break;
      case 'detail': app.innerHTML = renderDetail(); break;
      case 'map-selection': app.innerHTML = renderMapSelection(); break;
    }
    // Animate in
    requestAnimationFrame(() => {
      document.querySelectorAll('.animate-in').forEach((el, i) => {
        el.style.animationDelay = (i * 0.06) + 's';
        el.classList.add('animated');
      });
    });
  }

  function renderHome() {
    const period = ETAEngine.getTimeOfDay(state.departureTime);
    const greeting = getGreeting();

    return `
      <div class="screen home-screen">
        <div id="particles" class="particles"></div>

        <header class="home-header animate-in">
          <div class="brand">
            <div class="logo-mark">
              <svg width="40" height="40" viewBox="0 0 40 40">
                <defs>
                  <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#6C63FF"/>
                    <stop offset="100%" style="stop-color:#3B82F6"/>
                  </linearGradient>
                </defs>
                <circle cx="20" cy="20" r="18" fill="url(#logoGrad)" opacity="0.15"/>
                <path d="M12 28 L20 12 L28 28 M15 22 H25" stroke="url(#logoGrad)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="20" cy="10" r="2" fill="url(#logoGrad)"/>
              </svg>
            </div>
            <div>
              <h1 class="app-title">B.I.Y.A.H.E.</h1>
              <p class="app-subtitle">For the Commuters. By the Commuters</p>
            </div>
          </div>
          <div class="time-badge" id="current-time">${state.departureTime.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div>
        </header>

        <div class="greeting animate-in">
          <h2>${greeting.text}</h2>
          <p class="greeting-sub">${greeting.sub}</p>
        </div>
        
        <div class="tap-map-hint animate-in">Tap map to pick location</div>

      <div class="search-card glass animate-in">
          <div class="search-row">
            <div class="search-dot origin-dot"></div>
            <button class="search-field" data-action="focus-origin" id="origin-field">
              ${state.originText || '<span class="placeholder">Where are you?</span>'}
            </button>
          </div>
          <div class="search-connector">
            <div class="connector-line"></div>
            <button class="swap-btn" data-action="swap-stops" title="Swap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 16V4m0 12l-3-3m3 3l3-3M17 8v12m0-12l3 3m-3-3l-3 3"/>
              </svg>
            </button>
          </div>
          <div class="search-row">
            <div class="search-dot dest-dot"></div>
            <button class="search-field" data-action="focus-dest" id="dest-field">
              ${state.destText || '<span class="placeholder">Where to?</span>'}
            </button>
          </div>

          <div class="profile-selector">
            <span class="profile-label">I am a:</span>
            <div class="profile-chips">
              ${['regular','student','senior','pwd'].map(t =>
                `<button class="profile-chip ${state.profile.type === t ? 'active' : ''}"
                  data-action="set-profile" data-profile-type="${t}">
                  ${t === 'regular' ? '👤' : t === 'student' ? '🎓' : t === 'senior' ? '👴' : '♿'}
                  ${t.charAt(0).toUpperCase() + t.slice(1)}
                </button>`
              ).join('')}
            </div>
          </div>

          <button class="route-btn" data-action="search-route" id="search-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
            Find My Route
          </button>
        </div>

        <div class="quick-routes animate-in">
          <h3 class="section-title">Popular Routes</h3>
          <div class="quick-grid">
            ${renderQuickRoute('hub-cubao-terminal', 'hub-makati-cbd', 'Cubao', 'Makati CBD', '🏢')}
            ${renderQuickRoute('lrt1-baclaran', 'mrt3-north', 'Baclaran', 'North Ave', '🚇')}
            ${renderQuickRoute('hub-fairview', 'hub-quiapo', 'Fairview', 'Quiapo', '🚌')}
            ${renderQuickRoute('mrt3-ayala', 'lrt2-antipolo', 'Ayala', 'Antipolo', '🌆')}
          </div>
        </div>

        <div class="eta-status glass animate-in">
          <h3 class="section-title">Live Transit Status</h3>
          <div class="status-grid">
            ${renderTransitStatus('mrt3', 'MRT-3')}
            ${renderTransitStatus('lrt1', 'LRT-1')}
            ${renderTransitStatus('lrt2', 'LRT-2')}
            ${renderTransitStatus('carousel', 'EDSA Carousel')}
          </div>
        </div>

        <footer class="home-footer animate-in">
          <p>For the Commuters. By the Commuters</p>
        </footer>
      </div>
    `;
  }

  function renderQuickRoute(from, to, fromText, toText, emoji) {
    return `
      <button class="quick-card glass" data-action="quick-route"
        data-from="${from}" data-to="${to}" data-from-text="${fromText}" data-to-text="${toText}">
        <span class="quick-emoji">${emoji}</span>
        <span class="quick-text">${fromText} → ${toText}</span>
      </button>
    `;
  }

  function renderTransitStatus(lineId, lineName) {
    const eta = ETAEngine.getStopETA(null, lineId, state.departureTime);
    return `
      <div class="status-item">
        <div class="status-dot" style="background:${eta.color}"></div>
        <div class="status-info">
          <span class="status-line">${lineName}</span>
          <span class="status-text">${eta.status}</span>
        </div>
      </div>
    `;
  }

  function renderLoading() {
    return `
      <div class="screen loading-screen">
        <div class="loader">
          <div class="loader-ring"></div>
          <div class="loader-ring"></div>
          <div class="loader-ring"></div>
        </div>
        <p class="loader-text">Computing optimal routes...</p>
        <p class="loader-sub">Analyzing ${Object.keys(TransitGraph.stations).length} stations across ${Object.keys(TransitGraph.routes).length + TransitGraph.paratransitRoutes.length} lines</p>
      </div>
    `;
  }

  function renderResults() {
    if (!state.results) return renderHome();
    const r = state.results;

    return `
      <div class="screen results-screen">
        <header class="results-header glass animate-in">
          <button class="back-btn" data-action="go-home">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div class="results-title">
            <div class="route-summary">${state.originText} → ${state.destText}</div>
            <div class="route-meta">
              ${r.journeys.length} routes found in ${r.queryTimeMs}ms
              ${state.profile.type !== 'regular' ? `<span class="profile-badge">${state.profile.type.toUpperCase()}</span>` : ''}
            </div>
          </div>
        </header>

        <div class="journey-list">
          ${r.journeys.map((j, i) => renderJourneyCard(j, i)).join('')}
        </div>

        <div class="results-footer glass animate-in">
          <p class="footer-tip">💡 Swipe on a route for detailed step-by-step directions</p>
        </div>
      </div>
    `;
  }

  function renderJourneyCard(journey, index) {
    const tagConfig = {
      fastest: { label: '⚡ Fastest', cls: 'tag-fastest' },
      cheapest: { label: '💰 Cheapest', cls: 'tag-cheapest' },
      alternative: { label: '🔄 Alternative', cls: 'tag-alt' }
    };
    const tag = tagConfig[journey.tag] || tagConfig.alternative;

    const transitLegs = journey.legs.filter(l => l.type === 'transit');
    const modeIcons = { rail: '🚇', brt: '🚌', trad_jeepney: '🚐', modern_jeepney: '🚐', ordinary_bus: '🚌', aircon_bus: '🚌' };

    return `
      <div class="journey-card glass animate-in" data-action="select-journey" data-index="${index}">
        <div class="journey-header">
          <span class="journey-tag ${tag.cls}">${tag.label}</span>
          ${journey.hasPromos ? '<span class="promo-badge">🎫 Promo Applied</span>' : ''}
        </div>

        <div class="journey-metrics">
          <div class="metric primary">
            <span class="metric-value">${journey.totalTimeMin}</span>
            <span class="metric-unit">min</span>
          </div>
          <div class="metric">
            <span class="metric-value">₱${journey.totalFare}</span>
            ${journey.totalSaved > 0 ? `<span class="metric-saved">-₱${journey.totalSaved}</span>` : ''}
          </div>
          <div class="metric">
            <span class="metric-value">${journey.transfers}</span>
            <span class="metric-unit">transfer${journey.transfers !== 1 ? 's' : ''}</span>
          </div>
          <div class="metric">
            <span class="metric-value">${journey.walkDistKm}</span>
            <span class="metric-unit">km walk</span>
          </div>
        </div>

        <div class="journey-modes">
          ${transitLegs.map(l => `
            <div class="mode-chip" style="background:${l.routeColor || '#888'}20; border-color:${l.routeColor || '#888'}40; color:${l.routeColor || '#888'}">
              ${modeIcons[l.mode] || '🚐'} ${l.routeName}
            </div>
          `).join('<span class="mode-arrow">→</span>')}
        </div>

        <div class="journey-time-row">
          <span>${journey.departureTime}</span>
          <div class="time-line"></div>
          <span>${journey.arrivalTime}</span>
        </div>
      </div>
    `;
  }

  function renderDetail() {
    if (!state.selectedJourney) return renderResults();
    const j = state.selectedJourney;
    
    // Draw route on OSM
    if (typeof MapEngine !== 'undefined') {
      setTimeout(() => MapEngine.drawRoute(j.legs), 50);
    }

    return `
      <div class="screen detail-screen" style="background: linear-gradient(to top, rgba(10,14,26,1) 60%, rgba(10,14,26,0.3)); pointer-events: auto;">
        <header class="detail-header glass animate-in" style="margin-top: 10px;">
          <button class="back-btn" data-action="back-results">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div class="detail-title">
            <div class="route-summary">${state.originText} → ${state.destText}</div>
            <div class="detail-metrics">
              <span>${j.totalTimeMin} min</span>
              <span>•</span>
              <span>₱${j.totalFare}</span>
              <span>•</span>
              <span>${j.transfers} transfer${j.transfers !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </header>

        ${j.hasPromos ? `
          <div class="promo-banner glass animate-in">
            <span class="promo-icon">🎫</span>
            <div class="promo-info">
              <strong>Promo Applied!</strong>
              <span>You save ₱${j.totalSaved} on this route</span>
            </div>
          </div>
        ` : ''}

        <div class="step-list">
          ${j.legs.map((leg, i) => renderLegStep(leg, i, j.legs.length)).join('')}

          <div class="step-item destination animate-in">
            <div class="step-icon destination-icon">📍</div>
            <div class="step-content">
              <div class="step-title">Arrive at ${state.destText}</div>
              <div class="step-time">${j.arrivalTime}</div>
            </div>
          </div>
        </div>

        <div class="fare-breakdown glass animate-in">
          <h3>Fare Breakdown</h3>
          ${j.legs.filter(l => l.type === 'transit').map(l => `
            <div class="fare-row">
              <span>${l.routeName}</span>
              <span>₱${l.fare?.fare || 0}</span>
            </div>
          `).join('')}
          <div class="fare-total">
            <span>Total</span>
            <span>₱${j.totalFare}</span>
          </div>
        </div>

        <div class="calm-tip glass animate-in">
          <div class="tip-icon">💡</div>
          <div class="tip-content">
            <strong>Commuter Tip</strong>
            <p>${getCommuterTip(j)}</p>
          </div>
        </div>
      </div>
    `;
  }

  function renderLegStep(leg, index, total) {
    const modeIcons = { rail: '🚇', brt: '🚌', trad_jeepney: '🚐', modern_jeepney: '🚐', ordinary_bus: '🚌', aircon_bus: '🚌', walk: '🚶', ferry: '⛴️', p2p_bus: '🚌', uv_express: '🚐', mc_taxi: '🏍️', tricycle: '🛺', pedicab: '🚲' };
    const icon = modeIcons[leg.mode] || modeIcons[leg.type] || '🚐';

    if (leg.type === 'walk') {
      const distanceM = Math.round(leg.distanceKm * 1000);
      return `
        <div class="step-item walk animate-in">
          <div class="step-icon walk-icon">🚶</div>
          <div class="step-content">
            <div class="step-title">Walk ${distanceM}m</div>
            <div class="step-sub">${leg.durationMin} min walk from ${leg.fromName || 'current location'}</div>
            
            <div class="turn-by-turn-instructions">
              <div class="tbt-step"><span>↑</span> Walk straight towards the pedestrian lane</div>
              ${distanceM > 300 ? `<div class="tbt-step"><span>←</span> Turn left at the 2nd intersection</div>` : ''}
              <div class="tbt-step"><span>📍</span> Proceed past the commercial building to the entrance</div>
            </div>

            <div class="landmark-hint">
              <span class="landmark-icon">📸</span>
              <span>Look for the covered walkway near the station entrance</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="step-item transit animate-in">
        <div class="step-icon" style="background:${leg.routeColor}20; color:${leg.routeColor}">${icon}</div>
        <div class="step-content">
          <div class="step-route" style="color:${leg.routeColor}">${leg.routeName}</div>
          <div class="step-title">Board at <strong>${leg.fromName}</strong></div>
          <div class="step-sub">
            ${leg.stopsRidden} stop${leg.stopsRidden !== 1 ? 's' : ''} • ${leg.durationMin} min
            ${leg.fare?.appliedPromos?.length ? `<span class="step-promo">🎫 ${leg.fare.appliedPromos[0].badge}</span>` : ''}
          </div>
          <div class="step-alight">Alight at <strong>${leg.toName}</strong></div>
          <div class="landmark-hint">
            <span class="landmark-icon">📸</span>
            <span>Look for the ${leg.routeName} platform signage</span>
          </div>
        </div>
        <div class="step-fare">₱${leg.fare?.fare || 0}</div>
      </div>
    `;
  }

  function getGreeting() {
    const h = state.departureTime.getHours();
    if (h < 6) return { text: 'Late night commute?', sub: 'We\'ll find you the safest route home.' };
    if (h < 12) return { text: 'Good morning, commuter!', sub: 'Beat the rush. Here\'s your route.' };
    if (h < 17) return { text: 'Good afternoon!', sub: 'Midday traffic is lighter. Perfect time to go.' };
    if (h < 21) return { text: 'Heading home?', sub: 'Let\'s get you there with less hassle.' };
    return { text: 'Evening travels?', sub: 'We\'ve got you covered.' };
  }

  function getCommuterTip(journey) {
    const tips = [
      'Keep your Beep card loaded to avoid queues at ticketing machines.',
      'During peak hours, stand near the middle of the platform for faster boarding.',
      'Download your route offline — you may lose signal underground.',
      'The front car of MRT-3 is reserved for women, elderly, and PWDs during peak hours.',
      'EDSA Carousel stations have covered waiting areas — look for the orange signage.',
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  function renderSearchOverlay() {
    let overlay = $('search-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'search-overlay';
      overlay.className = 'search-overlay';
      document.body.appendChild(overlay);
    }

    const label = state.searchFocused === 'origin' ? 'Where are you?' : 'Where to?';

    overlay.innerHTML = `
      <div class="search-panel glass">
        <div class="search-panel-header">
          <button class="back-btn" data-action="close-search">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <input type="text" id="search-input" class="search-input" placeholder="${label}" autofocus autocomplete="off" />
        </div>
        <button class="map-select-btn" data-action="map-select">
          <span class="landmark-icon">📍</span> Pinpoint on Map Instead
        </button>
        <div id="search-results" class="search-results-list">
          ${renderAllStationsGrouped()}
        </div>
      </div>
    `;

    requestAnimationFrame(() => overlay.classList.add('active'));
    setTimeout(() => $('search-input')?.focus(), 100);
  }

  function renderAllStationsGrouped() {
    const groups = {};
    const modeLabels = { lrt1: '🟢 LRT-1', lrt2: '🟣 LRT-2', mrt3: '🔵 MRT-3', carousel: '🟠 EDSA Carousel' };

    // Rail stations by line
    for (const [lineId, route] of Object.entries(TransitGraph.routes)) {
      groups[modeLabels[lineId] || lineId] = route.stops.map(id => ({
        id,
        name: TransitGraph.getStationName(id),
        line: lineId
      }));
    }

    // Hubs
    const hubStations = Object.entries(TransitGraph.stations)
      .filter(([id]) => id.startsWith('hub-'))
      .map(([id, s]) => ({ id, name: s.name, line: 'hub' }));
    if (hubStations.length) groups['📍 Major Hubs'] = hubStations;

    let html = '';
    for (const [group, stops] of Object.entries(groups)) {
      html += `<div class="search-group"><div class="search-group-title">${group}</div>`;
      html += stops.map(s => `
        <button class="search-result-item" onclick="App.selectStation('${s.id}', '${s.name.replace(/'/g, "\\'")}')">
          <span class="result-name">${s.name}</span>
        </button>
      `).join('');
      html += '</div>';
    }
    return html;
  }

  function renderSearchResults() {
    const container = $('search-results');
    if (!container) return;

    if (state.searchResults.length === 0) {
      container.innerHTML = renderAllStationsGrouped();
      return;
    }

    container.innerHTML = state.searchResults.map(s => `
      <button class="search-result-item" onclick="App.selectStation('${s.id}', '${s.name.replace(/'/g, "\\'")}')">
        <span class="result-name">${s.name}</span>
        <span class="result-lines">${s.lines.join(', ')}</span>
      </button>
    `).join('');
  }

  function renderMapSelection() {
    return `
      <div class="map-selection-ui">
        <div class="map-target-crosshair"></div>
        <div class="map-selection-bottom glass">
          <div class="pin-info">
            <span class="pin-title">Selected Location</span>
            <span class="pin-label" id="pin-label">Drag map to select...</span>
          </div>
          <button class="route-btn" data-action="confirm-pin">Confirm Pin</button>
        </div>
      </div>
    `;
  }

  return { init, selectStation, render };
})();

document.addEventListener('DOMContentLoaded', App.init);
