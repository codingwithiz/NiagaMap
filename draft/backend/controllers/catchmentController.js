const catchmentService = require('../services/catchmentService');

// small local helper to compute centroid for a single ring [[lon,lat],...]
function polygonCentroid(ring) {
    if (!Array.isArray(ring) || ring.length === 0) return null;
    const last = ring[ring.length - 1];
    const first = ring[0];
    const pts = (last && first && last[0] === first[0] && last[1] === first[1]) ? ring.slice(0, -1) : ring.slice();
    let sumX = 0, sumY = 0;
    for (const p of pts) { sumX += Number(p[0]); sumY += Number(p[1]); }
    const n = pts.length || 1;
    return { lon: sumX / n, lat: sumY / n };
}

/**
 * Controller entrypoint. Given inputs, generate hexagons and return them.
 * @param {Object} opts - { radius, center_x, center_y, category, maxCount }
 * @returns {Object} { hexagons, numberOfHexagons, settings }
 */
async function runCatchment(opts = {}) {
    const { radius, center_x, center_y, category, maxCount = null } = opts;

    if (![radius, center_x, center_y].every(n => Number.isFinite(Number(n)))) {
        throw new Error('radius, center_x and center_y must be numeric');
    }

    // Generate hexagons and get settings for this category
    const settings = catchmentService.getSettingsForCategory(category);
    const hexagons = catchmentService.generateCatchmentHexagons(center_x, center_y, radius, settings.sideLength);

    // Optionally limit count
    const limitedHexagons = (maxCount && Number.isFinite(Number(maxCount))) ? hexagons.slice(0, Number(maxCount)) : hexagons;

    const centroids = limitedHexagons.map(h => polygonCentroid(h));

    return {
        hexagons: limitedHexagons,
        centroids,
        numberOfHexagons: limitedHexagons.length,
        settings
    };
}

module.exports = { runCatchment };
