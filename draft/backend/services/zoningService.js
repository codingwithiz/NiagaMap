const axios = require("axios");

/**
 * Simple polygon centroid for ring [[lon,lat],...]
 */
function polygonCentroid(ring) {
    if (!Array.isArray(ring) || ring.length === 0) return null;
    const last = ring[ring.length - 1];
    const first = ring[0];
    const pts =
        last && first && last[0] === first[0] && last[1] === first[1]
            ? ring.slice(0, -1)
            : ring.slice();
    let sumX = 0,
        sumY = 0;
    for (const p of pts) {
        sumX += Number(p[0]);
        sumY += Number(p[1]);
    }
    const n = pts.length || 1;
    return { lon: sumX / n, lat: sumY / n };
}

function normalize(s) {
    if (s == null) return "";
    return String(s).trim().toLowerCase();
}

/**
 * Try to pick a landuse/zoning string from an attributes object.
 * Checks common attribute names first, then falls back to heuristics.
 */
function pickLanduseFromAttributes(attrs) {
    if (!attrs || typeof attrs !== "object") return null;
    // common attribute names observed in various layers
    const priority = [
        "lu_name",
        "lu_name_en",
        "lu",
        "landuse",
        "land_use",
        "zoning",
        "zone",
        "zon",
        "kelas",
        "kategori",
        "nama_kegunaan",
        "nama",
        "name",
        "description",
        "desc",
        "label",
        "usage",
        "jenis",
        "use",
    ];

    const keys = Object.keys(attrs);
    const lowerIndex = {};
    for (let i = 0; i < keys.length; i++)
        lowerIndex[keys[i].toLowerCase()] = keys[i];

    for (const p of priority) {
        if (p in lowerIndex) {
            const val = attrs[lowerIndex[p]];
            if (val != null && String(val).trim() !== "") return val;
        }
    }

    // fallback: look for any key that contains indicative substrings
    for (const k of keys) {
        const lk = k.toLowerCase();
        if (
            lk.includes("lu") ||
            lk.includes("land") ||
            lk.includes("zone") ||
            lk.includes("kelas") ||
            lk.includes("nama") ||
            lk.includes("use")
        ) {
            const v = attrs[k];
            if (v != null && String(v).trim() !== "") return v;
        }
    }

    // last resort: return first non-null attribute value (stringified)
    for (const k of keys) {
        const v = attrs[k];
        if (v != null && String(v).trim() !== "") return v;
    }
    return null;
}

/**
 * Compute zoning-based scores for an array of hexagon rings.
 * hexagons: array of rings (each ring = [[lon,lat],...])
 * category: requested category string from frontend
 * opts: { featureServiceUrl, layerIndex, delayMs }
 */
async function computeZoningScores(hexagons = [], category = "", opts = {}) {
    const defaultFeatureService =
        process.env.ZONING_FEATURE_URL ||
        "https://scharms.planmalaysia.gov.my/arcgis/rest/services/iPLAN";
    let featureServiceUrl = (
        opts.featureServiceUrl || defaultFeatureService
    ).replace(/\/+$/, "");
    const layerIndex = opts.layerIndex != null ? opts.layerIndex : 0;
    const delayMs = Number.isFinite(Number(opts.delayMs))
        ? Number(opts.delayMs)
        : 200;

    const out = [];

    // scoring heuristics
    const fullScore = 20;
    const zeroLanduses = new Set([
        "badan air",
        "hutan",
        "pantai",
        "pengangkutan",
    ]);

    const defaultMap = {
        komersial: 18,
        perumahan: 12,
        industri: 6,
        pertanian: 2,
        "pembangunan bercampur": 14,
        "institusi dan kemudahan masyarakat": 16,
        "infrastruktur dan utiliti": 4,
        "tanah kosong": 10,
        "tanah lapang dan rekreasi": 20,
        pengangkutan: 0,
        "badan air": 0,
        hutan: 0,
        pantai: 0,
    };

    // normalize categoryFullIfKomersial to lowercase for comparison
    const categoryFullIfKomersial = new Set(
        [
            "retail",
            "health and medicine",
            "automotive services",
            "sports and recreation",
            "dining and drinking",
        ].map((s) => s.toLowerCase())
    );

    // Build a query URL. iPLAN exposes MapServer layers; handle both MapServer and FeatureServer inputs.
    // Accept these forms for featureServiceUrl:
    //  - .../iPLAN  (folder root) -> we'll append /<serviceName>/<type>/<layerIndex>/query when necessary
    //  - .../iPLAN/<ServiceName>/MapServer  OR .../iPLAN/<ServiceName>/FeatureServer
    // If the user passed a service root without '/MapServer' or '/FeatureServer', attempt to use MapServer first.
    // The simplest approach: if the base url already ends with MapServer or FeatureServer, use it; otherwise assume MapServer.
    // We'll attempt to call `${base}/{MapServer|FeatureServer}/${layerIndex}/query`.
    const buildLayerQueryUrl = (baseUrl, idx) => {
        // if url already contains MapServer or FeatureServer at the end
        if (/\/(?:MapServer|FeatureServer)(?:\/)?$/i.test(baseUrl)) {
            // append layer idx + query
            return `${baseUrl.replace(/\/+$/, "")}/${idx}/query`;
        }
        // try MapServer first
        return `${baseUrl.replace(/\/+$/, "")}/MapServer/${idx}/query`;
    };

    for (let i = 0; i < hexagons.length; i++) {
        const hex = hexagons[i];
        const centroid = polygonCentroid(hex) || { lon: null, lat: null };
        let landuse = null;
        let rawResponse = null;

        if (centroid.lon != null && centroid.lat != null) {
            // try hitting MapServer/<layerIndex>/query first
            const layerUrl = buildLayerQueryUrl(featureServiceUrl, layerIndex);

            // query by centroid point
            const pointGeom = {
                x: Number(centroid.lon),
                y: Number(centroid.lat),
                spatialReference: { wkid: 4326 },
            };

            const params = {
                geometry: JSON.stringify(pointGeom),
                geometryType: "esriGeometryPoint",
                spatialRel: "esriSpatialRelIntersects",
                inSR: 4326,
                outFields: "*",
                outSR: 4326,
                f: "json",
                returnGeometry: false,
            };

            try {
                // use GET with params for ArcGIS REST query
                const res = await axios.get(layerUrl, {
                    params,
                    timeout: 30000,
                    maxContentLength: 50 * 1024 * 1024,
                });
                const data = res.data;

                if (typeof data === "string") {
                    rawResponse = {
                        text: data,
                        _request:
                            `${layerUrl}?` +
                            new URLSearchParams(params).toString(),
                    };
                } else if (Buffer.isBuffer(data)) {
                    rawResponse = {
                        text: data.toString("utf8"),
                        _request:
                            `${layerUrl}?` +
                            new URLSearchParams(params).toString(),
                    };
                } else {
                    rawResponse = Object.assign({}, data, {
                        _request:
                            `${layerUrl}?` +
                            new URLSearchParams(params).toString(),
                    });
                }

                // If ArcGIS returns an HTML error page (e.g. Web Adaptor "Application Error"), data may be HTML string
                if (
                    typeof data === "string" &&
                    data.toLowerCase().includes("<html")
                ) {
                    // keep rawResponse.text and set landuse null
                    landuse = null;
                    console.error(
                        "ZoningService: HTML returned from server (possible Web Adaptor error)",
                        { index: i, centroid, layerUrl }
                    );
                } else if (data && data.error) {
                    // server reported error payload
                    console.error(
                        "ZoningService: FeatureServer returned error",
                        {
                            index: i,
                            centroid,
                            layerUrl,
                            serverError: data.error,
                        }
                    );
                    landuse = null;
                } else if (
                    data &&
                    Array.isArray(data.features) &&
                    data.features.length
                ) {
                    // pick first feature and extract landuse
                    const feat = data.features[0];
                    const attrs = feat.attributes || {};
                    const lu = pickLanduseFromAttributes(attrs);
                    landuse = lu != null ? String(lu).trim() : null;
                } else {
                    // no features found at the point
                    landuse = null;
                }
            } catch (err) {
                const serverData =
                    err && err.response && err.response.data
                        ? err.response.data
                        : null;
                if (typeof serverData === "string") {
                    rawResponse = {
                        text: serverData,
                        _request:
                            `${layerUrl}?` +
                            new URLSearchParams(params).toString(),
                        error: true,
                    };
                } else if (Buffer.isBuffer(serverData)) {
                    rawResponse = {
                        text: serverData.toString("utf8"),
                        _request:
                            `${layerUrl}?` +
                            new URLSearchParams(params).toString(),
                        error: true,
                    };
                } else if (serverData) {
                    rawResponse = Object.assign({}, serverData, {
                        _request:
                            `${layerUrl}?` +
                            new URLSearchParams(params).toString(),
                    });
                } else {
                    rawResponse = {
                        error: String(err),
                        _request:
                            `${layerUrl}?` +
                            new URLSearchParams(params).toString(),
                    };
                }
                console.error("ZoningService: FeatureServer query failed", {
                    index: i,
                    centroid,
                    layerUrl,
                    errorPayload: serverData || String(err),
                });
                landuse = null;
            }

            // small pause to reduce load
            await new Promise((r) => setTimeout(r, delayMs));
        }

        // scoring logic
        let score = null;
        const catNorm = normalize(category || "");
        const luNorm = normalize(landuse || "");

        // if the rawResponse contains an error, treat score as unknown (null)
        if (rawResponse && rawResponse.error) {
            score = null;
        } else if (luNorm && zeroLanduses.has(luNorm)) {
            score = 0;
        } else if (
            (categoryFullIfKomersial.has(catNorm) ||
                categoryFullIfKomersial.has(category)) &&
            luNorm === "komersial"
        ) {
            score = fullScore;
        } else if (
            catNorm === "sports" &&
            luNorm === "tanah lapang dan rekreasi"
        ) {
            score = fullScore;
        } else if (!luNorm) {
            // no landuse found (but no server error) -> moderate default
            score = 10;
        } else {
            // heuristic lookup (defaultMap keys are lowercased)
            const s = defaultMap[luNorm];
            score = s != null ? s : 10;
        }

        out.push({ centroid, landuse, score, rawResponse });
    }

    return out;
}

module.exports = { computeZoningScores };
