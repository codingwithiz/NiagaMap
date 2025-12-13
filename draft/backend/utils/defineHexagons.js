/**
 * Generate hexagon coordinates within a given radius from center
 * Hexagons are flat-topped and properly tessellated (no overlapping)
 */
function generateHexagonsCoordinates(center_x, center_y, radiusMeters, sideLengthMeters) {
    // Convert meters to degrees (approximate for small areas)
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLon = 111320 * Math.cos(center_y * Math.PI / 180);
    
    const sideLength = sideLengthMeters / metersPerDegreeLon;
    
    // For flat-topped hexagons:
    const hexWidth = 2 * sideLength;
    const hexHeight = Math.sqrt(3) * sideLength;
    
    // Horizontal spacing between hex centers
    const horizSpacing = hexWidth * 0.75;
    const vertSpacing = hexHeight;
    
    const radiusLon = radiusMeters / metersPerDegreeLon;
    const radiusLat = radiusMeters / metersPerDegreeLat;
    
    const hexagons = [];
    
    const maxCols = Math.ceil(radiusLon / horizSpacing) + 1;
    const maxRows = Math.ceil(radiusLat / vertSpacing) + 1;
    
    for (let col = -maxCols; col <= maxCols; col++) {
        for (let row = -maxRows; row <= maxRows; row++) {
            const hexCenterX = center_x + col * horizSpacing;
            const yOffset = (col % 2 === 0) ? 0 : vertSpacing / 2;
            const hexCenterY = center_y + row * vertSpacing + yOffset;
            
            const distX = (hexCenterX - center_x) * metersPerDegreeLon;
            const distY = (hexCenterY - center_y) * metersPerDegreeLat;
            const distance = Math.sqrt(distX * distX + distY * distY);
            
            if (distance <= radiusMeters) {
                const hexCoords = createFlatTopHexagon(hexCenterX, hexCenterY, sideLength);
                hexagons.push(hexCoords);
            }
        }
    }
    
    return hexagons;
}

function createFlatTopHexagon(cx, cy, sideLength) {
    const coords = [];
    
    for (let i = 0; i < 6; i++) {
        const angleDeg = 60 * i;
        const angleRad = (Math.PI / 180) * angleDeg;
        
        const x = cx + sideLength * Math.cos(angleRad);
        const y = cy + sideLength * Math.sin(angleRad);
        
        coords.push([
            Math.round(x * 1000000) / 1000000,
            Math.round(y * 1000000) / 1000000
        ]);
    }
    
    coords.push(coords[0].slice());
    
    return coords;
}

/**
 * Enrich a single hexagon polygon (rings) using ArcGIS GeoEnrichment REST API
 * Returns the parsed JSON response.
 *
 * @param {Array<Array<number>>} rings - array of [lon, lat] pairs representing polygon vertices
 * @param {string} token - ArcGIS access token
 * @param {Object} [opts] - optional settings: {country: 'MY', dataCollections: ['KeyFacts']}
 */
async function fetchGeoEnrichmentForHex(rings, token, opts = {}) {
    const country = opts.country || 'MY';
    const dataCollections = opts.dataCollections || ['KeyFacts'];

    // Ensure the ring is closed (first point repeated at the end)
    const closed = rings.length > 0 && (rings[0][0] === rings[rings.length - 1][0] && rings[0][1] === rings[rings.length - 1][1])
        ? rings
        : rings.concat([rings[0]]);

    const wkid = opts.wkid || 4326;

    // Use axios via shared API helper
    const arcgisApi = require('../api/arcgisApi');
    return arcgisApi.enrichPolygon(closed, token, { country, dataCollections, wkid });
}

/**
 * Extract TOTPOP_CY value from a GeoEnrichment response object.
 * The API response shape may vary; this performs a shallow search for the key name.
 * Returns number or null if not found.
 */
function extractTOTPOP_CY(responseJson) {
    if (!responseJson) return null;

    // Common path: results[0].value.FeatureSet.features[0].attributes.TOTPOP_CY
    try {
        if (responseJson.results && Array.isArray(responseJson.results)) {
            for (const r of responseJson.results) {
                // r.value.FeatureSet.features
                const value = r.value || r;
                if (value && value.FeatureSet && Array.isArray(value.FeatureSet.features) && value.FeatureSet.features.length) {
                    const attr = value.FeatureSet.features[0].attributes || {};
                    if (attr.TOTPOP_CY !== undefined) return attr.TOTPOP_CY;
                }

                // Some outputs use 'value' with attributes directly
                if (value && value.attributes && value.attributes.TOTPOP_CY !== undefined) {
                    return value.attributes.TOTPOP_CY;
                }
            }
        }
    } catch (e) {
        // fall through to generic search
    }

    // Generic traversal to find first key named TOTPOP_CY
    const stack = [responseJson];
    while (stack.length) {
        const node = stack.pop();
        if (node && typeof node === 'object') {
            if (Object.prototype.hasOwnProperty.call(node, 'TOTPOP_CY')) {
                return node.TOTPOP_CY;
            }
            for (const k of Object.keys(node)) {
                const v = node[k];
                if (v && typeof v === 'object') stack.push(v);
            }
        }
    }

    return null;
}

/**
 * Enrich all hexagons sequentially and return an array of population values (or null when missing).
 * Options: { token, country, dataCollections, retry = 2, delayMs = 250 }
 */
async function enrichHexagons(hexagonArray, options = {}) {
    const token = options.token;
    const retry = options.retry == null ? 2 : options.retry;
    const delayMs = options.delayMs == null ? 250 : options.delayMs;
    const maxCount = options.maxCount == null ? hexagonArray.length : Math.max(0, Math.floor(options.maxCount));
    const out = [];

    console.log(`Starting enrichHexagons for ${Math.min(hexagonArray.length, maxCount)} hexagons`);

    for (let idx = 0; idx < Math.min(hexagonArray.length, maxCount); idx++) {
        const hexObj = hexagonArray[idx];
        
        // Handle both formats: hex object with coordinates property, or raw coordinates array
        const hex = hexObj.coordinates || hexObj;
        
        if (!Array.isArray(hex)) {
            console.error(`Hexagon ${idx} has invalid format:`, hexObj);
            out.push({ pop: null, response: null, hex_id: hexObj?.hex_id || null });
            continue;
        }

        // Ensure format: array of [lon, lat] pairs
        const rings = hex.map(p => [Number(p[0]), Number(p[1])]);

        let attempt = 0;
        let lastErr = null;
        while (attempt <= retry) {
            try {
                const resp = await fetchGeoEnrichmentForHex(rings, token, { 
                    country: options.country, 
                    dataCollections: options.dataCollections 
                });
                const pop = extractTOTPOP_CY(resp);
                
                console.log(`Enriched hexagon ${idx + 1}/${hexagonArray.length}: TOTPOP_CY = ${pop}`);
                
                out.push({
                    pop: pop,
                    response: resp,
                    hex_id: hexObj.hex_id || null,
                });
                break;
            } catch (err) {
                lastErr = err;
                attempt++;
                console.error(`Error enriching hexagon ${idx}, attempt ${attempt}:`, err.message);
                if (attempt > retry) {
                    // give up for this hexagon and push null
                    out.push({ pop: null, response: null, hex_id: hexObj?.hex_id || null });
                } else {
                    // wait before retry
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
        }
        // Small pause to avoid hitting rate limits
        await new Promise(r => setTimeout(r, delayMs));
    }

    return out;
}

module.exports = {
    generateHexagonsCoordinates,
    createFlatTopHexagon,
    fetchGeoEnrichmentForHex,
    extractTOTPOP_CY,
    enrichHexagons
};