// Centralized category map constants used by catchment and POI scoring
const CATEGORY_MAP = {
    retail: {
        sideLength: 150,  // 150 meters - creates ~260m wide hexagons
        riskRatio: 0.7,
        poiCategories: ["13000", "17000"], // Shopping, Food
    },
    healthcare: {
        sideLength: 200,  // 200 meters - creates ~350m wide hexagons
        riskRatio: 0.9,
        poiCategories: ["15000"], // Healthcare
    },
    education: {
        sideLength: 180,  // 180 meters
        riskRatio: 0.85,
        poiCategories: ["12000"], // Education
    },
    fnb: {
        sideLength: 120,  // 120 meters - smaller hexagons for F&B
        riskRatio: 0.6,
        poiCategories: ["13065"], // Food & Beverage
    },
    entertainment: {
        sideLength: 140,
        riskRatio: 0.5,
        poiCategories: ["10000"], // Arts & Entertainment
    },
    default: {
        sideLength: 150,
        riskRatio: 0.7,
        poiCategories: ["13000"],
    }
};

module.exports = CATEGORY_MAP;
