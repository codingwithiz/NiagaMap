const placesApi = require('../api/placesApi');
const catchmentService = require('../services/catchmentService');

// Simple in-memory cache for categories
let categoriesCache = null;

function bboxFromRing(ring) {
    // ring: [[lon, lat], [lon, lat], ...]
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of ring) {
        const [x, y] = p;
        if (x < minx) minx = x;
        if (y < miny) miny = y;
        if (x > maxx) maxx = x;
        if (y > maxy) maxy = y;
    }
    return [minx, miny, maxx, maxy];
}

// Ray-casting point in polygon. polygon is array of [x,y]
function pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];

        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 0.0) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Fetch categories. If `filter` is provided, ask the ArcGIS endpoint to filter and
 * return an array of categoryIds (this matches behavior in arcgisServices.getCategories).
 * Otherwise return cached raw categories array for other uses.
 */
async function ensureCategories(token, filter = null) {
    if (!filter && categoriesCache) return categoriesCache;

    // placesApi.fetchCategories supports filter and will return either
    // raw response (no filter) or an array of ids (when filter provided).
    const res = await placesApi.fetchCategories(token, filter ? { filter } : {});

    if (filter) {
        // expecting an array of ids (or empty array)
        return Array.isArray(res) ? res : [];
    }

    // normalize into flat array of categories when no filter
    const cats = (res && res.categories) ? res.categories : [];
    categoriesCache = cats;
    return cats;
}

/**
 * Main function: for each hexagon ring, query places within its bbox, filter points inside polygon,
 * and return counts in the same order as hexagons.
 * 
 * @param {Array} hexagonRings - array of rings, each ring is [[lon,lat], ...]
 * @param {string} token - ArcGIS Places API token (Bearer)
 * @param {Object} options - { categoryName, categoryIds, limitPerQuery }
 */
async function fetchPOICountsForHexagons(hexagonRings, token, options = {}) {
    if (!Array.isArray(hexagonRings)) throw new Error('hexagonRings must be an array');
    if (!token) throw new Error('Places API token required');

    const { categoryName = null, categoryIds = null, limitPerQuery = 100 } = options;

    // prepare category ids
    let ids = categoryIds;
    if (!ids && categoryName) {
        // ask ArcGIS to return category ids for this filter (matches arcgisServices.getCategories)
        const matched = await ensureCategories(token, categoryName);
        // console.log('[poiService] fetchPOICountsForHexagons -> matched category ids for', categoryName, ':', matched);
        if (matched && matched.length) ids = matched;
    }

    const counts = [];

    for (const ring of hexagonRings) {
        const extent = bboxFromRing(ring);
        let data;
        try {
            console.log('[poiService] fetchPOICountsForHexagons -> querying extent', extent, 'with categoryIds:', ids);
            data = await placesApi.queryWithinExtent(extent, ids, token, { limit: limitPerQuery });
            console.log('[poiService] fetchPOICountsForHexagons -> data for extent', extent, ':', data);
        } catch (err) {
            console.error('[poiService] fetchPOICountsForHexagons -> error querying extent', extent, ':', err);
            // on error, push 0 and continue
            counts.push(0);
            continue;
        }

        // places response may contain results or features; handle both
        const results = data && (data.results || data.features || []);
        // Each result typically has geometry.x, geometry.y or location
        const points = [];
        for (const r of results) {
            if (r.location && r.location.x !== undefined && r.location.y !== undefined) {
                points.push([r.location.x, r.location.y]);
            } else if (r.geometry && r.geometry.x !== undefined && r.geometry.y !== undefined) {
                points.push([r.geometry.x, r.geometry.y]);
            } else if (r.attributes && r.attributes.x !== undefined && r.attributes.y !== undefined) {
                points.push([r.attributes.x, r.attributes.y]);
            }
        }

        // filter by inside polygon
        let insideCount = 0;
        for (const pt of points) {
            if (pointInPolygon(pt, ring)) insideCount++;
        }

        counts.push(insideCount);
    }

    // Log counts for debugging / visibility
    try {
        console.log('[poiService] fetchPOICountsForHexagons -> counts:', counts);
    } catch (e) {
        // ignore logging errors
    }

    return counts;
}

/**
 * Calculate scores using category-specific max_competitors from catchmentService.CATEGORY_MAP
 * @param {number[]} counts
 * @param {string} category - category key matching catchmentService (e.g., 'FnB', 'Retail')
 */
function calculateScoresFromCounts(counts, category = 'default') {
    // Get settings for the category and fall back
    let settings;
    try {
        settings = catchmentService.getSettingsForCategory(category);
    } catch (e) {
        settings = null;
    }

    const maxCompetitors = (settings && settings.max_competitors) ? settings.max_competitors : 4;

    const scores = counts.map(p => {
        const m = Math.min(p / maxCompetitors, 1);
        return 20 * (1 - m);
    });
    try {
        console.log('[poiService] calculateScoresFromCounts -> category:', category, 'maxCompetitors:', maxCompetitors, 'counts:', counts, 'scores:', scores);
    } catch (e) {
        // ignore
    }
    return scores;
}

module.exports = { fetchPOICountsForHexagons, calculateScoresFromCounts };
