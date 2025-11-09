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
  console.log("Chatbot response:", response.choices[0].message.content);
  return response.choices[0].message.content;
}

async function generateReasoning({ userIntent, center, recommendations, category, weights }) {
  const { OpenAI } = require("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Helper to get top weighted indicators
  const sortedWeights = Object.entries(weights || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);
  
  const topIndicators = sortedWeights.length > 0
    ? sortedWeights.map(([key, val]) => `${key.charAt(0).toUpperCase() + key.slice(1)} (${val}%)`).join(" and ")
    : "balanced indicators";

  const REASONING_SYSTEM_PROMPT = `
You are a GIS assistant in Malaysia helping businesses choose ideal locations.

You are given:
- User's business intent and selected category: "${category}"
- Priority indicators: ${topIndicators}
- A central coordinate
- 3 recommended coordinates with suitability scores

Your task is to explain WHY each location is recommended, considering:
1. Its proximity to the central point (closer is better)
2. Its suitability score (0-100, higher is better)
3. Alignment with the selected business category: "${category}"
4. The user's priority indicators: ${topIndicators}

Each explanation must be 1–2 sentences and must reference:
- Distance from center ("very close", "moderately far", "farthest but viable")
- Score interpretation ("excellent score", "strong score", "moderate score")
- Why it suits the ${category} category

**Example reasoning formats:**
- "This location is very close to your search center and has an excellent suitability score of 89.1, making it ideal for ${category} with strong ${topIndicators}."
- "While moderately far from the center, this spot achieves a strong score of 82.5 due to high accessibility and good demand indicators, perfect for ${category}."
- "This location balances distance and opportunity with a score of 76.3, offering good zoning compliance and low competition for your ${category} business."

Respond ONLY with a valid JSON array (no markdown backticks):

[
  {
    "lat": 3.123,
    "lon": 101.678,
    "reason": "Your generated reasoning here..."
  },
  ...
]
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: REASONING_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          userIntent,
          center,
          recommendations,
          category,
          weights,
        }),
      },
    ],
    temperature: 0.3,
  });

  // Strip markdown block if any
  let content = response.choices[0].message.content;
  const match = content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (match) content = match[1];

  return content.trim();
}

module.exports = { askChatbot, generateReasoning };
