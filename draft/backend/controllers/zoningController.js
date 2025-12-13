const catchmentService = require('../services/catchmentService');
const zoningService = require('../services/zoningService');

/**
 * Controller to generate hexagons and compute zoning-based scores.
 * opts: { radius, center_x, center_y, category, token, maxCount }
 */
async function runZoning(opts = {}) {
    const { hexagons, category, maxCount = null } = opts;

    if (!Array.isArray(hexagons) || hexagons.length === 0) {
        throw new Error('`hexagons` (array of rings) is required for zoning (generation is handled by workflow)');
    }

    const settings = catchmentService.getSettingsForCategory(category);
    const limitedHexagons = (maxCount && Number.isFinite(Number(maxCount))) ? hexagons.slice(0, Number(maxCount)) : hexagons;

    const scores = await zoningService.computeZoningScores(limitedHexagons, category, { featureServiceUrl: process.env.ZONING_FEATURE_URL, delayMs: settings.delayMs });

    const rawResponses = scores.map(s => s.rawResponse || null);

    return {
        hexagons: limitedHexagons,
        scores,
        // rawResponses
    };
}

module.exports = { runZoning };
