const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();
const serviceAccount = require("../fyp-gis-24a89-firebase-adminsdk-fbsvc-faa0396f47.json");
const userService = require("../services/userService");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

router.post("/verify", async (req, res) => {
    const { token } = req.body;
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        console.log("=== AUTH VERIFY ===");
        console.log("Firebase UID:", decoded.uid);
        console.log("Email:", decoded.email);
        console.log("Display Name:", decoded.name);  // Check if this exists
        console.log("Full decoded token:", JSON.stringify(decoded, null, 2));  // Debug: see all fields

        // Get name from multiple possible sources
        const userName = decoded.name          // Google sign-in display name
            || decoded.displayName             // Alternative field
            || decoded.email?.split('@')[0]    // Email prefix (e.g., "john" from "john@gmail.com")
            || "User";                         // Fallback

        console.log("Using name:", userName);

        // Check if user already exists
        let existingUser = null;
        try {
            existingUser = await userService.getUserById(decoded.uid);
            console.log("User exists:", existingUser ? "Yes" : "No");
        } catch (err) {
            console.log("User lookup returned null or error - will create new user");
        }

        // Create user in DB if not exists
        if (!existingUser) {
            console.log("Creating new user in database...");
            try {
                const newUser = await userService.createUser({
                    userId: decoded.uid,
                    name: userName,  // ✅ Use the properly extracted name
                    default_prompt: null,
                    theme: "light",
                });
                console.log("✅ New user created successfully:", newUser?.user_id, "Name:", newUser?.name);
            } catch (createErr) {
                console.error("❌ Error creating user:", createErr.message);
            }
        } else {
            console.log("✅ User already exists in database");
            
            // ✅ Optional: Update name if it was "User" and now we have a real name
            if (existingUser.name === "User" && userName !== "User") {
                console.log("Updating user name from 'User' to:", userName);
                try {
                    await userService.updateUser(decoded.uid, { name: userName });
                } catch (updateErr) {
                    console.error("Failed to update user name:", updateErr.message);
                }
            }
        }

        console.log("=== AUTH VERIFY COMPLETE ===");
        res.json({ uid: decoded.uid, email: decoded.email, name: userName });
    } catch (err) {
        console.error("Token verification error:", err);
        res.status(401).json({ error: "Invalid token" });
    }
});

module.exports = router;
