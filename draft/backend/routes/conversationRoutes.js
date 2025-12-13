const express = require("express");
const router = express.Router({ mergeParams: true });
const conversationService = require("../services/conversationService");

// Get conversations for a chat
router.get("/:chat_id", async (req, res) => {
    const { chat_id } = req.params;
    try {
        const conversations = await conversationService.getConversationsByChatId(chat_id);
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new conversation
router.post("/:chat_id", async (req, res) => {
    const { chat_id } = req.params;
    const { user_prompt, bot_answer } = req.body;
    try {
        const conversation = await conversationService.addConversation(
            chat_id,
            user_prompt,
            bot_answer
        );
        res.status(201).json(conversation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update conversation with analysis_id
router.patch("/:conversation_id", async (req, res) => {
    const { conversation_id } = req.params;
    const { analysis_id } = req.body;
    try {
        const updated = await conversationService.updateAnalysisId(
            conversation_id,
            analysis_id
        );
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
