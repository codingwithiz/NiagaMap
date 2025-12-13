const catchmentService = require('../services/catchmentService');
const riskService = require('../services/riskService');
const arcgisAuth = require('../api/arcgisAuth');
const CATEGORY_MAP = require('../constants/categoryMap');

/**
 * Controller to compute flood/risk scores for hexagons.
 * opts: { radius, center_x, center_y, category, token, maxCount }
 */
async function runRiskAnalysis(opts = {}) {
    const { hexagons, category} = opts;

    if (!Array.isArray(hexagons) || hexagons.length === 0) {
        throw new Error('`hexagons` (array of rings) is required for risk analysis (generation is handled by workflow)');
    }

    const settings = catchmentService.getSettingsForCategory(category);
    // const limitedHexagons = (maxCount && Number.isFinite(Number(maxCount))) ? hexagons.slice(0, Number(maxCount)) : hexagons;

    // prefer provided token, otherwise attempt to generate/get one from server helper inside riskService
    const tokenToUse = null; // riskService will generate server-side token as needed

    // determine riskRatio: prefer incoming opts.riskRatio, then category settings, then default in riskService
    // const ratioVal = Number.isFinite(Number(riskRatio)) ? Number(riskRatio) : (settings && Number.isFinite(Number(settings.riskRatio)) ? Number(settings.riskRatio) : null);

    const scores = await riskService.computeFloodRiskScores(hexagons, category, tokenToUse, {
        sideLengthMeters: settings.sideLength,
        thresholdHa: settings.floodRiskThresholdHa,
        featureServiceUrl: process.env.BANJIR_FEATURE_URL,
        landslideFeatureUrl: process.env.LANDSLIDE_FEATURE_URL,
        landslideThreshold: settings.landslideRiskThreshold,
        delayMs: settings.delayMs,
        riskRatio: settings.riskRatio
    });

    // const rawResponses = scores.map(s => s.rawResponse || null);
    
    //save the risk scores to database
    try {
        await riskService.saveRiskScoresToDatabase(
            scores,
            hexagons.map((h) => h.hex_id)
        );
    }
    catch (error) {
        console.error('Error saving risk scores to database:', error);
    }
    return {
        hexagons: hexagons,
        scores,
        // rawResponses
    };
}

module.exports = { runRiskAnalysis };
