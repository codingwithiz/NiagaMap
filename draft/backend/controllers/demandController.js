const catchmentService = require('../services/catchmentService');
const demandService = require('../services/demandService');

// small local helper to compute centroid for a single ring [[lon,lat],...]
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

/**
 * Controller to compute demand scores for provided hexagons.
 * opts: { hexagons, radius, category, token, maxCount, returnResponses }
 * If `hexagons` is not provided, this controller will generate them using center_x/center_y/radius and category settings.
 */
async function runDemand(opts = {}) {
    const { settings, hexagons, radius = 200, token, } = opts;


    if (!Array.isArray(hexagons) || hexagons.length === 0) {
        throw new Error('`hexagons` must be provided as an array of rings to compute demand (generation is handled by workflow)');
    }
   
    // Fetch population values for hexagons
    const { pops_array, rawResponses } = await demandService.fetchPopulationsForHexagons(hexagons, token, { country: settings.country, dataCollections: settings.dataCollections, retry: settings.retry, delayMs: settings.delayMs });
   
    // Calculate demand scores
    const demandScores = demandService.calculateDemandScore(
        pops_array,
        radius,
        settings.demand_threshold
    );

    // const centroids = limitedHexagons.map(h => polygonCentroid(h));

    try {
        await demandService.saveDemandScoresToDatabase(
            hexagons,
            demandScores,
            pops_array
        );
    }
    catch (error) {
        console.error('Error saving demand scores to database:', error);
    }

    return {
        // hexagons: limitedHexagons,
        // centroids,
        pops: pops_array,
        numberOfHexagons: hexagons.length,
        // rawResponses: rawResponses,
        demandScore: demandScores,
        settings: settings,
    };
}

module.exports = { runDemand };
