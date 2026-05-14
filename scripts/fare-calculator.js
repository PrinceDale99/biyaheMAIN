/**
 * B.I.Y.A.H.E. — 2026 Calibrated Fare Matrix & Calculator
 * Implements Philippine transit fare regulations with sectoral discounts.
 */

const FareCalculator = (() => {
  // ─── 2026 CALIBRATED FARE MATRIX ───
  const fareMatrix = {
    trad_jeepney:   { baseFare: 14.00, baseKm: 4, perKmRate: 1.80, label: 'Traditional Jeepney' },
    modern_jeepney: { baseFare: 17.00, baseKm: 4, perKmRate: 2.20, label: 'Modern Jeepney' },
    ordinary_bus:   { baseFare: 15.00, baseKm: 5, perKmRate: 2.65, label: 'City Bus (Ordinary)' },
    aircon_bus:     { baseFare: 18.00, baseKm: 5, perKmRate: 2.65, label: 'City Bus (Aircon)' },
    p2p_bus:        { baseFare: 50.00, baseKm: 0, perKmRate: 0.00, label: 'P2P Bus' },
    uv_express:     { baseFare: 50.00, baseKm: 2, perKmRate: 2.50, label: 'UV Express' },
    ferry:          { baseFare: 50.00, baseKm: 0, perKmRate: 0.00, label: 'Pasig River Ferry' },
    mc_taxi:        { baseFare: 50.00, baseKm: 2, perKmRate: 15.00, label: 'Motorcycle Taxi' },
    tricycle:       { baseFare: 20.00, baseKm: 1, perKmRate: 5.00, label: 'Tricycle' },
    pedicab:        { baseFare: 20.00, baseKm: 1, perKmRate: 0.00, label: 'Pedicab' },
    rail:           { baseFare: 15.00, baseKm: 0, perKmRate: 1.50, label: 'Rail (LRT/MRT)' },
    brt:            { baseFare: 13.00, baseKm: 0, perKmRate: 0.00, label: 'EDSA Carousel' },
  };

  // Rail fare tables (distance-based zones)
  const railFareTable = {
    lrt1: [15, 15, 20, 20, 20, 25, 25, 25, 30, 30, 30, 35, 35, 35, 35, 35, 35, 35, 35, 35],
    lrt2: [15, 15, 20, 20, 25, 25, 25, 30, 30, 30, 35, 35, 35, 35],
    mrt3: [15, 15, 20, 20, 25, 25, 25, 28, 28, 28, 30, 30, 30],
  };

  // ─── PROMOTIONAL PROGRAMS ───
  const promos = {
    railHalfPrice: {
      name: 'Rail 50% Sector Discount',
      badge: '50% OFF',
      applies: (profile, line) => {
        return ['student','senior','pwd'].includes(profile.type) &&
          ['lrt1','lrt2','mrt3'].includes(line);
      },
      discount: 0.50
    },
    edsaBuswayFree: {
      name: 'NSCPC Free Ride',
      badge: 'FREE RIDE',
      applies: (profile, line, time) => {
        return line === 'carousel' && isNSCPCActive(time);
      },
      discount: 1.00
    },
    pamilyaPass: {
      name: 'PAMILYA Pass 1+3 Weekend Promo',
      badge: 'PAMILYA 1+3',
      applies: (profile, line, time) => {
        const day = time.getDay();
        return (day === 0 || day === 6) &&
          ['lrt2','mrt3'].includes(line) &&
          profile.groupSize >= 4;
      },
      discount: 0.75 // 3 out of 4 ride free = 75% off total
    },
    sectoralDiscount: {
      name: 'Sectoral 20% Discount',
      badge: '20% OFF',
      applies: (profile) => ['student','senior','pwd'].includes(profile.type),
      discount: 0.20
    }
  };

  function isNSCPCActive(time) {
    const h = time.getHours();
    return (h >= 5 && h <= 22); // Simplified: active during service hours
  }

  function isPeakHour(time) {
    const h = time.getHours();
    return (h >= 6 && h < 9) || (h >= 17 && h < 20);
  }

  /**
   * Calculate fare for a single leg.
   * @param {string} mode - Transport mode key
   * @param {number} distanceKm - Distance in kilometers
   * @param {string} line - Line identifier (e.g., 'lrt1', 'mrt3')
   * @param {number} stopsCount - Number of stops traveled (for rail)
   * @param {Object} profile - User profile { type: 'regular'|'student'|'senior'|'pwd', groupSize: 1 }
   * @param {Date} time - Current time for promo evaluation
   * @returns {Object} { fare, originalFare, appliedPromos: [], breakdown }
   */
  function calculateLegFare(mode, distanceKm, line, stopsCount, profile = { type: 'regular', groupSize: 1 }, time = new Date()) {
    let baseFare = 0;
    const appliedPromos = [];

    // Calculate base fare
    if (mode === 'rail' && railFareTable[line]) {
      const idx = Math.min(stopsCount, railFareTable[line].length - 1);
      baseFare = railFareTable[line][idx] || fareMatrix.rail.baseFare;
    } else if (mode === 'brt') {
      baseFare = fareMatrix.brt.baseFare;
    } else {
      const matrix = fareMatrix[mode] || fareMatrix.trad_jeepney;
      baseFare = matrix.baseFare;
      if (distanceKm > matrix.baseKm) {
        baseFare += Math.ceil(distanceKm - matrix.baseKm) * matrix.perKmRate;
      }
    }

    const originalFare = baseFare;
    let finalFare = baseFare;

    // Apply promotions (highest discount wins for stacking prevention)
    let bestDiscount = 0;
    let bestPromo = null;

    for (const [key, promo] of Object.entries(promos)) {
      const applies = promo.applies(profile, line, time);
      if (applies && promo.discount > bestDiscount) {
        bestDiscount = promo.discount;
        bestPromo = { key, ...promo };
      }
    }

    if (bestPromo) {
      finalFare = Math.round(baseFare * (1 - bestPromo.discount));
      appliedPromos.push({
        name: bestPromo.name,
        badge: bestPromo.badge,
        saved: originalFare - finalFare
      });
    }

    return {
      fare: Math.max(0, finalFare),
      originalFare,
      appliedPromos,
      mode: fareMatrix[mode]?.label || mode,
      distanceKm: Math.round(distanceKm * 100) / 100
    };
  }

  /**
   * Calculate total journey fare across multiple legs.
   */
  function calculateJourneyFare(legs, profile, time) {
    let totalFare = 0;
    let totalOriginal = 0;
    const allPromos = [];
    const legFares = [];

    legs.forEach(leg => {
      const result = calculateLegFare(leg.mode, leg.distanceKm, leg.line, leg.stops, profile, time);
      totalFare += result.fare;
      totalOriginal += result.originalFare;
      allPromos.push(...result.appliedPromos);
      legFares.push(result);
    });

    return {
      totalFare,
      totalOriginal,
      totalSaved: totalOriginal - totalFare,
      legFares,
      appliedPromos: allPromos,
      hasPromos: allPromos.length > 0
    };
  }

  return {
    fareMatrix,
    calculateLegFare,
    calculateJourneyFare,
    isPeakHour,
    isNSCPCActive
  };
})();

if (typeof module !== 'undefined') module.exports = FareCalculator;
