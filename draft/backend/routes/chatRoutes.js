// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const chatService = require("../services/chatService");


// Create a new chat
/*
{
  "title": "Startup Chat",
  "thread_id": "thread_56789",
  "userId": "user_002",
  "conversation": [
    {
      "user_prompt": "What are some good business ideas for students?",
      "bot_answer": "You could start a campus food delivery app, a tutoring service, or a study tool."
    },
    {
      "user_prompt": "How to validate a business idea?",
      "bot_answer": "You can start by creating an MVP, talking to potential customers, and getting feedback."
    }
  ]
}
  */
router.post("/", async (req, res) => {
    
    const chat = await chatService.createChat(req.body);
    res.json(chat);
});

router.put("/:chat_id/messages", async (req, res) => {
    const { chat_id } = req.params;
    const { user_prompt, bot_answer } = req.body;

    try {
        const updatedChat = await chatService.addMessage(chat_id, user_prompt, bot_answer);
        res.json(updatedChat);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all chats for a user
router.get("/user/:user_id", async (req, res) => {
    const chats = await chatService.getChatsByUserId(req.params.user_id);
    res.json(chats);
});

// Get a chat by ID
router.get("/:chat_id", async (req, res) => {
    const chat = await chatService.getChatById(req.params.chat_id);
    res.json(chat);
});

// Get all conversations for a chat
router.get('/:chat_id/conversations', async (req, res) => {
    const { chat_id } = req.params;
    try {
        const conversations = await chatService.getConversationsByChatId(chat_id);
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a chat's title
router.patch("/:chat_id", async (req, res) => {
    const updated = await chatService.updateChatTitle(
        req.params.chat_id,
        req.body.title
    );
    res.json(updated);
});

// Delete a chat and its conversations
router.delete("/:chat_id", async (req, res) => {
    await chatService.deleteChat(req.params.chat_id);
    res.status(204).send();
});


module.exports = router;
