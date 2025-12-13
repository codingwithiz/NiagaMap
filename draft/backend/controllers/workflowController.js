const catchmentService = require('../services/catchmentService');
const referencePointService = require('../services/referencePointService');
const analysisService = require('../services/analysisService');
const recommendedLocationService = require('../services/recommendedLocationService');
const conversationService = require('../services/conversationService');
const catchmentController = require('./catchmentController');
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
    const {
        radius,
        center_x,
        center_y,
        locationName,
        category,
        token = null,
        maxCount = null,  // Keep as null by default - will generate all hexagons
        chat_id = null,
        user_id = null,
        weights = null,
    } = opts;

    if (!category) {
        throw new Error("category is required for workflow");
    } else if (
        ![radius, center_x, center_y].every((n) => Number.isFinite(Number(n)))
    ) {
        throw new Error("radius, center_x and center_y must be numeric");
    } else if (!token) {
        throw new Error(
            "token is required for workflow (some controllers need it)"
        );
    }
    // Remove the strict validation for maxCount - allow null/undefined
    // Only validate if maxCount is explicitly provided
    if (maxCount != null && maxCount !== undefined) {
        if (!Number.isFinite(Number(maxCount)) || maxCount < 0 || !Number.isInteger(Number(maxCount))) {
            throw new Error("maxCount must be a non-negative integer if provided");
        }
    } else if (
        !Number.isFinite(Number(center_x)) ||
        !Number.isFinite(Number(center_y))
    ) {
        throw new Error("center_x and center_y must be numeric");
    }

    console.log('Workflow params received:', { user_id, chat_id, radius, center_x, center_y }); // Add logging

    // 1. create reference point record
    const referencePoint = await referencePointService.createReferencePoint({
        name: locationName,
        lat: center_y,
        lon: center_x,
    });

    console.log('Created reference point:', referencePoint); // Add logging

    // 2. create new analysis record with user_id and chat_id
    const newAnalysis = await analysisService.createAnalysis({
        userId: user_id,              // Pass user_id
        referencePointId: referencePoint.point_id,
        chatId: chat_id || null,      // Pass chat_id
    });

    console.log('Created analysis:', newAnalysis); // Add logging

    const newAnalysisId = newAnalysis.analysis_id;
    // const settings = catchmentService.getSettingsForCategory(category);
    // const hexagons = catchmentService.generateCatchmentHexagons(center_x, center_y, radius, settings.sideLength);
    // const limitedHexagons = (maxCount && Number.isFinite(Number(maxCount))) ? hexagons.slice(0, Number(maxCount)) : hexagons;

    // 3. generate hexagons via catchment controller
    const hexCatchmentRes = await catchmentController.runCatchment({
        radius,
        center_x,
        center_y,
        category,
        maxCount,
        analysisId: newAnalysisId,
    });
    const settings = hexCatchmentRes.settings;
    const hexagons = hexCatchmentRes.hexagons;
    // centroids for output
    console.log("settings", settings);

    const centroids = hexagons.map((h) => polygonCentroid(h.coordinates));
    // Run all controllers in parallel where possible
    // demand and poi require token; risk will generate its own server token
    const demandPromise = demandController.runDemand({
        settings: settings,
        hexagons: hexagons, //3d,
        radius,
        token,
        maxCount,
        returnResponses: false,
        analysisId: newAnalysisId,
    });
    const poiPromise = poiController.runPOIScoring({
        hexagons: hexagons, //3d,
        category,
        token,
        maxCount,
        analysisId: newAnalysisId,
    });
    const riskPromise = riskController.runRiskAnalysis({
        hexagons: hexagons,
        category,
        maxCount,
        riskRatio: settings.riskRatio,
        analysisId: newAnalysisId,
    });
    const zoningPromise = zoningController.runZoning({
        hexagons: hexagons,
        category,
        maxCount,
        analysisId: newAnalysisId,
    });
    const accessibilityPromise = accessibilityController.runAccessibility({
        hexagons: hexagons,
        category,
        token,
        maxCount,
        analysisId: newAnalysisId,
    });

    const [demandRes, poiRes, riskRes, zoningRes, accessibilityRes] =
        await Promise.allSettled([
            demandPromise,
            poiPromise,
            riskPromise,
            zoningPromise,
            accessibilityPromise,
        ]);

    console.log("demandRes:", demandRes);
    console.log("poiRes:", poiRes);
    console.log("riskRes:", riskRes);
    console.log("zoningRes:", zoningRes);
    console.log("accessibilityRes:", accessibilityRes);
    // Helper to convert settled result to array or null
    const extractResultArray = (settled, keyFallback) => {
        if (!settled) return null;
        if (settled.status === "fulfilled") {
            const val = settled.value;
            if (!val) return null;
            // try common keys
            if (Array.isArray(val.demandScore)) return val.demandScore;
            if (Array.isArray(val.scores)) return val.scores;
            if (Array.isArray(val.counts)) return val.counts;
            if (Array.isArray(val.pops)) return val.pops;
            // fallback to keyFallback if provided
            if (keyFallback && Array.isArray(val[keyFallback]))
                return val[keyFallback];
            return null;
        } else {
            console.error(
                "Workflow: controller failed",
                settled.reason || settled
            );
            return null;
        }
    };

    const demandScoresArr = extractResultArray(demandRes, "demandScore");
    const poiScoresArr = extractResultArray(poiRes, "scores");
    const riskScoresArr = extractResultArray(riskRes, "scores");
    const zoningScoresArr = extractResultArray(zoningRes, "scores");
    const accessibilityScoresArr = extractResultArray(
        accessibilityRes,
        "scores"
    );

    // Build output list: for each hexagon, extract numeric scores (or treat missing as 0), sum and divide by 5
    const out = [];
    for (let i = 0; i < hexagons.length; i++) {
        const hex = hexagons[i];
        const centroid = centroids[i] || null;

        const sDemand =
            demandScoresArr && demandScoresArr[i] != null
                ? getNumericScore(demandScoresArr[i])
                : null;
        const sPoi =
            poiScoresArr && poiScoresArr[i] != null
                ? getNumericScore(poiScoresArr[i])
                : null;
        const sRisk =
            riskScoresArr && riskScoresArr[i] != null
                ? getNumericScore(riskScoresArr[i])
                : null;
        const sZoning =
            zoningScoresArr && zoningScoresArr[i] != null
                ? getNumericScore(zoningScoresArr[i])
                : null;
        const sAccess =
            accessibilityScoresArr && accessibilityScoresArr[i] != null
                ? getNumericScore(accessibilityScoresArr[i])
                : null;

        // Default weights if not provided
        const w = weights || { demand: 20, poi: 20, risk: 20, accessibility: 20, zoning: 20 };
        const totalWeight = (w.demand || 0) + (w.poi || 0) + (w.risk || 0) + (w.accessibility || 0) + (w.zoning || 0) || 1;

        const finalScore =
            ((sDemand ?? 0) * (w.demand || 0) +
            (sPoi ?? 0) * (w.poi || 0) +
            (sRisk ?? 0) * (w.risk || 0) +
            (sZoning ?? 0) * (w.zoning || 0) +
            (sAccess ?? 0) * (w.accessibility || 0)) / totalWeight;

        // Extract detailed risk data
        const riskDetails = riskScoresArr?.[i] || {};
        const riskRaw = {
            floodAreaHa: riskDetails.floodAreaHa || 0,
            landslideCount: riskDetails.landslideCount || 0,
            hasLandslide: riskDetails.hasLandslide || false,
            totalScore: sRisk // Total risk score
        };

        // Extract other raw data
        const demandRaw = demandRes.value?.pops?.[i] || 0;
        const poiRaw = poiRes.value?.counts?.[i] || 0;
        const accessibilityRaw = {
            distanceMeters: accessibilityScoresArr?.[i]?.distanceMeters || 0
        };
        const zoningRaw = {
            landuse: zoningScoresArr?.[i]?.landuse || null,
            rawResponse: zoningScoresArr?.[i]?.rawResponse || null
        };

        out.push({
            hexagon: hex,
            centroid,
            demandScore: sDemand,
            poiScore: sPoi,
            riskScore: sRisk,
            zoningScore: sZoning,
            accessibilityScore: sAccess,
            // Store raw data for detailed analysis
            demandRaw: demandRaw,
            poiRaw: poiRaw,
            riskRaw: riskRaw,
            zoningRaw: zoningRaw,
            accessibilityRaw: accessibilityRaw,
            finalScore: Number(finalScore.toFixed(2)),
        });
    }

    //sort the locations by finalScore in descending order
    out.sort((a, b) => b.finalScore - a.finalScore);

    // 4. save the top 3 recommended locations by analysis id
    if (out.length > 0) {
        const topLocations = out.slice(0, 3); // Get top 3 locations
        try {
            for (const location of topLocations) {
                const centroid = location.centroid || { lat: center_y, lon: center_x };

                // Build detailed breakdown object with both scores and raw data
                const breakdown = {
                    demand: {
                        score: location.demandScore,
                        population: location.demandRaw
                    },
                    poi: {
                        score: location.poiScore,
                        count: location.poiRaw
                    },
                    risk: {
                        score: location.riskScore,
                        floodAreaHa: location.riskRaw.floodAreaHa,
                        landslideCount: location.riskRaw.landslideCount,
                        hasLandslide: location.riskRaw.hasLandslide,
                        riskRatio: settings.riskRatio // Include riskRatio for reference
                    },
                    accessibility: {
                        score: location.accessibilityScore,
                        distanceMeters: location.accessibilityRaw.distanceMeters
                    },
                    zoning: {
                        score: location.zoningScore,
                        landuse: location.zoningRaw.landuse,
                        rawResponse: location.zoningRaw.rawResponse
                    }
                };

                console.log("Saving location with detailed breakdown:", {
                    analysisId: newAnalysisId,
                    lat: centroid.lat,
                    lon: centroid.lon,
                    score: location.finalScore,
                    breakdown: breakdown
                });

                await recommendedLocationService.saveRecommendedLocation(
                    newAnalysisId,
                    centroid.lat,
                    centroid.lon,
                    location.finalScore,
                    JSON.stringify(breakdown)
                );
            }
            console.log("Successfully saved top 3 recommended locations");
        } catch (error) {
            console.error(
                "Error saving recommended location to database:",
                error
            );
        }
    }

    return out;
}

module.exports = { runWorkflow };
