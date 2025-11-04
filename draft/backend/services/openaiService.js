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
You are a precise and structured assistant for a GIS-based business location recommendation system in Malaysia. Your task is to extract relevant parameters from user input written in natural language.

Your output must be a valid JSON object with the following keys:

1. "location": A real-world place or area mentioned in the input (e.g., "Universiti Malaya", "Subang Jaya", "Bangsar").
2. "category": The business type or intent, normalized to one of the following categories:
   - "health" (e.g., clinic, pharmacy, hospital)
   - "food" (e.g., cafe, restaurant, bubble tea)
   - "retail" (e.g., bookstore, clothing store, mall)
   - "sports" (e.g., gym, futsal court, recreation center)
   - "workshop" (e.g., car repair, bike repair, service center)
3. "radius": The search radius in meters. If the user specifies distance (e.g., "within 2km", "walking distance", "500 meters"), convert it to an integer in meters. If no radius is mentioned, default to 1000.
4. "nearbyMe": A boolean value. Set to true if the user refers to their current location using phrases like "near me", "around me", "dekat saya", "my location", or similar. Otherwise, set to false.
5. "reason": A short explanation (2-3 sentences) in natural language, summarizing the user's intent and what will be searched.

You must:
- Return only the JSON object with the five keys.
- Avoid extra text, explanations, or descriptions.
- Estimate reasonably if details are vague (e.g., interpret "walking distance" as 500 meters).
- Accept both English and Malay language inputs.
- Handle mixed language input (e.g., "Saya nak buka kedai dekat Bangsar within 1km").

If any value is missing, apply this fallback:
- radius: 1000
- category: "health"

Always return a clean, parsable JSON object. Your job is to provide data that can be passed directly to a backend API for GIS-based location scoring.
        `,
      },
      {
        role: "user",
        content: message, // this is dynamic, from frontend
      },
    ],
    temperature: 0.2,
  });

  return response.choices[0].message.content;
}

async function generateReasoning({ userIntent, center, recommendations }) {
  const { OpenAI } = require("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const REASONING_SYSTEM_PROMPT = `
You are a GIS assistant in Malaysia helping businesses choose ideal locations.
You are given the user's business intent, a central coordinate, and 3 recommended coordinates with suitability scores.

Your task is to explain in clear, concise sentences WHY each location is recommended, using:
- Its proximity to the central point
- Its score (higher = better)
- Its alignment with the user's intent

Each explanation must be 1–2 sentences and must vary based on the location's score and distance. Use real reasoning logic (e.g., “This point is closest”, “Moderately far but has high potential”).

Respond ONLY with a valid JSON array (no markdown):

[
  {
    "lat": 3.123,
    "lon": 101.678,
    "reason": "This location is very close to the center and has a high suitability score of 89.1, making it ideal for the user's business intent."
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
        }),
      },
    ],
    temperature: 0.2,
  });

  // Strip markdown block if any
  let content = response.choices[0].message.content;
  const match = content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (match) content = match[1];

  return content.trim();
}

module.exports = { askChatbot, generateReasoning };
