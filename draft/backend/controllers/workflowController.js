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
        weightage = {}
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

    // Build output list: compute normalized component scores and apply weight fractions
    // Approach:
    // 1) Extract numeric raw scores for each metric across all hexagons
    // 2) Normalize each metric by its observed max (so values in [0,1])
    // 3) Compute weight fractions from `weightage` (normalize if they don't sum to 100)
    // 4) finalScore = sum(normalized_metric * weightFraction) * 100 (percentage-like)
    const out = [];

    // helper to build numeric arrays
    const numericArray = (arr) => {
        if (!arr) return hexagons.map(() => null);
        return hexagons.map((_, i) => {
            const v = arr[i];
            const num = getNumericScore(v);
            return num == null || Number.isNaN(num) ? null : num;
        });
    };

    const numericDemand = numericArray(demandScoresArr);
    const numericPoi = numericArray(poiScoresArr);
    const numericRisk = numericArray(riskScoresArr);
    const numericZoning = numericArray(zoningScoresArr);
    const numericAccess = numericArray(accessibilityScoresArr);

    const maxOrZero = (arr) => {
        const vals = arr.filter((v) => v != null && !Number.isNaN(v));
        if (vals.length === 0) return 0;
        return Math.max(...vals);
    };

    const maxDemand = maxOrZero(numericDemand) || 0;
    const maxPoi = maxOrZero(numericPoi) || 0;
    const maxRisk = maxOrZero(numericRisk) || 0;
    const maxZoning = maxOrZero(numericZoning) || 0;
    const maxAccess = maxOrZero(numericAccess) || 0;

    // Compute weight fractions. If provided weights sum to > 0, normalize them; otherwise use equal weights.
    const w = {
        demand: Number(weightage.demand) || 0,
        competition: Number(weightage.competition) || 0,
        risk: Number(weightage.risk) || 0,
        zoning: Number(weightage.zoning) || 0,
        accessibility: Number(weightage.accessibility) || 0,
    };
    const sumW = w.demand + w.competition + w.risk + w.zoning + w.accessibility;
    const weightFrac = sumW > 0
        ? {
              demand: w.demand / sumW,
              competition: w.competition / sumW,
              risk: w.risk / sumW,
              zoning: w.zoning / sumW,
              accessibility: w.accessibility / sumW,
          }
        : { demand: 0.2, competition: 0.2, risk: 0.2, zoning: 0.2, accessibility: 0.2 };
    console.log("Weight fractions:", weightFrac);
    // Now build per-hexagon output using normalized values and weight fractions
    for (let i = 0; i < hexagons.length; i++) {
        const hex = hexagons[i];
        const centroid = centroids[i] || null;

        const rawDemand = numericDemand[i];
        const rawPoi = numericPoi[i];
        const rawRisk = numericRisk[i];
        const rawZoning = numericZoning[i];
        const rawAccess = numericAccess[i];

        const normDemand = rawDemand != null && maxDemand > 0 ? rawDemand / maxDemand : 0;
        const normPoi = rawPoi != null && maxPoi > 0 ? rawPoi / maxPoi : 0;
        const normRisk = rawRisk != null && maxRisk > 0 ? rawRisk / maxRisk : 0;
        const normZoning = rawZoning != null && maxZoning > 0 ? rawZoning / maxZoning : 0;
        const normAccess = rawAccess != null && maxAccess > 0 ? rawAccess / maxAccess : 0;

        // Weighted contributions (each in [0,1] * weightFrac) -> multiply by 100 for percent-like score
        const a = normDemand * weightFrac.demand * 100;
        const b = normPoi * weightFrac.competition * 100;
        const c = normRisk * weightFrac.risk * 100;
        const d = normZoning * weightFrac.zoning * 100;
        const e = normAccess * weightFrac.accessibility * 100;
        console.log(`Hex ${i}: normScores D:${normDemand.toFixed(3)} P:${normPoi.toFixed(3)} R:${normRisk.toFixed(3)} Z:${normZoning.toFixed(3)} A:${normAccess.toFixed(3)} -> weighted a:${a.toFixed(2)} b:${b.toFixed(2)} c:${c.toFixed(2)} d:${d.toFixed(2)} e:${e.toFixed(2)}`);
        const finalScore = a + b + c + d + e;

        // Extract detailed risk data
        const riskDetails = riskScoresArr?.[i] || {};
        const riskRaw = {
            floodAreaHa: riskDetails.floodAreaHa || 0,
            landslideCount: riskDetails.landslideCount || 0,
            hasLandslide: riskDetails.hasLandslide || false,
            totalScore: rawRisk || 0 // raw (unweighted) risk score
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
            demandScore: a,
            poiScore: b,
            riskScore: c,
            zoningScore: d,
            accessibilityScore: e,
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

    // 4. Save all hexagon scores to the database for later retrieval
    console.log(`Saving ${out.length} hexagon scores to database...`);
    const supabase = require('../supabase/supabase_client');
    try {
        for (const hexResult of out) {
            const hexData = {
                hex_id: hexResult.hexagon.hex_id,
                demand_score: hexResult.demandScore,
                demand_raw: hexResult.demandRaw,
                poi_score: hexResult.poiScore,
                poi_raw: hexResult.poiRaw,
                risk_score: hexResult.riskScore,
                risk_raw: hexResult.riskRaw,
                accessibility_score: hexResult.accessibilityScore,
                accessibility_raw: hexResult.accessibilityRaw,
                zoning_score: hexResult.zoningScore,
                zoning_raw: hexResult.zoningRaw,
                final_score: hexResult.finalScore,
                centroid: hexResult.centroid,
            };

            const { error } = await supabase
                .from('hexagon')
                .update(hexData)
                .eq('hex_id', hexResult.hexagon.hex_id);

            if (error) {
                console.error(`Error updating hexagon ${hexResult.hexagon.hex_id}:`, error);
            }
        }
        console.log('Successfully saved all hexagon scores to database');
    } catch (error) {
        console.error('Error saving hexagon scores:', error);
    }

    // 5. save the top 3 recommended locations by analysis id
    if (out.length > 0) {
        const topLocations = out.slice(0, 3); // Get top 3 locations
        try {
            for (const location of topLocations) {
                const centroid = location.centroid || { lat: center_y, lon: center_x };

                // Build detailed breakdown object with both scores and raw data
                const breakdown = {
                    demand: {
                        score: location.demandScore,
                        population: location.demandRaw,
                    },
                    poi: {
                        score: location.poiScore,
                        count: location.poiRaw,
                    },
                    risk: {
                        score: location.riskScore,
                        floodAreaHa: location.riskRaw.floodAreaHa,
                        landslideCount: location.riskRaw.landslideCount,
                        hasLandslide: location.riskRaw.hasLandslide,
                        riskRatio: settings.risk_threshold, // Include riskRatio for reference
                    },
                    accessibility: {
                        score: location.accessibilityScore,
                        distanceMeters:
                            location.accessibilityRaw.distanceMeters,
                    },
                    zoning: {
                        score: location.zoningScore,
                        landuse: location.zoningRaw.landuse,
                        rawResponse: location.zoningRaw.rawResponse,
                    },
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
