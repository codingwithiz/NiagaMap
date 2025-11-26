const axios = require('axios');

/**
 * Compute centroid for a polygon represented as [[lon,lat],...]
 * Handles closed rings (last point same as first).
 */
function polygonCentroid(ring) {
    if (!Array.isArray(ring) || ring.length === 0) return null;
    // remove possible closing point if equal to first
    const last = ring[ring.length - 1];
    const first = ring[0];
    const pts = (last && first && last[0] === first[0] && last[1] === first[1]) ? ring.slice(0, -1) : ring.slice();

    let sumX = 0, sumY = 0;
    for (const p of pts) {
        const lon = Number(p[0]);
        const lat = Number(p[1]);
        sumX += lon;
        sumY += lat;
    }
    const n = pts.length || 1;
    return { lon: sumX / n, lat: sumY / n };
}

/**
 * Call ArcGIS Route solve endpoint to obtain distance to nearest road.
 * Note: the Route service typically expects routes between two or more stops.
 * Here we submit a single stop and attempt to parse any returned route distance.
 * If the service doesn't return a distance, null is returned.
 */
/**
 * Query a FeatureServer layer for features that intersect the given polygon rings.
 * If none are found, do a buffered search around the centroid using `distance` (meters).
 * Returns { distanceMeters, rawResponse }
 */
async function queryNearestFacilityDistance(polygonRings, centroid, token, opts = {}) {
    // feature service URL can be provided via opts or environment
    const defaultUrl = process.env.FACILITIES_FEATURE_URL || 'https://services6.arcgis.com/MpOjf90wsc96wTq1/ArcGIS/rest/services/Public_Facilities_WFL1/FeatureServer';
    const featureServiceUrl = (opts.featureServiceUrl || defaultUrl).replace(/\/+$/,'');
    const layerUrl = featureServiceUrl + '/0/query';

    // First try: query by polygon intersection
    const polygonGeom = { rings: [polygonRings], spatialReference: { wkid: 4326 } };

    const params = new URLSearchParams();
    params.append('geometry', JSON.stringify(polygonGeom));
    params.append('geometryType', 'esriGeometryPolygon');
    params.append('spatialRel', 'esriSpatialRelIntersects');
    params.append('inSR', '4326');
    params.append('outFields', '*');
    params.append('f', 'json');
    if (token) params.append('token', token);

    try {
        const res = await axios.post(layerUrl, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
        const data = res.data;
        if (data && Array.isArray(data.features) && data.features.length) {
            // compute nearest distance from centroid to returned features and remember the nearest feature
            let min = null;
            let nearestFeat = null;
            let nearestLon = null;
            let nearestLat = null;
            for (const feat of data.features) {
                const g = feat.geometry || {};
                let fx = null, fy = null;
                if (g.x !== undefined && g.y !== undefined) { fx = Number(g.x); fy = Number(g.y); }
                else if (Array.isArray(g.points) && g.points.length) { fx = Number(g.points[0][0]); fy = Number(g.points[0][1]); }
                if (fx == null || fy == null) continue;

                // preserve original geometry before mutating
                const originalGeom = g ? JSON.parse(JSON.stringify(g)) : null;

                // If feature geometry has spatialReference in Web Mercator (3857 / 102100), convert to lon/lat
                const sr = (g.spatialReference && (g.spatialReference.wkid || g.spatialReference.latestWkid)) || null;
                let featLon = fx, featLat = fy;
                const isLikelyMercator = (sr === 3857 || sr === 102100 || sr === 102113) || (!sr && (Math.abs(fx) > 1000 || Math.abs(fy) > 1000));
                if (isLikelyMercator) {
                    const conv = webMercatorToLonLat(fx, fy);
                    featLon = conv.lon; featLat = conv.lat;
                }

                // Replace the feature geometry with converted WGS84 coordinates (x=lon, y=lat, sr=4326)
                feat.geometry = { x: featLon, y: featLat, spatialReference: { wkid: 4326 } };

                const d = haversineDistanceMeters(centroid.lat, centroid.lon, featLat, featLon);
                if (min == null || d < min) {
                    min = d;
                    nearestFeat = feat;
                    nearestLon = featLon;
                    nearestLat = featLat;
                    // store original geometry for nearest feature
                    var nearestOriginalGeom = originalGeom;
                }
            }

            // Attach nearest facility normalized geometry into returned rawResponse for easy inspection
            const out = Object.assign({}, data);
            if (nearestFeat) {
                out.nearestFacility = {
                    attributes: nearestFeat.attributes || null,
                    geometry: {
                        lon: nearestLon,
                        lat: nearestLat,
                        original: nearestOriginalGeom || null
                    }
                };
            }

            return { distanceMeters: min, rawResponse: out };
        }
        // If none found, fall through to buffered search
    } catch (err) {
        // keep going to buffered search, but capture error as rawResponse if needed
        // continue
    }

    // Buffered search around centroid using distance (opts.buffer or default 1000m)
    const buffer = Number.isFinite(Number(opts.buffer)) ? Number(opts.buffer) : (Number.isFinite(Number(opts.threshold)) ? Number(opts.threshold) : 1000);
    const bufParams = new URLSearchParams();
    const pointGeom = { x: Number(centroid.lon), y: Number(centroid.lat), spatialReference: { wkid: 4326 } };
    bufParams.append('geometry', JSON.stringify(pointGeom));
    bufParams.append('geometryType', 'esriGeometryPoint');
    bufParams.append('distance', String(buffer));
    bufParams.append('units', 'esriSRUnit_Meter');
    bufParams.append('spatialRel', 'esriSpatialRelIntersects');
    bufParams.append('outFields', '*');
    bufParams.append('f', 'json');
    if (token) bufParams.append('token', token);

    try {
        const res2 = await axios.post(layerUrl, bufParams.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
        const data2 = res2.data;
        if (data2 && Array.isArray(data2.features) && data2.features.length) {
            let min2 = null;
            let nearestFeat2 = null;
            let nearestLon2 = null;
            let nearestLat2 = null;
            for (const feat of data2.features) {
                const g = feat.geometry || {};
                let fx = null, fy = null;
                if (g.x !== undefined && g.y !== undefined) { fx = Number(g.x); fy = Number(g.y); }
                else if (Array.isArray(g.points) && g.points.length) { fx = Number(g.points[0][0]); fy = Number(g.points[0][1]); }
                if (fx == null || fy == null) continue;

                // preserve original geometry before mutating
                const originalGeom2 = g ? JSON.parse(JSON.stringify(g)) : null;

                const sr = (g.spatialReference && (g.spatialReference.wkid || g.spatialReference.latestWkid)) || null;
                let featLon = fx, featLat = fy;
                const isLikelyMercator = (sr === 3857 || sr === 102100 || sr === 102113) || (!sr && (Math.abs(fx) > 1000 || Math.abs(fy) > 1000));
                if (isLikelyMercator) {
                    const conv = webMercatorToLonLat(fx, fy);
                    featLon = conv.lon; featLat = conv.lat;
                }

                // Replace the feature geometry with converted WGS84 coordinates (x=lon, y=lat, sr=4326)
                feat.geometry = { x: featLon, y: featLat, spatialReference: { wkid: 4326 } };

                const d = haversineDistanceMeters(centroid.lat, centroid.lon, featLat, featLon);
                if (min2 == null || d < min2) {
                    min2 = d;
                    nearestFeat2 = feat;
                    nearestLon2 = featLon;
                    nearestLat2 = featLat;
                    // store original geometry for nearest feature
                    var nearestOriginalGeom2 = originalGeom2;
                }
            }

            const out2 = Object.assign({}, data2);
            if (nearestFeat2) {
                out2.nearestFacility = {
                    attributes: nearestFeat2.attributes || null,
                    geometry: {
                        lon: nearestLon2,
                        lat: nearestLat2,
                        original: nearestOriginalGeom2 || null
                    }
                };
            }

            return { distanceMeters: min2, rawResponse: out2 };
        }
        return { distanceMeters: null, rawResponse: data2 };
    } catch (err2) {
        return { distanceMeters: null, rawResponse: (err2 && err2.response && err2.response.data) ? err2.response.data : { error: String(err2) } };
    }
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meters
    const toRad = v => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Convert Web Mercator (EPSG:3857 / 102100) x,y in meters to lon/lat in degrees (WGS84)
 */
function webMercatorToLonLat(x, y) {
    const R = 6378137.0;
    const lon = (x / R) * (180 / Math.PI);
    const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
    return { lon: Number(lon), lat: Number(lat) };
}

/**
 * Given an array of hexagon rings (each ring = [[lon,lat],...]), compute accessibility scores.
 * Returns an array of scores in same order. Each element is { centroid: {lon,lat}, distanceMeters, score }
 * Formula used: score = 20 * (1 - MIN(distanceMeters / threshold, 1))
 */
async function computeAccessibilityScores(hexagons = [], token = null, opts = {}) {
    const threshold = Number.isFinite(Number(opts.threshold)) ? Number(opts.threshold) : 400; // meters
    const delayMs = Number.isFinite(Number(opts.delayMs)) ? Number(opts.delayMs) : 250;

    const out = [];

    for (let i = 0; i < hexagons.length; i++) {
        const hex = hexagons[i];
        const centroid = polygonCentroid(hex) || { lon: null, lat: null };
        let distanceMeters = null;
        let rawResponse = null;

        if (centroid.lon != null && centroid.lat != null) {
            const q = await queryNearestFacilityDistance(
                hex,
                centroid,
                token,
                { threshold, buffer: opts.buffer, featureServiceUrl: opts.featureServiceUrl }
            );

            distanceMeters = q && Number.isFinite(Number(q.distanceMeters)) ? Number(q.distanceMeters) : null;
            rawResponse = q && q.rawResponse ? q.rawResponse : null;
            // small pause to avoid rate limiting
            await new Promise(r => setTimeout(r, delayMs));
        }

        let score = null;
        
        // If query returned a valid rawResponse with zero features, treat as 'no facility' and set score 0
        if (rawResponse && Array.isArray(rawResponse.features) && rawResponse.features.length === 0) {
                score = 0;
        }
        else {
            const ratio = Math.min(distanceMeters / threshold, 1);
            score = 20 * (1 - ratio);
        }

        out.push({ centroid, distanceMeters, score, rawResponse });
    }

    return out;
}

module.exports = { computeAccessibilityScores };
