const axios = require('axios');
const arcgisAuth = require('../api/arcgisAuth');
const supabase = require("../supabase/supabase_client"); // adjust your path
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
 * Convert WGS84 lon/lat to Web Mercator (EPSG:3857)
 */
function lonLatToWebMercator(lon, lat) {
    const x = Number(lon) * 20037508.34 / 180.0;
    // clamp latitude to WebMercator valid range
    const maxLat = 85.05112877980659;
    const clampedLat = Math.max(Math.min(Number(lat), maxLat), -maxLat);
    const y = Math.log(Math.tan((90 + clampedLat) * Math.PI / 360.0)) / (Math.PI / 180.0);
    const yMeters = y * 20037508.34 / 180.0;
    return { x: x, y: yMeters };
}

/**
 * Query BANJIR FeatureServer for features containing a point (centroid).
 * Accepts opts.token to include an authenticated token when needed.
 * Returns { floodAreaHa, features: [...], isFlooded, rawResponse }
 */
async function queryFloodAtPoint(polygonRings, opts = {}) {
    const defaultUrl =
        "https://services7.arcgis.com/S0zwYu2nP7GNUdBM/arcgis/rest/services/Flood/FeatureServer";
    const featureServiceUrl = (opts.featureServiceUrl || defaultUrl).replace(
        /\/+$/,
        ""
    );
    const layerUrl = featureServiceUrl + "/0/query";

    // convert polygon rings to Web Mercator (EPSG:3857) because the endpoint expects 3857
    // centroid param previously used; now centroid is the first arg but we will accept polygon in opts.polygonRings
    // convert polygon rings to 3857
    const convertRing = (ring) =>
        ring.map((pt) => {
            const lon = Number(pt[0]);
            const lat = Number(pt[1]);
            const wm = lonLatToWebMercator(lon, lat);
            return [wm.x, wm.y];
        });
    // polygonRings may be a single ring (array of points) or array of rings
    let converted;
    if (
        polygonRings &&
        Array.isArray(polygonRings) &&
        polygonRings.length > 0 &&
        Array.isArray(polygonRings[0]) &&
        typeof polygonRings[0][0] === "number"
    ) {
        // single ring
        converted = [convertRing(polygonRings)];
    } else {
        converted = polygonRings.map((r) => convertRing(r));
    }
    const geom = { rings: converted, spatialReference: { wkid: 3857 } };

    const params = new URLSearchParams();
    params.append("geometry", JSON.stringify(geom));
    params.append("geometryType", "esriGeometryPolygon");
    params.append("spatialRel", "esriSpatialRelIntersects");
    params.append("inSR", "3857");
    params.append("outFields", "*");
    params.append("returnGeometry", "false");
    params.append("f", "json");
    // ensure we have a token: prefer provided token, otherwise generate server-side
    const tokenToUse = await arcgisAuth.getToken();
    console.log("riskService: queryFloodAtPoint -> using token:", tokenToUse);
    // Append token as a URL parameter (the API accepts token in query string)
    const urlWithToken = tokenToUse
        ? layerUrl +
          (layerUrl.includes("?") ? "&" : "?") +
          "token=" +
          encodeURIComponent(tokenToUse)
        : layerUrl;
    console.log("riskService: queryFloodAtPoint", {
        geom,
        featureServiceUrl: urlWithToken,
        request: params.toString(),
    });
    try {
        const res = await axios.post(urlWithToken, params.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 30000,
        });
        const data = res.data;
        // handle non-JSON text responses gracefully
        let raw = data;
        if (typeof data === "string") raw = { text: data };
        if (Buffer.isBuffer(data)) raw = { text: data.toString("utf8") };
        raw._request = params.toString();

        let totalAreaHa = 0;
        let isFlooded = false;
        const feats = data && Array.isArray(data.features) ? data.features : [];
        if (feats.length) {
            isFlooded = true;
            for (const feat of feats) {
                const a =
                    feat.attributes &&
                    (feat.attributes.area_ha ||
                        feat.attributes.Area_Ha ||
                        feat.attributes.area ||
                        0);
                const v = Number(a) || 0;
                totalAreaHa += v;
            }
        }

        return {
            floodAreaHa: totalAreaHa,
            features: feats,
            isFlooded,
            rawResponse: raw,
        };
    } catch (err) {
        const serverData =
            err && err.response && err.response.data ? err.response.data : null;
        const raw = serverData
            ? typeof serverData === "string"
                ? { text: serverData }
                : serverData
            : { error: String(err) };
        raw._request = params.toString();
        console.error("riskService: queryFloodAtPoint failed", {
            centroid,
            featureServiceUrl: layerUrl,
            request: params.toString(),
            error: serverData || String(err),
        });
        return {
            floodAreaHa: null,
            features: [],
            isFlooded: false,
            rawResponse: raw,
        };
    }
}

/**
 * Query Landslide FeatureServer for polygon intersection.
 * Accepts opts.featureServiceUrl and opts.token. Returns { count, features, isPresent, rawResponse }
 */
async function queryLandslideForPolygon(polygonRings, opts = {}) {
    const defaultUrl = process.env.LANDSLIDE_FEATURE_URL || 'https://services7.arcgis.com/S0zwYu2nP7GNUdBM/arcgis/rest/services/LandSlide/FeatureServer';
    const featureServiceUrl = (opts.featureServiceUrl || defaultUrl).replace(/\/+$/,'');
    // query layer 0
    const layerUrl = featureServiceUrl + '/0/query';

    // convert polygon rings to 3857
    const convertRing = (ring) => ring.map(pt => {
        const lon = Number(pt[0]);
        const lat = Number(pt[1]);
        const wm = lonLatToWebMercator(lon, lat);
        return [wm.x, wm.y];
    });
    // polygonRings may be a single ring (array of points) or array of rings
    let converted;
    if (polygonRings && Array.isArray(polygonRings) && polygonRings.length > 0 && Array.isArray(polygonRings[0]) && typeof polygonRings[0][0] === 'number') {
        // single ring
        converted = [ convertRing(polygonRings) ];
    } else {
        converted = polygonRings.map(r => convertRing(r));
    }
    const geom = { rings: converted, spatialReference: { wkid: 3857 } };

    const params = new URLSearchParams();
    params.append('geometry', JSON.stringify(geom));
    params.append('geometryType', 'esriGeometryPolygon');
    params.append('spatialRel', 'esriSpatialRelIntersects');
    params.append('inSR', '3857');
    params.append('outFields', '*');
    params.append('returnGeometry', 'false');
    params.append('f', 'json');
    // ensure we have a token: prefer provided token, otherwise generate server-side
    const tokenToUse = opts.token || await arcgisAuth.getToken();
    // append token to URL rather than form body
    const urlWithToken = tokenToUse ? layerUrl + (layerUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(tokenToUse) : layerUrl;

    try {
        const res = await axios.post(urlWithToken, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
        const data = res.data;
        let raw = data;
        if (typeof data === 'string') raw = { text: data };
        if (Buffer.isBuffer(data)) raw = { text: data.toString('utf8') };
        raw._request = params.toString();

        const feats = data && Array.isArray(data.features) ? data.features : [];
        const count = feats.length;
        const isPresent = count > 0;
        return { count, features: feats, isPresent, rawResponse: raw };
    } catch (err) {
        const serverData = (err && err.response && err.response.data) ? err.response.data : null;
        const raw = serverData ? (typeof serverData === 'string' ? { text: serverData } : serverData) : { error: String(err) };
        raw._request = params.toString();
        console.error('riskService: queryLandslideForPolygon failed', { featureServiceUrl: layerUrl, request: params.toString(), error: serverData || String(err) });
        return { count: null, features: [], isPresent: false, rawResponse: raw };
    }
}

/**
 * Compute flood/risk scores for hexagons.
 * hexagons: array of rings [[lon,lat],...]
 * category: used to pick threshold from opts or category settings
 * opts: { sideLengthMeters, thresholdHa, featureServiceUrl, delayMs }
 * Returns array of { centroid, floodAreaHa, hexAreaHa, riskRatio, score, rawResponse }
 */
async function computeFloodRiskScores(hexagons = [], category = '', token = null, opts = {}) {
    const sideLengthMeters = Number(opts.sideLengthMeters) || 100; // fallback
    const thresholdHa = Number.isFinite(Number(opts.thresholdHa)) ? Number(opts.thresholdHa) : 1;
    const delayMs = Number.isFinite(Number(opts.delayMs)) ? Number(opts.delayMs) : 200;

    const hexArea_m2 = hexAreaMeters2(sideLengthMeters);
    const hexAreaHa = hexArea_m2 / 10000.0;

    const out = [];

    // helper to mask token values inside raw._request strings
    function maskRawRequest(raw) {
        if (!raw || typeof raw !== 'object') return raw;
        try {
            if (raw._request && typeof raw._request === 'string') {
                raw._request = raw._request.replace(/token=[^&]*/i, 'token=***');
            }
        } catch (e) {
            // ignore masking errors
        }
        return raw;
    }

    for (let i = 0; i < hexagons.length; i++) {
        const hex = hexagons[i].coordinates;
        const centroid = polygonCentroid(hex) || { lon: null, lat: null };
        let floodAreaHa = null;
        let rawResponse = null;
        let landslideCount = null;
        let landslideRaw = null;
        let landslidePresent = false;

        if (centroid.lon != null && centroid.lat != null) {
            // pass the hex polygon rings to the query function so it can send polygon in 3857
            console.log("hexagon: ", hex);
            const q = await queryFloodAtPoint(hex, { featureServiceUrl: opts.featureServiceUrl, token });
            floodAreaHa = (q && Number.isFinite(Number(q.floodAreaHa))) ? Number(q.floodAreaHa) : (q && q.floodAreaHa === 0 ? 0 : null);
            rawResponse = q && q.rawResponse ? q.rawResponse : null; 
            // include flooded flag
            var isFlooded = q && q.isFlooded ? true : false;

            // Also query landslide layer for this polygon
            const lq = await queryLandslideForPolygon(hex, { featureServiceUrl: opts.landslideFeatureUrl || process.env.LANDSLIDE_FEATURE_URL, token });
            landslideCount = (lq && Number.isFinite(Number(lq.count))) ? Number(lq.count) : (lq && lq.count === 0 ? 0 : null);
            landslideRaw = lq && lq.rawResponse ? lq.rawResponse : null;
            landslidePresent = lq && lq.isPresent ? true : false;

            // throttle
            await new Promise(r => setTimeout(r, delayMs));
        }

        // New scoring: total max 20 distributed by riskRatio (flood weight)
        // riskRatio = portion allocated to flood (0.0 - 1.0). floodMax = 20 * riskRatio, landslideMax = 20 * (1 - riskRatio)
        // Flood: if has flood -> floodScore = 0, else floodScore = floodMax
        // Landslide: if landslideCount > 0 -> landslideScore = 0, else landslideScore = landslideMax
        // If either flood or landslide result is unknown (null), we conservatively set overall score to null
        let floodScore = null;
        let landslideScore = null;
        let score = null;
        let coverage = null;

        // determine riskRatio: service expects opts.riskRatio to be provided by controller; fallback to 0.5
        const ratioVal = Number.isFinite(Number(opts.riskRatio)) ? Number(opts.riskRatio) : 0.5;
        const floodMax = 20 * Number(ratioVal);
        const landslideMax = 20 * (1 - Number(ratioVal));

        // Determine floodScore based on floodAreaHa
        if (floodAreaHa == null && landslideCount == null) {
            score = null;
        } else {
            if (floodAreaHa == null) {
                floodScore = null;
            } else {
                floodScore = (Number(floodAreaHa) > 0) ? 0 : floodMax;
                coverage = (hexAreaHa > 0) ? Math.min(Number(floodAreaHa) / hexAreaHa, 1) : null;
            }

            if (landslideCount == null) {
                landslideScore = null;
            } else {
                landslideScore = (Number(landslideCount) > 0) ? 0 : landslideMax;
            }

            if (floodScore == null || landslideScore == null) {
                score = null;
            } else {
                score = Number(floodScore) + Number(landslideScore);
            }
        }

        // keep backward-compatible `ratio` field and new `riskRatio` field
        const ratio = ratioVal;
        const riskRatio = ratioVal;

        // build a structured rawResponse containing separate flood and landslide payloads
        // const structuredRaw = {
        //     flood: maskRawRequest(rawResponse && typeof rawResponse === 'object' ? rawResponse : (rawResponse ? rawResponse : null)),
        //     landslide: maskRawRequest(landslideRaw && typeof landslideRaw === 'object' ? landslideRaw : (landslideRaw ? landslideRaw : null))
        // };

        out.push({
            centroid,
            floodAreaHa,
            landslideCount,
            hexAreaHa,
            coverage,
            floodScore,
            landslideScore,
            riskRatio,
            score,
            isFlooded: !!isFlooded,
            hasLandslide: !!landslidePresent,
            // rawResponse: structuredRaw,
        });
    }

    return out;
}


async function saveRiskScoresToDatabase(riskScores, hex_id_array) {
    console.log("Saving risk scores to database...", {
        riskScores: riskScores,
        hex_id_array,
    });

    try {
        await supabase.from("risk").upsert(
            hex_id_array.map((hex_id, index) => {
                const r = riskScores[index]; // safely access
                console.log("r:", r);
                return {
                    hex_id,
                    risk_ratio: Number(r.riskRatio) ?? null,
                    flood_score: Number(r.floodScore) ?? null,
                    landslide_score: Number(r.landslideScore) ?? null,
                    total_score: Number(r.score) ?? null,
                };
            })
        );
    } catch (error) {
        console.error("Error saving risk scores to database:", error);
        throw error;
    }
}

module.exports = { computeFloodRiskScores, saveRiskScoresToDatabase };
