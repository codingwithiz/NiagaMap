const axios = require('axios');

/**
 * Fetch places categories from ArcGIS Places API.
 * If opts.filter is provided, behaves like arcgisServices.getCategories and returns an
 * array of categoryIds (top 10). Otherwise returns the raw response object.
 *
 * @param {string} token - ArcGIS token
 * @param {Object} opts - { filter, timeout }
 */
async function fetchCategories(token, opts = {}) {
    const endpoint = 'https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/categories';
    const { filter = null } = opts;
    try {
        // Use query params (ArcGIS supports token as a param)
        const params = { f: 'json' };
        if (filter) params.filter = filter;
        if (token) params.token = token;

        const res = await axios.get(endpoint, {
            params,
            timeout: opts.timeout || 20000,
        });

        // If a filter was requested, return simplified array of categoryIds (top 10)
        if (filter) {
            const cats = (res.data && res.data.categories) ? res.data.categories : [];
            if (!cats || cats.length === 0) return [];
            const slice = cats.length > 10 ? cats.slice(0, 10) : cats;
            const ids = [];
            slice.forEach((c) => {
                // ArcGIS category id property may be `categoryId` or `id` depending on version
                if (c.categoryId) ids.push(c.categoryId);
                else if (c.id) ids.push(c.id);
            });
            return ids;
        }

        // No filter: return full response so callers can inspect category objects
        return res.data;
    } catch (err) {
        throw err;
    }
}

/**
 * Query places within extent (bounding box)
 * extent: [minx, miny, maxx, maxy]
 * categoryIds: comma-separated string or array
 */
async function queryWithinExtent(extent, categoryIds, token, opts = {}) {
    const endpoint =
        "https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/places/within-extent";

    const params = {
        xmin: extent[0],
        ymin: extent[1],
        xmax: extent[2],
        ymax: extent[3],
        f: "json",
        limit: opts.limit || 100,
    };

    // category IDs
    if (Array.isArray(categoryIds)) params.categoryIds = categoryIds.join(",");
    else if (categoryIds) params.categoryIds = categoryIds;

    // OAuth2 Bearer token
    if (token) params.token = token;

    try {
        const res = await axios.get(endpoint, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            params,
            timeout: opts.timeout || 20000,
        });
        return res.data;
    } catch (err) {
        if (err.response) {
            const details =
                err.response.data?.error?.details || err.response.data;
            const e = new Error(
                `Places within-extent failed: ${err.response.status} ${
                    err.response.statusText
                } - ${JSON.stringify(details)}`
            );
            e.status = err.response.status;
            e.data = err.response.data;
            throw e;
        }
        throw err;
    }
}


module.exports = { fetchCategories, queryWithinExtent };
