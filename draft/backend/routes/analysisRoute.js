require('dotenv').config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const {
    getUserAnalysesWithDetails,
    updateAnalysisReferencePoint,
    deleteAnalysis,
} = require("../services/analysisService");
const catchmentController = require('../controllers/catchmentController');
const demandController = require('../controllers/demandController');
const poiController = require('../controllers/poiController');
const accessibilityController = require('../controllers/accessibilityController');
const zoningController = require('../controllers/zoningController');
const riskController = require('../controllers/riskController');
const workflowController = require('../controllers/workflowController');

// Token extractor: prefer "Authenticator", then "Authorization", then env ARC_API_KEY
function extractToken(req) {
    // Fallback to env variable if req is invalid
    if (!req || typeof req.get !== "function") {
        return process.env.ARC_API_KEY || null;
    }

    // Normalize header lookup (case-insensitive)
    const headers = req.headers || {};
    const getHeader = (name) =>
        headers[name] ||
        headers[name.toLowerCase()] ||
        req.get(name) ||
        req.get(name.toLowerCase());

    // Prefer in this order: body.token -> "Authenticator" -> "Authorization"
    const bodyToken = (req.body && req.body.token) ? req.body.token : null;
    const raw =
        bodyToken ||
        getHeader("Authenticator") ||
        getHeader("Authorization") ||
        "";

    if (typeof raw === "string") {
        const trimmed = raw.trim();

        // Accept "Bearer <token>"
        if (trimmed.toLowerCase().startsWith("bearer ")) {
            return trimmed.slice(7).trim() || null;
        }

        // Accept raw token as-is
        if (trimmed.length > 0) {
            return trimmed;
        }
    }

    // Fallback to env
    return process.env.ARC_API_KEY || null;
}


router.get("/analysis/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const analyses = await getUserAnalysesWithDetails(userId);
        console.log("Fetched analyses for user:", userId, analyses);
        res.status(200).json({ analyses });
    } catch (err) {
        console.error("Failed to fetch user analyses:", err);
        res.status(500).json({ error: "Failed to fetch user analyses" });
    }
});

router.patch("/analysis/:analysisId", async (req, res) => {
    const { analysisId } = req.params;
    const { name, lat, lon } = req.body;

    if (!name || lat == null || lon == null) {
        return res
            .status(400)
            .json({ error: "Missing reference point fields" });
    }

    try {
        await updateAnalysisReferencePoint(analysisId, name, lat, lon );
        res.status(200).json({
            message: "Reference point updated successfully",
        });
    } catch (err) {
        console.error("Failed to update reference point:", err);
        res.status(500).json({ error: "Failed to update reference point" });
    }
});

router.delete("/analysis/:analysisId", async (req, res) => {
    const { analysisId } = req.params;

    try {
        // Assuming you have a service to delete analysis by ID
        await deleteAnalysis(analysisId);
        res.status(200).json({
            message: "Analysis deleted successfully",
        });
    } catch (err) {
        console.error("Failed to delete analysis:", err);
        res.status(500).json({ error: "Failed to delete analysis" });
    }
});

// New: Get top 3 recommended locations for an analysisId
router.get("/analysis/:analysisId/recommendations", async (req, res) => {
    const { analysisId } = req.params;
    try {
        const result = await sql.query`
            SELECT TOP 3 locationId, lat, lon, score, reason
            FROM RecommendedLocation
            WHERE analysisId = ${analysisId}
            ORDER BY score DESC
        `;

        //get reference point details
        const refPointResult = await sql.query`
            SELECT rp.name, rp.lat, rp.lon
            FROM Analysis a
            JOIN ReferencePoint rp ON a.referencePointId = rp.pointId
            WHERE a.analysisId = ${analysisId}
        `;
        res.json({ locations: result.recordset, referencePoint: refPointResult.recordset[0] });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch recommendations" });
    }
});

// POST /analysis/catchment
// body: { radius, center_x, center_y, category, maxCount?, returnResponses? }
router.post('/analysis/catchment', async (req, res) => {
    const { radius, center_x, center_y, category, maxCount, returnResponses } = req.body;

    if (radius == null || center_x == null || center_y == null) {
        return res.status(400).json({ error: 'radius, center_x and center_y are required in the request body' });
    }

    // Token can be provided via Authorization header (Bearer ...) or from environment variables.
    // Prefer Authorization header if present (safer for per-request overrides), otherwise use env.
    const token = extractToken(req);

    if (!token) {
        return res.status(400).json({ error: 'ArcGIS token is required. Set ARC_API_KEY in the backend environment or provide a Bearer token in Authorization header.' });
    }

    try {
        const result = await catchmentController.runCatchment({ radius: Number(radius), center_x: Number(center_x), center_y: Number(center_y), category, token, maxCount, returnResponses });
        res.status(200).json(result);
    } catch (err) {
        console.error('Catchment processing failed:', err);
        res.status(500).json({ error: 'Catchment processing failed', detail: String(err) });
    }
});

// POST /analysis/demand
// body: { hexagons?, radius?, center_x?, center_y?, category?, maxCount?, returnResponses? }
router.post('/analysis/demand', async (req, res) => {
    const { hexagons, radius, center_x, center_y, category, maxCount, returnResponses } = req.body || {};

    // require either hexagons or center/radius
    if ((!Array.isArray(hexagons) || hexagons.length === 0) && (radius == null || center_x == null || center_y == null)) {
        return res.status(400).json({ error: 'Provide `hexagons` or radius, center_x and center_y in the request body' });
    }

    // Token can be provided via Authorization header (Bearer ...) or from environment variables.
    const token = extractToken(req);

    if (!token) {
        return res.status(400).json({ error: 'ArcGIS token is required. Set ARC_API_KEY in the backend environment or provide a Bearer token in Authorization header.' });
    }

    try {
        const result = await demandController.runDemand({ hexagons, radius: Number(radius), center_x: Number(center_x), center_y: Number(center_y), category, token, maxCount, returnResponses });

        // Per request: compute demand indicator but return the generated hexagons only (with centroids)
        res.status(200).json(result);
    } catch (err) {
        console.error('Demand processing failed:', err);
        res.status(500).json({ error: 'Demand processing failed', detail: String(err) });
    }
});

// POST /analysis/workflow
// body: { radius, center_x, center_y, category, maxCount?, token? }
router.post('/analysis/workflow', async (req, res) => {
    const { radius, center_x, center_y, category, maxCount } = req.body || {};
    // Token can be provided via Authorization header (Bearer ...) or from environment variables.
    const token = extractToken(req);

    if (!token) {
        return res
            .status(400)
            .json({
                error: "ArcGIS token is required. Set ARC_API_KEY in the backend environment or provide a Bearer token in Authorization header.",
            });
    }

    if (radius == null || center_x == null || center_y == null) {
        return res
            .status(400)
            .json({
                error: "radius, center_x and center_y are required in the request body",
            });
    }

    try {
        const results = await workflowController.runWorkflow({
            radius: Number(radius),
            center_x: Number(center_x),
            center_y: Number(center_y),
            category,
            token,
            maxCount,
        });
        res.status(200).json({ results });
    } catch (err) {
        console.error("Workflow processing failed:", err);
        res.status(500).json({
            error: "Workflow processing failed",
            detail: String(err),
        });
    }
});

// POST /analysis/pois
// body: { hexagons? (3d array), radius?, center_x?, center_y?, category? }
router.post('/analysis/pois', async (req, res) => {
    const { hexagons, radius, center_x, center_y, category, maxCount } = req.body || {};

    // Token can be provided via Authorization header (Bearer ...) or from environment variables.
    const token = extractToken(req);

    if (!token) {
        return res.status(400).json({ error: 'ArcGIS Places API token is required. Set ARC_API_KEY/ARC_TOKEN in env or provide Authorization: Bearer <token>' });
    }

    try {
        const result = await poiController.runPOIScoring({ hexagons, radius: Number(radius), center_x: Number(center_x), center_y: Number(center_y), category, token, maxCount });
        res.status(200).json(result);
    } catch (err) {
        console.error('POI scoring failed:', err);
        res.status(500).json({ error: 'POI scoring failed', detail: String(err) });
    }
});

// POST /analysis/accessibility
// body: { radius, center_x, center_y, category, maxCount? }
router.post('/analysis/accessibility', async (req, res) => {
    const { radius, center_x, center_y, category, maxCount } = req.body || {};

    if (radius == null || center_x == null || center_y == null) {
        return res.status(400).json({ error: 'radius, center_x and center_y are required in the request body' });
    }

    const token = extractToken(req);

    if (!token) {
        return res.status(400).json({ error: 'ArcGIS token is required. Set ARC_API_KEY in env or provide an Authenticator/Authorization header.' });
    }

    try {
        const result = await accessibilityController.runAccessibility({ radius: Number(radius), center_x: Number(center_x), center_y: Number(center_y), category, token, maxCount });
        res.status(200).json(result);
    } catch (err) {
        console.error('Accessibility processing failed:', err);
        res.status(500).json({ error: 'Accessibility processing failed', detail: String(err) });
    }
});

// POST /analysis/zoning
// body: { radius, center_x, center_y, category, maxCount? }
router.post('/analysis/zoning', async (req, res) => {
    const { radius, center_x, center_y, category, maxCount } = req.body || {};

    if (radius == null || center_x == null || center_y == null) {
        return res.status(400).json({ error: 'radius, center_x and center_y are required in the request body' });
    }

    const token = extractToken(req);

    try {
        const result = await zoningController.runZoning({ radius: Number(radius), center_x: Number(center_x), center_y: Number(center_y), category, token, maxCount });
        res.status(200).json(result);
    } catch (err) {
        console.error('Zoning processing failed:', err);
        res.status(500).json({ error: 'Zoning processing failed', detail: String(err) });
    }
});

// POST /analysis/risk
// body: { radius, center_x, center_y, category, maxCount? }
router.post('/analysis/risk', async (req, res) => {
    const { radius, center_x, center_y, category, maxCount } = req.body || {};

    if (radius == null || center_x == null || center_y == null) {
        return res.status(400).json({ error: 'radius, center_x and center_y are required in the request body' });
    }

    try {
        // Force server-side token generation inside the controller/helper.
        // Do NOT accept token from client for this endpoint.
        const result = await riskController.runRiskAnalysis({ radius: Number(radius), center_x: Number(center_x), center_y: Number(center_y), category, token: null, maxCount });
        res.status(200).json(result);
    } catch (err) {
        console.error('Risk processing failed:', err);
        res.status(500).json({ error: 'Risk processing failed', detail: String(err) });
    }
});

module.exports = router;


