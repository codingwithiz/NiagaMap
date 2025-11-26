const catchmentService = require('../services/catchmentService');
const accessibilityService = require('../services/accessibilityService');

/**
 * Controller to generate hexagons and compute accessibility scores.
 * opts: { radius, center_x, center_y, category, token, maxCount }
 */
async function runAccessibility(opts = {}) {
    const { radius, center_x, center_y, category, token, maxCount = null } = opts;

    if (![radius, center_x, center_y].every(n => Number.isFinite(Number(n)))) {
        throw new Error('radius, center_x and center_y must be numeric');
    }

    const settings = catchmentService.getSettingsForCategory(category);
    const hexagons = catchmentService.generateCatchmentHexagons(center_x, center_y, radius, settings.sideLength);

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
