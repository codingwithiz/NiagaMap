const catchmentService = require('../services/catchmentService');
const demandController = require('./demandController');
const poiController = require('./poiController');
const riskController = require('./riskController');
const zoningController = require('./zoningController');
const accessibilityController = require('./accessibilityController');

// compute centroid helper
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

function getNumericScore(item) {
    if (item == null) return null;
    if (typeof item === 'number') return item;
    if (typeof item === 'object') {
        if (item.score != null && !Number.isNaN(Number(item.score))) return Number(item.score);
        if (item.demandScore != null && !Number.isNaN(Number(item.demandScore))) return Number(item.demandScore);
        if (item.value != null && !Number.isNaN(Number(item.value))) return Number(item.value);
    }
    return null;
}

/**
 * Run full workflow: generate hexagons, call controllers, aggregate scores
 * opts: { radius, center_x, center_y, category, token, maxCount }
 */
async function runWorkflow(opts = {}) {
    const { radius, center_x, center_y, category, token = null, maxCount = null } = opts;

    if (![radius, center_x, center_y].every(n => Number.isFinite(Number(n)))) {
        throw new Error('radius, center_x and center_y must be numeric');
    }

    const settings = catchmentService.getSettingsForCategory(category);
    const hexagons = catchmentService.generateCatchmentHexagons(center_x, center_y, radius, settings.sideLength);
    const limitedHexagons = (maxCount && Number.isFinite(Number(maxCount))) ? hexagons.slice(0, Number(maxCount)) : hexagons;

    // centroids for output
    const centroids = limitedHexagons.map(h => polygonCentroid(h));

    // Run all controllers in parallel where possible
    // demand and poi require token; risk will generate its own server token
    const demandPromise = demandController.runDemand({ hexagons: limitedHexagons, radius, category, token, maxCount, returnResponses: false });
    const poiPromise = poiController.runPOIScoring({ hexagons: limitedHexagons, category, token, maxCount });
    const riskPromise = riskController.runRiskAnalysis({ hexagons: limitedHexagons, category, maxCount, riskRatio: settings.riskRatio });
    const zoningPromise = zoningController.runZoning({ hexagons: limitedHexagons, category, maxCount });
    const accessibilityPromise = accessibilityController.runAccessibility({ hexagons: limitedHexagons, category, token, maxCount });

    const [demandRes, poiRes, riskRes, zoningRes, accessibilityRes] = await Promise.allSettled([demandPromise, poiPromise, riskPromise, zoningPromise, accessibilityPromise]);

    console.log('demandRes:', demandRes);
    // Helper to convert settled result to array or null
    const extractResultArray = (settled, keyFallback) => {
        if (!settled) return null;
        if (settled.status === 'fulfilled') {
            const val = settled.value;
            if (!val) return null;
            // try common keys
            if (Array.isArray(val.demandScore)) return val.demandScore;
            if (Array.isArray(val.scores)) return val.scores;
            if (Array.isArray(val.counts)) return val.counts;
            if (Array.isArray(val.pops)) return val.pops;
            // fallback to keyFallback if provided
            if (keyFallback && Array.isArray(val[keyFallback])) return val[keyFallback];
            return null;
        } else {
            console.error('Workflow: controller failed', settled.reason || settled);
            return null;
        }
    };

    const demandScoresArr = extractResultArray(demandRes, "demandScore");
    console.log('Extracted demandScoresArr:', demandScoresArr);
    const poiScoresArr = extractResultArray(poiRes, 'scores');
    const riskScoresArr = extractResultArray(riskRes, 'scores');
    const zoningScoresArr = extractResultArray(zoningRes, 'scores');
    const accessibilityScoresArr = extractResultArray(accessibilityRes, 'scores');

    // Build output list: for each hexagon, extract numeric scores (or treat missing as 0), sum and divide by 5
    const out = [];
    for (let i = 0; i < limitedHexagons.length; i++) {
        const hex = limitedHexagons[i];
        const centroid = centroids[i] || null;

        const sDemand = demandScoresArr && demandScoresArr[i] != null ? getNumericScore(demandScoresArr[i]) : null;
        const sPoi = poiScoresArr && poiScoresArr[i] != null ? getNumericScore(poiScoresArr[i]) : null;
        const sRisk = riskScoresArr && riskScoresArr[i] != null ? getNumericScore(riskScoresArr[i]) : null;
        const sZoning = zoningScoresArr && zoningScoresArr[i] != null ? getNumericScore(zoningScoresArr[i]) : null;
        const sAccess = accessibilityScoresArr && accessibilityScoresArr[i] != null ? getNumericScore(accessibilityScoresArr[i]) : null;

            const a = (sDemand == null) ? 0 : sDemand;
            const b = (sPoi == null) ? 0 : sPoi;
            const c = (sRisk == null) ? 0 : sRisk;
            const d = (sZoning == null) ? 0 : sZoning;
            const e = (sAccess == null) ? 0 : sAccess;

            // include each controller's score in the output item
            const demandScoreNum = (sDemand == null) ? null : Number(sDemand);
            const poiScoreNum = (sPoi == null) ? null : Number(sPoi);
            const riskScoreNum = (sRisk == null) ? null : Number(sRisk);
            const zoningScoreNum = (sZoning == null) ? null : Number(sZoning);
            const accessibilityScoreNum = (sAccess == null) ? null : Number(sAccess);

            const finalScore = (a + b + c + d + e);

            out.push({
                hexagon: hex,
                centroid,
                demandScore: demandScoreNum,
                poiScore: poiScoreNum,
                riskScore: riskScoreNum,
                zoningScore: zoningScoreNum,
                accessibilityScore: accessibilityScoreNum,
                finalScore: Number(finalScore.toFixed(2))
            });
    }

    return out;
}

module.exports = { runWorkflow };
