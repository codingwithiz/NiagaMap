const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();
const serviceAccount = require("../fyp-gis-24a89-firebase-adminsdk-fbsvc-faa0396f47.json");
const userService = require("../services/userService"); // Add this line

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

router.post("/verify", async (req, res) => {
  const { token } = req.body;
  try {
    const decoded = await admin.auth().verifyIdToken(token);

    // Create user in DB if not exists
    await userService.createUser({
      user_id: decoded.uid, // use Firebase UID as userId
      name: decoded.name || decoded.email || "", // fallback to email if name not present
      preferenceId: null, // or set a default/null value
    });

    res.json({ uid: decoded.uid, email: decoded.email });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
