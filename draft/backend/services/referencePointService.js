const supabase = require("../supabase/supabase_client"); // adjust your path

async function createReferencePoint({ name, lat, lon }) {
    const record = {
        name,
        lat,
        lon,
    };

    const { data: refData , error } = await supabase.from("reference_point").insert(record).select("*");

    if (error) {
        throw new Error("Failed to create reference point: " + error.message);
    }

    return refData[0];
}

module.exports = { createReferencePoint };
