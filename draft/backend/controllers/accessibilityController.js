const catchmentService = require('../services/catchmentService');
const accessibilityService = require('../services/accessibilityService');

/**
 * Controller to generate hexagons and compute accessibility scores.
 * opts: { radius, center_x, center_y, category, token, maxCount }
 */
async function runAccessibility(opts = {}) {
    const { hexagons, category, token, maxCount = null } = opts;

    if (!Array.isArray(hexagons) || hexagons.length === 0) {
        throw new Error('`hexagons` (array of rings) is required for accessibility analysis (generation is handled by workflow)');
    }

    const settings = catchmentService.getSettingsForCategory(category);
    const limitedHexagons = (maxCount && Number.isFinite(Number(maxCount))) ? hexagons.slice(0, Number(maxCount)) : hexagons;

    const scores = await accessibilityService.computeAccessibilityScores(limitedHexagons, token, {
        threshold: settings.accessibilityThreshold,
        delayMs: settings.delayMs
    });

    const rawResponses = scores.map(s => s.rawResponse || null);

    return {
        hexagons: limitedHexagons,
        scores,
        rawResponses
    };
}

module.exports = { runAccessibility };
