const sql = require("mssql");
const supabase = require("../supabase/supabase_client"); // adjust your path

async function createAnalysis({ userId, referencePointId, chatId }) {
    const { data, error } = await supabase
        .from("analysis")
        .insert({
            user_id: userId,
            reference_point_id: referencePointId,
            chat_id: chatId,
        })
        .select("*");

    if (error) throw new Error("Failed to create analysis: " + error.message);

    return data[0];
}

module.exports = { createAnalysis };


async function getUserAnalysesWithDetails(userId) {
    // Supabase version: fetch analyses, reference points, and recommended locations
    try {
        // 1. Get all analyses for the user
        const { data: analysesData, error: analysesError } = await supabase
            .from("analysis")
            .select("*")
            .eq("user_id", userId);
        if (analysesError) throw analysesError;

        // 2. Get all reference points for these analyses
        const referencePointIds = analysesData.map(a => a.reference_point_id).filter(Boolean);
        let referencePointsMap = {};
        if (referencePointIds.length > 0) {
            const { data: refPoints, error: refError } = await supabase
                .from("reference_point")
                .select("*")
                .in("point_id", referencePointIds);
            if (refError) throw refError;
            referencePointsMap = Object.fromEntries(refPoints.map(rp => [rp.point_id, rp]));
        }

        // 3. Get all recommended locations for these analyses
        const analysisIds = analysesData.map(a => a.analysis_id);
        let recommendedLocationsMap = {};
        if (analysisIds.length > 0) {
            const { data: recLocs, error: recLocsError } = await supabase
                .from("recommended_location")
                .select("*")
                .in("analysis_id", analysisIds);
            if (recLocsError) throw recLocsError;
            for (const loc of recLocs) {
                if (!recommendedLocationsMap[loc.analysis_id]) recommendedLocationsMap[loc.analysis_id] = [];
                recommendedLocationsMap[loc.analysis_id].push({
                    locationId: loc.location_id,
                    lat: loc.lat,
                    lon: loc.lon,
                    score: loc.score,
                    reason: loc.reason,
                    ai_reason: loc.ai_reason,
                });
            }
        }

        // 4. Assemble the result
        const analyses = analysesData.map(a => ({
            analysisId: a.analysis_id,
            chatId: a.chat_id,
            createdAt: a.created_at,
            referencePoint: a.reference_point_id && referencePointsMap[a.reference_point_id] ? {
                referencePointId: a.reference_point_id,
                name: referencePointsMap[a.reference_point_id].name,
                lat: referencePointsMap[a.reference_point_id].lat,
                lon: referencePointsMap[a.reference_point_id].lon,
            } : null,
            recommendedLocations: recommendedLocationsMap[a.analysis_id] || [],
        }));

        console.log("Fetch Analysis Data: ", analyses[0])
        return analyses;
    } catch (err) {
        throw new Error("Failed to get user analyses: " + err.message);
    }
}

async function updateAnalysisReferencePoint(analysisId, name, lat, lon ) {
    // Supabase version: update reference point for an analysis
    try {
        // 1. Get the analysis to find reference_point_id
        const { data: analysis, error: analysisError } = await supabase
            .from("analysis")
            .select("reference_point_id")
            .eq("analysis_id", analysisId)
            .single();
        if (analysisError || !analysis) throw new Error("Analysis not found.");
        const referencePointId = analysis.reference_point_id;

        // 2. Update the reference_point table
        const { error: updateError } = await supabase
            .from("reference_point")
            .update({ name, lat, lon })
            .eq("point_id", referencePointId);
        if (updateError) throw updateError;
    } catch (err) {
        throw new Error("Failed to update reference point: " + err.message);
    }
}


async function deleteAnalysis(analysisId) {
    // Supabase version: delete recommended locations, analysis, and reference point
    try {
        // 1. Get the analysis to find reference_point_id
        const { data: analysis, error: analysisError } = await supabase
            .from("analysis")
            .select("reference_point_id")
            .eq("analysis_id", analysisId)
            .single();
        if (analysisError || !analysis) throw new Error("Analysis not found.");
        const referencePointId = analysis.reference_point_id;

        // 2. Delete recommended locations
        const { error: recLocsError } = await supabase
            .from("recommended_location")
            .delete()
            .eq("analysis_id", analysisId);
        if (recLocsError) throw recLocsError;

        // 3. Delete the analysis
        const { error: analysisDelError } = await supabase
            .from("analysis")
            .delete()
            .eq("analysis_id", analysisId);
        if (analysisDelError) throw analysisDelError;

        // 4. Delete the reference point
        const { error: refPointDelError } = await supabase
            .from("reference_point")
            .delete()
            .eq("point_id", referencePointId);
        if (refPointDelError) throw refPointDelError;

        return {
            success: true,
            message: "Analysis and related data deleted successfully.",
        };
    } catch (err) {
        throw new Error("Failed to delete analysis: " + err.message);
    }
}


module.exports = { createAnalysis, getUserAnalysesWithDetails, updateAnalysisReferencePoint, deleteAnalysis };
