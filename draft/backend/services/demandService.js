const defineHex = require('../utils/defineHexagons');
const supabase = require("../supabase/supabase_client");
async function fetchPopulationsForHexagons(hexagonArray, token, options = {}) {
    // If maxCount is not provided or is null, process all hexagons
    const maxCount = options.maxCount == null ? hexagonArray.length : Math.max(0, Math.floor(options.maxCount));
    
    const opts = Object.assign({ country: 'MY', dataCollections: ['KeyFacts'], retry: 2, delayMs: 250}, options);
    const responses = await defineHex.enrichHexagons(hexagonArray, { token, country: opts.country, dataCollections: opts.dataCollections, retry: opts.retry, delayMs: opts.delayMs, maxCount});

    let pops_array = [];
    pops_array = responses.map((r) => (r.pop !== undefined ? r.pop : null));

    return { pops_array, rawResponses: responses };
}

function scaledMaxForRadius(radiusMeters, baseMaxPerKm2 = 4000) {
    const area_m2 = Math.PI * radiusMeters * radiusMeters;
    const area_km2 = area_m2 / 1e6;
    return Math.ceil(baseMaxPerKm2 * area_km2);
}

function calculateDemandScore(pops_array, radiusMeters, baseMaxPerKm2 = 4000) {
    if (!Array.isArray(pops_array)) return [];
    const scaledMax = scaledMaxForRadius(radiusMeters, baseMaxPerKm2);
    const effectiveMax = scaledMax > 0 ? scaledMax : baseMaxPerKm2;
    console.log(`Calculated effectiveMax: ${effectiveMax} for radius: ${radiusMeters}m and baseMaxPerKm2: ${baseMaxPerKm2}`);
    const out = [];
    for (let i = 0; i < pops_array.length; i++) {
        let pop = pops_array[i];
        if (pop == null) { out.push(null); continue; }
        pop = Number(pop);
        if (Number.isNaN(pop)) { out.push(null); continue; }
        if (pop === 0) { out.push(0); continue; }
        const score = 20 * (pop / (pop + effectiveMax));
        out.push(parseFloat(score.toFixed(3)));
    }
    return out;
}

async function saveDemandScoresToDatabase(hexagons, demandScores, pops_array) {
    if (
        !Array.isArray(hexagons) ||
        !Array.isArray(demandScores) ||
        hexagons.length !== demandScores.length
    ) {
        throw new Error(
            "Hexagons and demandScores must be arrays of the same length"
        );
    }

    const records = [];
    for (let i = 0; i < hexagons.length; i++) {
        const hex = hexagons[i];
        const score = demandScores[i];
        const pop = pops_array[i];

        console.log(`Preparing record for hexagon index ${i}:`, { hex, score, pop });
        if (!hex || !hex.hex_id) continue;
        
        records.push({
            hex_id: hex.hex_id,
            demand_score: Number(score) || null,
            population: pop,
        });
    }

    if (records.length === 0) {
        console.warn("No valid records to insert into demand table.");
        return [];
    }



    const { data, error } = await supabase
        .from("demand")
        .insert(records)
        .select(); // ensures inserted rows are returned

    if (error) {
        console.error("Error saving demand records:", error);
        throw error;
    }

    return data;
}

module.exports = { fetchPopulationsForHexagons, calculateDemandScore, scaledMaxForRadius, saveDemandScoresToDatabase };