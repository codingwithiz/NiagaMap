require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

// Routes
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const authRoutes = require("./routes/auth");
const chatbotRoute = require("./routes/chatbot");
const analysisRoute = require("./routes/analysisRoute");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = process.env.PORT || 3001;
const app = express();

app.use(express.json());
app.use(
    cors({
        origin: ["http://localhost:5173", "http://localhost:5174"],
        credentials: true,
    })
);

// ----------------------------
// Routes
// ----------------------------
app.use("/users", userRoutes);
app.use("/chats", chatRoutes);
app.use("/conversations", conversationRoutes);
app.use("/auth", authRoutes);
app.use(chatbotRoute);
app.use(analysisRoute);

// ----------------------------
// Example: CRUD for Users
// ----------------------------

// READ all users
app.get("/users", async (req, res) => {
    try {
        const { data, error } = await supabase.from("users").select("*");
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send(err.message);
    }
});

// CREATE user
app.post("/users", async (req, res) => {
    try {
        const { user_id, name, preference_id } = req.body; // match your Supabase schema
        const { data, error } = await supabase
            .from("users")
            .insert([{ user_id, name, preference_id }])
            .select("*");
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        console.error("Error creating user:", err);
        res.status(500).send(err.message);
    }
});

// ----------------------------
// Example: Analyze location
// ----------------------------
app.post("/analyze-location", async (req, res) => {
    const { userInput } = req.body;

    try {
        // Mocked logic or call OpenAI API
        const intent = extractIntent(userInput);
        const universityCoords = await findUniversities();

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

// ----------------------------
// Start server
// ----------------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));