// Centralized category map constants used by catchment and POI scoring
const CATEGORY_MAP = {
    retail: {
        demand_threshold: 4000,
        competition_threshold: 6,
        accessibility_threshlold: 400,
        risk_threshold: 0.5,
        sideLength: 150, // 150 meters - creates ~260m wide hexagons
    },
    healthcare: {
        demand_threshold: 3000,
        competition_threshold: 4,
        accessibility_threshlold: 300,
        risk_threshold: 0.5,
        sideLength: 150,
    },
    fnb: {
        demand_threshold: 2000,
        competition_threshold: 5,
        accessibility_threshlold: 300,
        risk_threshold: 0.5,
        sideLength: 150, // 120 meters - smaller hexagons for F&B
    },
    automotive: {
        demand_threshold: 1500,
        competition_threshold: 5,
        accessibility_threshlold: 500,
        risk_threshold: 0.5,
        sideLength: 150, // 120 meters - smaller hexagons for F&B
    },
    sports: {
        demand_threshold: 2000,
        competition_threshold: 4,
        accessibility_threshlold: 400,
        risk_threshold: 0.5,
        sideLength: 150, // 120 meters - smaller hexagons for F&B
    },
    default: {
        demand_threshold: 4000,
        competition_threshold: 6,
        accessibility_threshlold: 400,
        risk_threshold: 0.5,
        sideLength: 150,
    },
};

module.exports = CATEGORY_MAP;
