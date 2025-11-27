export const API = "http://localhost:3001";

export const CATEGORY_PRESETS = {
  retail: { label: "Retail", weights: { demand: 30, competition: 20, accessibility: 25, zoning: 15, risk: 10 } },
  fnb: { label: "Food & Beverage", weights: { demand: 25, competition: 25, accessibility: 25, zoning: 15, risk: 10 } },
  health: { label: "Health & Wellness", weights: { demand: 30, competition: 15, accessibility: 20, zoning: 25, risk: 10 } },
  automotive: { label: "Automotive", weights: { demand: 20, competition: 25, accessibility: 30, zoning: 15, risk: 10 } },
  sports: { label: "Sports & Recreation", weights: { demand: 30, competition: 20, accessibility: 25, zoning: 15, risk: 10 } },
};

export const INDICATOR_LABELS = {
  demand: "Demand",
  competition: "Competition",
  accessibility: "Accessibility",
  zoning: "Zoning/Context",
  risk: "Risk/Hazard",
};

export const INDICATOR_DESCRIPTIONS = {
  demand: "Population density & target demographics",
  competition: "Density of similar businesses",
  accessibility: "Roads, transport & connectivity",
  zoning: "Legal & regulatory compliance",
  risk: "Environmental & disaster vulnerability",
};

export const LOCATION_KEYWORDS = ['in', 'at', 'near', 'around', 'dekat', 'di'];
export const NEAR_ME_PATTERNS = ['near me', 'around me', 'dekat saya', 'my location'];