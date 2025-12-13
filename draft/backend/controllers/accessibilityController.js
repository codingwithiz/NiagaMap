const catchmentService = require('../services/catchmentService');
const accessibilityService = require('../services/accessibilityService');

/**
 * Controller to generate hexagons and compute accessibility scores.
 * opts: { radius, center_x, center_y, category, token, maxCount }
 */
async function runAccessibility(opts = {}) {
    const { hexagons, category, token } = opts;

    if (!Array.isArray(hexagons) || hexagons.length === 0) {
        throw new Error('`hexagons` (array of rings) is required for accessibility analysis (generation is handled by workflow)');
    }

    const settings = catchmentService.getSettingsForCategory(category);

    const scores = await accessibilityService.computeAccessibilityScores(hexagons, token, {
        threshold: settings.accessibilityThreshold,
        delayMs: settings.delayMs
    });

    // const rawResponses = scores.map(s => s.rawResponse || null);

    console.log("Accessibility scores computed:", scores);
    try {
        await accessibilityService.saveAccessibilityScoresToDatabase(scores, hexagons.map(h => h.hex_id));
    } catch (error) {
        console.error("Error saving accessibility scores to database:", error);
    }
    return {
        hexagons: hexagons,
        scores
        // rawResponses
    };
}

module.exports = { runAccessibility };
