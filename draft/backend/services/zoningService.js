const axios = require('axios');

/**
 * Simple polygon centroid for ring [[lon,lat],...]
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

function normalize(s) {
    if (s == null) return '';
    return String(s).trim().toLowerCase();
}

function pickLanduseFromAttributes(attrs) {
    if (!attrs || typeof attrs !== 'object') return null;
    const keys = Object.keys(attrs || {});
    const lowerKeys = keys.map(k => k.toLowerCase());
    const candidates = [
        'landuse', 'land_use', 'lu_class', 'lu_name', 'lu_desc', 'kelas', 'kategori', 'usage', 'jenis', 'label', 'nama', 'nama_kegunaan', 'class'
    ];
    for (const c of candidates) {
        const idx = lowerKeys.indexOf(c);
        if (idx !== -1) return attrs[keys[idx]];
    }
    // fallback: try any field that looks like 'nama' or contains 'use' or 'lu'
    for (let i = 0; i < lowerKeys.length; i++) {
        const k = lowerKeys[i];
        if (k.includes('land') || k.includes('use') || k.includes('lu') || k.includes('nama') || k.includes('kelas') || k.includes('kategori')) {
            return attrs[keys[i]];
        }
    }
    return null;
}

/**
 * Compute zoning-based scores for an array of hexagon rings.
 * hexagons: array of rings (each ring = [[lon,lat],...])
 * category: requested category string from frontend
 * opts: { featureServiceUrl, layerIndex, delayMs }
 */
async function computeZoningScores(hexagons = [], category = '', token = null, opts = {}) {
    const defaultFeatureService = process.env.ZONING_FEATURE_URL || 'https://scharms.planmalaysia.gov.my/arcgis/rest/services/iPLAN/FeatureServer';
    const featureServiceUrl = (opts.featureServiceUrl || defaultFeatureService).replace(/\/+$/,'');
    const layerIndex = (opts.layerIndex != null) ? opts.layerIndex : 0;
    const layerUrl = `${featureServiceUrl}/${layerIndex}/query`;
    const delayMs = Number.isFinite(Number(opts.delayMs)) ? Number(opts.delayMs) : 200;

    const out = [];

    // scoring heuristics
    const fullScore = 20;
    const zeroLanduses = new Set(['badan air','hutan','pantai','pengangkutan']);

    const defaultMap = {
        'komersial': 18,
        'perumahan': 12,
        'industri': 6,
        'pertanian': 2,
        'pembangunan bercampur': 14,
        'institusi dan kemudahan masyarakat': 16,
        'infrastruktur dan utiliti': 4,
        'tanah kosong': 10,
        'tanah lapang dan rekreasi': 20,
        'pengangkutan': 0,
        'badan air': 0,
        'hutan': 0,
        'pantai': 0,
    };

    const categoryFullIfKomersial = new Set([
        "Retail",
        "Health and Medicine",
        "Automotive Services",
        "Sports and Recreation",
        "Dining and Drinking",
    ]);

    for (let i = 0; i < hexagons.length; i++) {
        const hex = hexagons[i];
        const centroid = polygonCentroid(hex) || { lon: null, lat: null };
        let landuse = null;
        let rawResponse = null;

        if (centroid.lon != null && centroid.lat != null) {
            // query by polygon intersection (send the polygon rings)
            const polygonGeom = { rings: [hex], spatialReference: { wkid: 4326 } };
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
                rawResponse = data;
                if (data && Array.isArray(data.features) && data.features.length) {
                    // pick first feature and extract landuse
                    const feat = data.features[0];
                    const attrs = feat.attributes || {};
                    const lu = pickLanduseFromAttributes(attrs);
                    landuse = lu != null ? String(lu).trim() : null;
                } else {
                    landuse = null;
                }
            } catch (err) {
                rawResponse = (err && err.response && err.response.data) ? err.response.data : { error: String(err) };
                landuse = null;
            }

            // small pause to reduce load
            await new Promise(r => setTimeout(r, delayMs));
        }

        // scoring logic
        let score = null;
        const catNorm = normalize(category || '');
        const luNorm = normalize(landuse || '');

        if (luNorm && zeroLanduses.has(luNorm)) {
            score = 0;
        } else if ((categoryFullIfKomersial.has(catNorm) || categoryFullIfKomersial.has(category)) && luNorm === 'komersial') {
            score = fullScore;
        } else if (catNorm === 'sports' && luNorm === 'tanah lapang dan rekreasi') {
            score = fullScore;
        } else if (!luNorm) {
            // no landuse found -> moderate default
            score = 10;
        } else {
            // heuristic lookup
            const s = defaultMap[luNorm];
            score = (s != null) ? s : 10;
        }

        out.push({ centroid, landuse, score, rawResponse });
    }

    return out;
}

module.exports = { computeZoningScores };
