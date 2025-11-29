const catchmentService = require('../services/catchmentService');
const riskService = require('../services/riskService');
const arcgisAuth = require('../api/arcgisAuth');
const CATEGORY_MAP = require('../constants/categoryMap');

/**
 * Controller to compute flood/risk scores for hexagons.
 * opts: { radius, center_x, center_y, category, token, maxCount }
 */
async function runRiskAnalysis(opts = {}) {
    const { radius, center_x, center_y, category, maxCount = null } = opts;

    if (![radius, center_x, center_y].every(n => Number.isFinite(Number(n)))) {
        throw new Error('radius, center_x and center_y must be numeric');
    }

    const settings = catchmentService.getSettingsForCategory(category);
    const hexagons = catchmentService.generateCatchmentHexagons(center_x, center_y, radius, settings.sideLength);
    const limitedHexagons = (maxCount && Number.isFinite(Number(maxCount))) ? hexagons.slice(0, Number(maxCount)) : hexagons;

    // prefer provided token, otherwise attempt to generate/get one from server helper
    const tokenToUse = await arcgisAuth.getToken();

    // determine riskRatio here: prefer opts.riskRatio (incoming), then category settings, then default
    let ratioVal = null;
    if (Number.isFinite(Number(opts.riskRatio))) ratioVal = Number(opts.riskRatio);
    else if (settings && Number.isFinite(Number(settings.riskRatio))) ratioVal = Number(settings.riskRatio);
    else if (CATEGORY_MAP && CATEGORY_MAP.default && Number.isFinite(Number(CATEGORY_MAP.default.riskRatio))) ratioVal = Number(CATEGORY_MAP.default.riskRatio);
    else ratioVal = 0.5;

    const scores = await riskService.computeFloodRiskScores(limitedHexagons, category, tokenToUse, {
        sideLengthMeters: settings.sideLength,
        thresholdHa: settings.floodRiskThresholdHa,
        featureServiceUrl: process.env.BANJIR_FEATURE_URL,
        landslideFeatureUrl: process.env.LANDSLIDE_FEATURE_URL,
        landslideThreshold: settings.landslideRiskThreshold,
        delayMs: settings.delayMs,
        riskRatio: ratioVal
    });

    const rawResponses = scores.map(s => s.rawResponse || null);

    return {
        hexagons: limitedHexagons,
        scores,
        rawResponses
    };
}

module.exports = { runRiskAnalysis };
