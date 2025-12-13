const express = require("express");
const router = express.Router();
const favouriteService = require("../services/favouriteService");

// POST /favourites
router.post("/", async (req, res) => {
    try {
        const { user_id, analysis_id, name } = req.body;
        const favourite = await favouriteService.addFavourite(
            user_id,
            analysis_id,
            name
        );
        res.status(201).json(favourite);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /favourites/:user_id
router.get("/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;
        const favourites = await favouriteService.getFavourites(user_id);
        res.status(200).json(favourites);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /favourites
router.delete("/", async (req, res) => {
    try {
        const { user_id, analysis_id } = req.body;
        const result = await favouriteService.removeFavourite(
            user_id,
            analysis_id
        );
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
