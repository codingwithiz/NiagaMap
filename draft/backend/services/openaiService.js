const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function askChatbot(message) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `
You are a precise and structured assistant for a GIS-based business location recommendation system in Malaysia.

The user input will be in this format:
\`\`\`
Category: [Business Category]
Indicator Weights:
- Demand: X%
- Competition: Y%
- Accessibility: Z%
- Zoning/Context: W%
- Risk/Hazard: V%

User Message: [Natural language query]
\`\`\`

Your task is to extract relevant parameters and return a JSON object with the following keys:

1. "location": A real-world place or area mentioned in the User Message (e.g., "Universiti Malaya", "Subang Jaya", "Bangsar"). If "near me" or similar phrases are used, set this to null.

2. "category": **ALWAYS use the Category field provided at the top of the input.** Map it to one of these values:
   - "Retail" → "retail"
   - "Food & Beverage" → "food"
   - "Health & Wellness" → "health"
   - "Sports & Recreation" → "sports"
   - "Automotive" → "workshop"
   Do NOT infer category from the User Message. The user has already selected the category.

3. "radius": The search radius in meters. If the User Message specifies distance (e.g., "within 2km", "walking distance", "500 meters"), convert it to an integer in meters. Default to 1000 if not mentioned.

4. "nearbyMe": Set to true if the User Message refers to current location using phrases like "near me", "around me", "dekat saya", "my location". Otherwise, set to false.

5. "weights": Extract the weights from the "Indicator Weights" section as an object:
   {
     "demand": 30,
     "competition": 20,
     "accessibility": 25,
     "zoning": 15,
     "risk": 10
   }

6. "reason": A 2-3 sentence explanation acknowledging:
   - The selected category
   - The location being searched
   - The weight priorities (mention the highest weighted indicator)
   Example: "You've selected the Retail category with high emphasis on Demand (30%) and Accessibility (25%). We will analyze suitable locations near Universiti Malaya within a 1km radius for opening a retail business."

**Important Rules:**
- ALWAYS use the Category field provided, NOT the business type mentioned in User Message
- If User Message says "car repair shop" but Category is "Retail", the category must be "retail"
- Accept both English and Malay language inputs
- Return ONLY the JSON object, no extra text

**Example:**

Input:
\`\`\`
Category: Retail
Indicator Weights:
- Demand: 30%
- Competition: 20%
- Accessibility: 25%
- Zoning/Context: 15%
- Risk/Hazard: 10%

User Message: where should I open my car repair shop in universiti malaya
\`\`\`

Output:
\`\`\`json
{
  "location": "Universiti Malaya",
  "category": "retail",
  "radius": 1000,
  "nearbyMe": false,
  "weights": {
    "demand": 30,
    "competition": 20,
    "accessibility": 25,
    "zoning": 15,
    "risk": 10
  },
  "reason": "You've selected the Retail category with high emphasis on Demand (30%) and Accessibility (25%). We will analyze suitable locations near Universiti Malaya within a 1km radius for opening a retail business, even though you mentioned a car repair shop."
}
\`\`\`

Always return a clean, parsable JSON object.
        `,
      },
      {
        role: "user",
        content: message, // enrichedMessage from frontend
      },
    ],
    temperature: 0.2,
  });
  
  return response.choices[0].message.content;
}

async function generateLocationReasoning({ locations, category, weights, referencePoint }) {
  const sortedWeights = Object.entries(weights || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);
  
  const topIndicators = sortedWeights.length > 0
    ? sortedWeights.map(([key, val]) => `${key.charAt(0).toUpperCase() + key.slice(1)} (${val}%)`).join(" and ")
    : "balanced indicators";

  const REASONING_SYSTEM_PROMPT = `
You are a professional GIS business location analyst in Malaysia. Explain why each location is suitable for the ${category} business.

**Given Data:**
- Business category: "${category}"
- User's priorities: ${topIndicators}
- Reference point: ${referencePoint?.name || "User's location"}

**5 Key Indicators:**

**1. Demand (0-20 points)**
- score: Final weighted score
- population: Actual resident count in area
→ Higher population = More customers

**2. POI - Points of Interest (0-20 points)**
- score: Final weighted score  
- count: Number of complementary businesses nearby
→ More POIs = Better foot traffic and ecosystem

**3. Risk (0-20 points) - IMPORTANT**
- score: Final safety score (higher = safer)
- floodAreaHa: Flood-prone area in hectares
- landslideCount: Number of landslide zones
- hasLandslide: Boolean
- riskRatio: Score penalty ratio (default 0.8)

**Risk Scoring Logic:**
- Base score: 20 points (perfect safety)
- If floodAreaHa > 0: Deduct based on flood severity
- If landslideCount > 0: Deduct based on landslide presence
- Formula: score = 20 - (floodPenalty + landslidePenalty) × riskRatio

**How to Interpret:**
- score 20: Perfect - no floods, no landslides
- score 16: Good - minor risk (1 hazard present)
- score 10-15: Moderate - some risk concerns
- score < 10: High risk - multiple hazards

**4. Accessibility (0-20 points)**
- score: Final weighted score
- distanceMeters: Distance to nearest major road
→ Lower distance = Better access

**5. Zoning (0-20 points)**
- score: Final weighted score
- landuse: Land use type (e.g., "commercial", "residential")
→ Appropriate zoning = Legal compliance

**Your Task:**
For each location, write 3-4 sentences explaining:

1. **Overall Assessment** (based on total score):
   - 80-100: "Exceptional location"
   - 60-79: "Strong candidate"  
   - 40-59: "Moderate potential"
   - 20-39: "Limited suitability"

2. **Highlight Strengths** with specific numbers:
   - Demand: "serves {X} residents"
   - POI: "{X} nearby businesses"
   - Risk: "excellent safety (no hazards)" OR "safe with minor {floodAreaHa}ha flood zone"
   - Accessibility: "just {X}m from main road"
   - Zoning: "zoned as {landuse}"

3. **Address Concerns** honestly:
   - Low demand: "limited to {X} residents"
   - Low POI: "developing area ({X} businesses)"
   - Risk issues: "{floodAreaHa}ha flood zone" OR "{landslideCount} landslide areas" 
   - Poor access: "{X}m from road may limit traffic"
   - Zoning: "verify permits for {landuse} zone"

4. **Relate to business**: Connect data to ${category} needs

**Style:**
- Use concrete numbers from data
- Be professional and conversational
- Positive but honest about risks
- Make it actionable

**Example:**
Input:
{
  "score": 52.5,
  "breakdown": {
    "demand": { "score": 2.5, "population": 140 },
    "poi": { "score": 20, "count": 12 },
    "risk": { "score": 16, "floodAreaHa": 0.5, "landslideCount": 0, "hasLandslide": false, "riskRatio": 0.8 },
    "accessibility": { "score": 4, "distanceMeters": 650 },
    "zoning": { "score": 10, "landuse": "commercial" }
  }
}

Output:
"This moderate-potential location (52.5) excels with 12 complementary businesses creating a vibrant commercial area, perfect for ${category}. The site serves 140 residents with good safety (risk score 16) despite a minor 0.5-hectare flood zone that's well-managed. However, it's 650 meters from the main road which may affect visibility, so invest in signage and digital marketing to attract customers."

Return ONLY a valid JSON array: [{ lat, lon, score, breakdown, reason }]
No markdown formatting.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: REASONING_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          locations,
          category,
          weights,
          referencePoint,
        }),
      },
    ],
    temperature: 0.4,
  });

  let content = response.choices[0].message.content;
  const match = content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (match) content = match[1];

  return JSON.parse(content.trim());
}

module.exports = { askChatbot, generateLocationReasoning };
