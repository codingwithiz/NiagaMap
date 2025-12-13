const sql = require("mssql");
const supabase = require("../supabase/supabase_client");

async function createRecommendedLocations(locations, analysisId) {
    const transaction = new sql.Transaction();
    try {
        await transaction.begin();

        for (const loc of locations) {
            const locationId = `loc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            const recomRequest = new sql.Request(transaction);
            await recomRequest
                .input("locationId", sql.VarChar, locationId)
                .input("analysisId", sql.VarChar, analysisId)
                .input("lat", sql.Float, loc.lat)
                .input("lon", sql.Float, loc.lon)
                .input("score", sql.Float, loc.score)
                .input("reason", sql.Text, loc.reason)
                .query(`
                    INSERT INTO RecommendedLocation (locationId, analysisId, lat, lon, score, reason)
                    VALUES (@locationId, @analysisId, @lat, @lon, @score, @reason);
                `);
        }

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        console.error("Transaction failed in createRecommendedLocations:", err);
        throw err;
    }
}

async function saveRecommendedLocation(analysisId, lat, lon, score, breakdown) {
    try {
        console.log("Attempting to save recommended location:", {
            analysis_id: analysisId,
            lat,
            lon,
            score,
            breakdown
        });

        const { data, error } = await supabase
            .from("recommended_location")
            .insert({
                analysis_id: analysisId,
                lat: lat,
                lon: lon,
                score: score,
                reason: breakdown, // Changed from 'breakdown' to 'reason'
            })
            .select();

        if (error) {
            console.error("Supabase insert error:", error);
            throw error;
        }

        console.log("Successfully saved location:", data);
        return data;
    } catch (error) {
        console.error("Error in saveRecommendedLocation:", error);
        throw error;
    }
}

module.exports = { createRecommendedLocations, saveRecommendedLocation };