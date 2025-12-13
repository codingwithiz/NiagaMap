const axios = require('axios');

// Simple in-memory token cache
let cached = { token: null, expiresAt: 0 };

/**
 * Generate a token from ArcGIS Online sharing REST endpoint using a service account.
 * Expects environment variables: ARC_USERNAME, ARC_PASSWORD, ARC_REFERER (optional)
 * expirationSeconds is suggested (default 120)
 */
async function generateToken(expirationSeconds = 120) {
    const username = process.env.ARC_USERNAME;
    const password = process.env.ARC_PASSWORD;
    const referer = process.env.ARC_REFERER || 'http://localhost:3001';

    if (!username || !password) {
        return null;
    }

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('client', 'referer');
    params.append('referer', referer);
    params.append('expiration', String(expirationSeconds));
    params.append('f', 'json');

    try {
        const res = await axios.post('https://www.arcgis.com/sharing/rest/generateToken', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
        });
        const data = res.data;
        if (data && data.token) {
            const ttl = Number(data.expires) ? Math.max(60, Math.floor((Number(data.expires) - Date.now()/1000))) : expirationSeconds;
            // set expiry 30s before actual to be safe
            cached.token = data.token;
            cached.expiresAt = Date.now() + (Math.max(30, ttl - 30) * 1000);
            return data.token;
        }
        return null;
    } catch (err) {
        console.error('arcgisAuth: token generation failed', err && err.response && err.response.data ? err.response.data : String(err));
        return null;
    }
}

/**
 * Get cached token or generate a new one if expired.
 */
async function getToken() {
    if (cached.token && Date.now() < cached.expiresAt) {
        return cached.token;
    }
    // try to generate with default short expiration (120s)
    return await generateToken(120);
}

module.exports = { getToken, generateToken };
