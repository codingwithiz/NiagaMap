const poiService = require('../services/poiService');
const catchmentController = require('./catchmentController');
const catchmentService = require('../services/catchmentService');

/**
 * Orchestrate POI counting and scoring for hexagons.
 * opts can contain either `hexagons` (3d array) or the same inputs as catchmentController: { radius, center_x, center_y, category }
 * Also requires token (arcgis places API token) either in opts.token or process.env.ARC_TOKEN
 */
async function runPOIScoring(opts = {}) {
    const { hexagons = null, radius, center_x, center_y, category = null, token = null, maxCount = null } = opts;

    const usedToken = token || process.env.ARC_TOKEN || process.env.ARCGIS_TOKEN || process.env.ARCGIS_API_KEY;
    if (!usedToken) throw new Error('ArcGIS Places API token required (pass token or set ARC_TOKEN/ARCGIS_TOKEN)');

    const rings = hexagons;
    if (!Array.isArray(rings) || rings.length === 0) {
        throw new Error('`hexagons` must be provided as an array of rings to run POI scoring (generation is handled by workflow)');
    }

    // Determine category_name from CATEGORY_MAP if possible, otherwise fall back to provided category
    let categoryNameToUse = category;
    try {
        const settings = catchmentService.getSettingsForCategory(category);
        if (settings && settings.category_name) categoryNameToUse = settings.category_name;
    } catch (e) {
        // ignore and fallback to raw category
    }

    // Fetch POI counts for each hexagon
    // Pass category name so service will translate to categoryIds
    const counts = await poiService.fetchPOICountsForHexagons(rings, usedToken, { categoryName: categoryNameToUse });

    const scores = poiService.calculateScoresFromCounts(counts, category || 'default');

    return { hexagons: rings, counts, scores };
}

module.exports = { runPOIScoring };
