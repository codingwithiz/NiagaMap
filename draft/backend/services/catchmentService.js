const defineHex = require('../utils/defineHexagons');
const CATEGORY_MAP = require('../constants/categoryMap');
const supabase = require("../supabase/supabase_client");

function getSettingsForCategory(category) {
    return CATEGORY_MAP[category] || CATEGORY_MAP['default'];
}

function generateCatchmentHexagons(center_x, center_y, radius, sideLength) {
    return defineHex.generateHexagonsCoordinates(
        center_x,
        center_y,
        radius,
        sideLength
    );
}

async function saveSingleHexagonToDatabase(hexagon, index, analysisId) {
    const record = {
        analysis_id: analysisId,
        hex_index: index,
        coordinates: hexagon,
    };

    const { data, error } = await supabase.from("hexagon").insert(record).select("*");

    if (error) throw error;
    return data[0];
}

module.exports = {
    getSettingsForCategory,
    generateCatchmentHexagons,
    saveSingleHexagonToDatabase,
};