const poiService = require("../services/poiService");
const catchmentController = require("./catchmentController");
const catchmentService = require("../services/catchmentService");

/**
 * Orchestrate POI counting and scoring for hexagons.
 * opts can contain either `hexagons` (3d array) or the same inputs as catchmentController: { radius, center_x, center_y, category }
 * Also requires token (arcgis places API token) either in opts.token or process.env.ARC_TOKEN
 */
async function runPOIScoring(opts = {}) {
    const {
        hexagons = null,
        category = null,
        token = null,
    } = opts;

    const rings = hexagons;
    if (!Array.isArray(rings) || rings.length === 0) {
        throw new Error(
            "`hexagons` must be provided as an array of rings to run POI scoring (generation is handled by workflow)"
        );
    }

    // Determine category_name from CATEGORY_MAP if possible, otherwise fall back to provided category
    let categoryNameToUse = category;
    try {
        const settings = catchmentService.getSettingsForCategory(category);
        if (settings && settings.category_name)
            categoryNameToUse = settings.category_name;
    } catch (e) {
        // ignore and fallback to raw category
    }

    // Fetch POI counts for each hexagon
    // Pass category name so service will translate to categoryIds
    const poiResult = await poiService.fetchPOICountsForHexagons(rings, token, {
        categoryName: categoryNameToUse,
    });
    console.log(poiResult.poi_count, poiResult.hex_id_array);
    const scores = poiService.calculateScoresFromCounts(
        poiResult.poi_count,
        category || "default"
    );
    console.log("poiResult:", poiResult);
    try {
        await poiService.savePOIScoresToDatabase(
            poiResult.hex_id_array,
            scores,
            poiResult.poi_count
        );
    } catch (error) {
        console.error("Error saving POI scores:", error);
        throw error;
    }

    return {
        // hexagons: rings,
        counts: poiResult.poi_count,
        hex_id_array: poiResult.hex_id_array,
        scores: scores,
    };
}

module.exports = { runPOIScoring };
