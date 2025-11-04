require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const sql = require("mssql");
const config = require("./database/dbConfig");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const authRoutes = require("./routes/auth");
const PORT = 3001;
const app = express();

app.use(express.json());
app.use(cors({ 
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true 
}));

app.use("/users", userRoutes);
app.use("/chats", chatRoutes);
app.use("/conversations", conversationRoutes);
app.use("/auth", authRoutes);

app.post("/analyze-location", async (req, res) => {
    const { userInput } = req.body;

    try {
        // Step 1: Extract criteria from user input (mocked or via OpenAI)
        const intent = extractIntent(userInput); // Optionally call OpenAI API

        // Step 2: Find university locations (Geocoding API)
        const universityCoords = await findUniversities();

        // Step 3–4: For each university, analyze
        const results = await Promise.all(
            universityCoords.map(async (uni) => {
                const competition = await countNearbyGyms(uni);
                const demographics = await getPopulationData(uni);
                const accessibility = await getTransitScore(uni);

                const score = computeSuitabilityScore({
                    competition,
                    demographics,
                    accessibility,
                });

                return {
                    location: uni,
                    score,
                    metadata: { competition, demographics, accessibility },
                };
            })
        );

        res.json({ results });
    } catch (err) {
        console.error("Error analyzing location:", err);
        res.status(500).send("Server Error");
    }
});

//places
app.post("/api/process-places", require("./routes/processPlaces"));

//suitability
app.post("/api/suitability", require("./routes/suitability"));

app.get("/api/suitability/:userId", require("./routes/suitability"));

//chatbot
const chatbotRoute = require("./routes/chatbot");
app.use(chatbotRoute);

const analysisRoute = require("./routes/analysisRoute");
app.use(analysisRoute);

//READ
app.get("/users", async (req, res) => {
    try {
        
        const result = await sql.query("SELECT * FROM Users");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

//CREATE
app.post("/users", async (req, res) => {
    try {
        const { userId, name, preferenceId } = req.body;
        
        await sql.query`INSERT INTO Users (userId, name, preferenceId) VALUES (${userId}, ${name}, ${preferenceId})`;
        res.status(201).send("User created");
    } catch (err) {
        res.status(500).send(err.message);
    }
});
  

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
sql.connect(config)
    .then(() => {
        console.log("✅ Connected to SQL Server");
        app.listen(PORT, () =>
            console.log(`🚀 Server running on port ${PORT}`)
        );
    })
    .catch((err) => {
        console.error("❌ Failed to connect to SQL Server:", err);
        process.exit(1); // Exit app if DB fails to connect
    });
// Mock logic below – Replace with real API logic
// function extractIntent(text) {
//     return {
//         near: "universities",
//         footTraffic: "high",
//         competition: "low",
//     };
// }

// async function findUniversities() {
//     return [
//         { name: "University A", latitude: 40.73061, longitude: -73.935242 },
//         { name: "University B", latitude: 40.7291, longitude: -73.9965 },
//     ];
// }

// async function findNearbyUniversities(lat, lon) {
//     const radius = 2000; // in meters
//     const esriUrl = `https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/categories`;

//     const response = await axios.get(esriUrl, {
//         headers: { Authorization: `Bearer ${ESRI_API_KEY}` },
//         params: {
//             categories: "4d4b7105d754a06377d81259",
//             lat,
//             lon,
//             radius,
//             limit: 10,
//         },
//     });

//     return response.data.results.map((place) => ({
//         name: place.name,
//         latitude: place.location.y,
//         longitude: place.location.x,
//         address: place.addresses?.[0]?.address || "No address",
//     }));
// }

// async function countNearbyGyms({ latitude, longitude }) {
//     // Use Google Places or Esri Places API
//     return Math.floor(Math.random() * 10); // Mock
// }

// async function getPopulationData({ latitude, longitude }) {
//     return Math.random(); // Mock: 0 to 1
// }

// async function getTransitScore({ latitude, longitude }) {
//     return Math.random(); // Mock: 0 to 1
// }

// function computeSuitabilityScore({ competition, demographics, accessibility }) {
//     return (
//         (1 - competition / 10) * 0.4 + demographics * 0.3 + accessibility * 0.3
//     );
// }


