const axios = require('axios');

/**
 * Compute centroid for a polygon represented as [[lon,lat],...]
 */
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

function hexAreaMeters2(sideMeters) {
    // Regular hexagon area = (3 * sqrt(3) / 2) * a^2
    const a = Number(sideMeters) || 0;
    return (3 * Math.sqrt(3) / 2) * a * a;
}

/**
 * Query BANJIR FeatureServer for features intersecting polygon. Sum area_ha values.
 * Returns { floodAreaHa, features: [...], rawResponse }
 */
async function queryFloodAreaForPolygon(polygonRings, token, opts = {}) {
    const defaultUrl = process.env.BANJIR_FEATURE_URL || 'https://gisdev.planmalaysia.gov.my/server/rest/services/Hosted/BANJIR/FeatureServer';
    const featureServiceUrl = (opts.featureServiceUrl || defaultUrl).replace(/\/+$/,'');
    const layerUrl = featureServiceUrl + '/0/query';

    const polygonGeom = { rings: [polygonRings], spatialReference: { wkid: 4326 } };
    const params = new URLSearchParams();
    params.append('geometry', JSON.stringify(polygonGeom));
    params.append('geometryType', 'esriGeometryPolygon');
    params.append('spatialRel', 'esriSpatialRelIntersects');
    params.append('inSR', '4326');
    // request area_ha and any identifying fields
    params.append('outFields', 'area_ha,fid,rbmu_label,state,f_code');
    params.append('f', 'json');
    if (token) params.append('token', token);

    try {
        const res = await axios.post(layerUrl, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
        const data = res.data;
        let totalAreaHa = 0;
        if (data && Array.isArray(data.features) && data.features.length) {
            for (const feat of data.features) {
                const a = feat.attributes && (feat.attributes.area_ha || feat.attributes.Area_Ha || feat.attributes.area || 0);
                const v = Number(a) || 0;
                totalAreaHa += v;
            }
        }
        return { floodAreaHa: totalAreaHa, features: data && data.features ? data.features : [], rawResponse: data };
    } catch (err) {
        return { floodAreaHa: null, features: [], rawResponse: (err && err.response && err.response.data) ? err.response.data : { error: String(err) } };
    }
}

/**
 * Compute flood/risk scores for hexagons.
 * hexagons: array of rings [[lon,lat],...]
 * category: used to pick threshold from opts or category settings
 * opts: { sideLengthMeters, thresholdHa, featureServiceUrl, delayMs }
 * Returns array of { centroid, floodAreaHa, hexAreaHa, ratio, score, rawResponse }
 */
async function computeFloodRiskScores(hexagons = [], category = '', token = null, opts = {}) {
    const sideLengthMeters = Number(opts.sideLengthMeters) || 100; // fallback
    const thresholdHa = Number.isFinite(Number(opts.thresholdHa)) ? Number(opts.thresholdHa) : 1;
    const delayMs = Number.isFinite(Number(opts.delayMs)) ? Number(opts.delayMs) : 200;

    const hexArea_m2 = hexAreaMeters2(sideLengthMeters);
    const hexAreaHa = hexArea_m2 / 10000.0;

    const out = [];

    for (let i = 0; i < hexagons.length; i++) {
        const hex = hexagons[i];
        const centroid = polygonCentroid(hex) || { lon: null, lat: null };
        let floodAreaHa = null;
        let rawResponse = null;

        if (centroid.lon != null && centroid.lat != null) {
            const q = await queryFloodAreaForPolygon(hex, token, { featureServiceUrl: opts.featureServiceUrl });
            floodAreaHa = (q && Number.isFinite(Number(q.floodAreaHa))) ? Number(q.floodAreaHa) : (q && q.floodAreaHa === 0 ? 0 : null);
            rawResponse = q && q.rawResponse ? q.rawResponse : null;
            // throttle
            await new Promise(r => setTimeout(r, delayMs));
        }

        // scoring: ratio = min(floodAreaHa / thresholdHa, 1) ; score = 20 * ratio
        let ratio = null;
        let score = null;
        if (floodAreaHa == null) {
            score = null; // error / unknown
        } else {
            ratio = thresholdHa > 0 ? Math.min(floodAreaHa / thresholdHa, 1) : 0;
            score = 20 * ratio;
        }

        out.push({ centroid, floodAreaHa, hexAreaHa, ratio, score, rawResponse });
    }

    return out;
}

module.exports = { computeFloodRiskScores };
