require('dotenv').config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const supabase = require("../supabase/supabase_client"); // Add this import
const {
    getUserAnalysesWithDetails,
    updateAnalysisReferencePoint,
    deleteAnalysis,
} = require("../services/analysisService");
const catchmentController = require('../controllers/catchmentController');
const catchmentService = require('../services/catchmentService');
const demandController = require('../controllers/demandController');
const poiController = require('../controllers/poiController');
const accessibilityController = require('../controllers/accessibilityController');
const zoningController = require('../controllers/zoningController');
const riskController = require('../controllers/riskController');
const workflowController = require('../controllers/workflowController');
const arcgis = require("../services/arcgisServices");
const { generateLocationReasoning } = require('../services/openaiService');

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

// NEW: Get all hexagons with scores for an analysis
router.get("/analysis/:analysisId/hexagons", async (req, res) => {
    const { analysisId } = req.params;

    try {
        console.log("Fetching hexagons for analysis:", analysisId);
        
        const { data: hexagons, error } = await supabase
            .from("hexagon")
            .select("*")
            .eq("analysis_id", analysisId)
            .order("hex_index", { ascending: true });

        if (error) {
            console.error("Error fetching hexagons:", error);
            throw error;
        }

        // Transform the data to match the frontend expectations
        const results = hexagons.map(hex => ({
            hexagon: {
                hex_id: hex.hex_id,
                analysis_id: hex.analysis_id,
                coordinates: hex.coordinates,
                hex_index: hex.hex_index,
            },
            centroid: hex.centroid,
            demandScore: hex.demand_score || 0,
            poiScore: hex.poi_score || 0,
            riskScore: hex.risk_score || 0,
            zoningScore: hex.zoning_score || 0,
            accessibilityScore: hex.accessibility_score || 0,
            demandRaw: hex.demand_raw || 0,
            poiRaw: hex.poi_raw || 0,
            riskRaw: hex.risk_raw || {},
            zoningRaw: hex.zoning_raw || {},
            accessibilityRaw: hex.accessibility_raw || {},
            finalScore: hex.final_score || 0,
        }));

        console.log(`Retrieved ${results.length} hexagons with scores`);
        res.status(200).json({ hexagons: results });
    } catch (err) {
        console.error("Failed to fetch hexagons:", err);
        res.status(500).json({ error: "Failed to fetch hexagons" });
    }
});

// Get top 3 recommended locations with AI-generated reasoning
router.get("/analysis/:analysisId/recommendations", async (req, res) => {
    try {
        const { analysisId } = req.params;
        
        console.log("Fetching recommendations for analysis:", analysisId);
        
        // Fetch recommended locations from Supabase
        const { data: locations, error: locError } = await supabase
            .from("recommended_location")
            .select("*")
            .eq("analysis_id", analysisId)
            .order("score", { ascending: false });
        
        if (locError) {
            console.error("Error fetching locations:", locError);
            throw locError;
        }
        
        console.log("Found locations:", locations);
        
        // Fetch reference point via analysis
        const { data: analysis, error: analysisError } = await supabase
            .from("analysis")
            .select("reference_point_id, chat_id")
            .eq("analysis_id", analysisId)
            .single();
        
        if (analysisError) {
            console.error("Error fetching analysis:", analysisError);
            throw analysisError;
        }
        
        console.log("Found analysis:", analysis);
        
        const { data: referencePoint, error: refError } = await supabase
            .from("reference_point")
            .select("*")
            .eq("point_id", analysis.reference_point_id)
            .single();
        
        if (refError) {
            console.error("Error fetching reference point:", refError);
            throw refError;
        }
        
        console.log("Found reference point:", referencePoint);

        // Parse breakdown and check if AI reasoning already exists
        const formattedLocations = locations.map(loc => {
            let breakdown = loc.reason;
            let aiReason = loc.ai_reason; // Get existing AI reason from database
            
            // Parse breakdown if it's a string
            if (typeof breakdown === 'string') {
                try {
                    breakdown = JSON.parse(breakdown);
                } catch (e) {
                    console.error("Failed to parse breakdown:", e);
                }
            }

            return {
                location_id: loc.location_id,
                lat: loc.lat,
                lon: loc.lon,
                score: loc.score,
                breakdown: breakdown,
                reason: aiReason // Use existing AI reason
            };
        });

        // Check if ALL locations have AI reasoning
        const needsAiReasoning = formattedLocations.some(loc => !loc.reason || loc.reason === null || loc.reason === '');

        let locationsWithReasoning = formattedLocations;

        // Only generate AI reasoning if it doesn't exist for any location
        if (needsAiReasoning) {
            console.log("⚠️ AI reasoning missing for some locations, generating new reasoning...");
            
            // Fetch chat conversation to get category and weights
            const { data: conversation, error: convError } = await supabase
                .from("conversation")
                .select("user_prompt, bot_answer")
                .eq("analysis_id", analysisId)
                .single();

            let category = "retail";
            let weights = { demand: 20, poi: 20, risk: 20, accessibility: 20, zoning: 20 };

            if (conversation && conversation.bot_answer) {
                try {
                    const botData = JSON.parse(conversation.bot_answer);
                    category = botData.category || "retail";
                    weights = botData.weights || weights;
                } catch (e) {
                    console.error("Failed to parse bot_answer:", e);
                }
            }

            // Generate AI reasoning for locations
            console.log("🤖 Calling OpenAI to generate reasoning...");
            locationsWithReasoning = await generateLocationReasoning({
                locations: formattedLocations,
                category,
                weights,
                referencePoint: {
                    lat: referencePoint.lat,
                    lon: referencePoint.lon,
                    name: referencePoint.name
                }
            });

            console.log("✅ AI reasoning generated:", locationsWithReasoning);

            // Save the AI reasoning back to database
            for (let i = 0; i < locationsWithReasoning.length; i++) {
                const locationWithReason = locationsWithReasoning[i];
                const originalLocation = formattedLocations[i];

                // Update the record with AI reasoning in the 'ai_reason' column
                const { error: updateError } = await supabase
                    .from("recommended_location")
                    .update({
                        ai_reason: locationWithReason.reason
                    })
                    .eq("location_id", originalLocation.location_id);

                if (updateError) {
                    console.error("❌ Error updating AI reasoning:", updateError);
                } else {
                    console.log(`✅ Updated location ${originalLocation.location_id} with AI reasoning`);
                }
            }
        } else {
            console.log("✅ AI reasoning already exists in database, using cached version");
        }
        
        res.json({
            locations: locationsWithReasoning,
            referencePoint: {
                lat: referencePoint.lat,
                lon: referencePoint.lon,
                name: referencePoint.name
            }
        });
    } catch (error) {
        console.error("❌ Error fetching recommendations:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /analysis/catchment
// body: { radius, center_x, center_y, category, maxCount?, returnResponses? }
router.post('/analysis/catchment', async (req, res) => {
    const { radius, center_x, center_y, category, maxCount, returnResponses } = req.body;

    if (radius == null || center_x == null || center_y == null) {
        return res
            .status(401)
            .json({
                error: "radius, center_x and center_y are required in the request body",
            });
    }

    // Token can be provided via Authorization header (Bearer ...) or from environment variables.
    // Prefer Authorization header if present (safer for per-request overrides), otherwise use env.
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ error: 'ArcGIS token is required. Set ARC_API_KEY in the backend environment or provide a Bearer token in Authorization header.' });
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
    const {
        hexagons,
        category
    } = req.body || {};

    // require either hexagons or center/radius
    if ((!Array.isArray(hexagons) || hexagons.length === 0) && (radius == null || center_x == null || center_y == null)) {
        return res.status(422).json({ error: 'Provide `hexagons` or radius, center_x and center_y in the request body' });
    }

    // Token can be provided via Authorization header (Bearer ...) or from environment variables.
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ error: 'ArcGIS token is required. Set ARC_API_KEY in the backend environment or provide a Bearer token in Authorization header.' });
    }
    const settings = catchmentService.getSettingsForCategory(category);

    try {
        const result = await demandController.runDemand({ settings, hexagons, token });
        
        // Per request: compute demand indicator but return the generated hexagons only (with centroids)
        res.status(200).json(result);
    } catch (err) {
        console.error('Demand processing failed:', err);
        res.status(500).json({ error: 'Demand processing failed', detail: String(err) });
    }
});

// POST /analysis/workflow
// body: { radius, center_x?, center_y?, locationName?, currentLocation?, nearbyMe?, category, maxCount?, token? }
router.post('/analysis/workflow', async (req, res) => {
    const {
        radius,
        locationName,
        currentLocation,
        nearbyMe,
        category,
        maxCount,
        analysisId,
        chatId,
        userId,
        weights,
    } = req.body || {};
    
    // Validate userId is provided
    if (!userId) {
        return res
            .status(422)
            .json({ error: "userId is required in the request body" });
    }
    
    // Token can be provided via Authorization header (Bearer ...) or from environment variables.
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({
            error: "ArcGIS token is required. Set ARC_API_KEY in the backend environment or provide a Bearer token in Authorization header.",
        });
    }

    // Validate radius
    if (radius == null) {
        return res.status(422).json({
            error: "radius is required in the request body",
        });
    }

    let coord;
    let finalLocationName; // Add this variable
    
    // Case 1: nearbyMe is true - use currentLocation
    if (nearbyMe && currentLocation) {
        if (currentLocation.lat == null || currentLocation.lon == null || 
            isNaN(Number(currentLocation.lat)) || isNaN(Number(currentLocation.lon))) {
            return res.status(422).json({
                error: "currentLocation must include valid lat and lon fields",
            });
        }
        if (currentLocation.lat < -90 || currentLocation.lat > 90 || 
            currentLocation.lon < -180 || currentLocation.lon > 180) {
            return res.status(422).json({
                error: "currentLocation lat must be between -90 and 90 and lon must be between -180 and 180",
            });
        }
        coord = {
            location: {
                name: "Current Location",
                y: currentLocation.lat,
                x: currentLocation.lon,
            }
        };
        finalLocationName = "Current Location"; // Set name
        console.log("Using current location:", coord);
    } 
    // Case 2: nearbyMe is false - use locationName
    else if (!nearbyMe && locationName) {
        if (!locationName.trim().length) {
            return res.status(422).json({
                error: "locationName cannot be empty",
            });
        }
        coord = await arcgis.geocodeLocation(locationName);
        finalLocationName = coord.location.name || locationName; // Use geocoded name or fallback to input
        console.log("Geocoded location from name:", coord);
    }
    // Case 3: Invalid combination
    else {
        return res.status(422).json({
            error: "Either provide nearbyMe=true with currentLocation, or nearbyMe=false with locationName",
        });
    }
  
    try {
        const results = await workflowController.runWorkflow({
            radius: Number(radius),
            center_x: coord.location.x,
            center_y: coord.location.y,
            locationName: finalLocationName, // Pass the correct location name
            category,
            token,
            maxCount,
            analysis_id: analysisId,
            chat_id: chatId,
            user_id: userId,
            weightage: weights,
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
    const { hexagons, category } = req.body || {};

    // Token can be provided via Authorization header (Bearer ...) or from environment variables.
    const token = extractToken(req);

    if (!token) {
        return res.status(400).json({ error: 'ArcGIS Places API token is required. Set ARC_API_KEY/ARC_TOKEN in env or provide Authorization: Bearer <token>' });
    }

    try {
        const result = await poiController.runPOIScoring({ hexagons, category, token});
        res.status(200).json(result);
    } catch (err) {
        console.error('POI scoring failed:', err);
        res.status(500).json({ error: 'POI scoring failed', detail: String(err) });
    }
});

// POST /analysis/accessibility
// body: { radius, center_x, center_y, category, maxCount? }
router.post('/analysis/accessibility', async (req, res) => {
    const { hexagons, category } = req.body || {};

    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ error: 'ArcGIS token is required. Set ARC_API_KEY in env or provide an Authenticator/Authorization header.' });
    }

    try {
        const result = await accessibilityController.runAccessibility({ hexagons, category, token });
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
    const { hexagons, category } = req.body || {};

    try {
        // Force server-side token generation inside the controller/helper.
        // Do NOT accept token from client for this endpoint.
        const result = await riskController.runRiskAnalysis({ hexagons, category });
        res.status(200).json(result);
    } catch (err) {
        console.error('Risk processing failed:', err);
        res.status(500).json({ error: 'Risk processing failed', detail: String(err) });
    }
});

module.exports = router;


