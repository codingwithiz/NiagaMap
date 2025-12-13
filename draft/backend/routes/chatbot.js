// routes/chatbot.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { askChatbot, generateReasoning } = require("../services/openaiService");

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/**
 * Helper function to clean JSON response from OpenAI
 * Removes markdown code blocks and extracts pure JSON
 */
function cleanJsonResponse(response) {
  let cleaned = response.trim();
  
  // Remove opening ```json or ```
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/, '');
  
  // Remove closing ```
  cleaned = cleaned.replace(/\s*```$/, '');
  
  return cleaned.trim();
}

// Parse user message to extract parameters
router.post("/api/chatbot", async (req, res) => {
  try {
    const { message } = req.body;
    console.log("Parsing message:", message);
    
    const response = await askChatbot(message);
    console.log("Raw OpenAI response:", response);
    
    // Clean the response before parsing
    const cleanedResponse = cleanJsonResponse(response);
    console.log("Cleaned response:", cleanedResponse);
    
    const parsed = JSON.parse(cleanedResponse);
    
    console.log("Parsed result:", parsed);
    res.json(parsed);
  } catch (err) {
    console.error("Chatbot parsing error:", err);
    console.error("Failed to parse response:", err.message);
    res.status(500).json({ 
      error: "Failed to parse chatbot response",
      detail: err.message 
    });
  }
});

// Generate reasoning for analysis results
router.post("/api/chatbot/reasoning", async (req, res) => {
  try {
    const { userIntent, center, recommendations, category, weights } = req.body;
    
    console.log("Generating reasoning for:", {
      userIntent,
      center,
      recommendationsCount: recommendations?.length,
      category,
      weights
    });

    const reasoning = await generateReasoning({
      userIntent,
      center,
      recommendations,
      category,
      weights
    });

    console.log("Raw reasoning response:", reasoning);
    
    // Clean the response before parsing
    const cleanedReasoning = cleanJsonResponse(reasoning);
    console.log("Cleaned reasoning:", cleanedReasoning);
    
    const parsed = JSON.parse(cleanedReasoning);
    console.log("Generated reasoning:", parsed);
    
    res.json(parsed);
  } catch (err) {
    console.error("Reasoning generation error:", err);
    res.status(500).json({ 
      error: "Failed to generate reasoning",
      detail: err.message 
    });
  }
});

// File upload endpoint (if you need it)
router.post("/api/chatbot/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    res.json({
      message: "File uploaded successfully",
      filename: req.file.filename,
      path: req.file.path
    });
  } catch (err) {
    console.error("File upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
