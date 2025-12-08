const supabase = require("../supabase/supabase_client"); // adjust path

// Create chat with conversations
exports.createChat = async (reqBody) => {
    const { title, thread_id, userId, conversation } = reqBody;
    console.log("Creating chat for userId:", userId);

    try {
        // Insert chat
        const { data: chatData, error: chatError } = await supabase
            .from("chat")
            .insert([
                {
                    title,
                    thread_id,
                    user_id: userId,
                },
            ])
            .select("*"); // return inserted row

        if (chatError) throw chatError;
        
        console.log("Chat created with ID:", chatData[0]);
        // Insert conversations in batch
        if (Array.isArray(conversation) && conversation.length > 0) {
            const conversationRecords = conversation.map(
                ({ user_prompt, bot_answer }) => ({
                    chat_id: chatData[0].chat_id,
                    user_prompt,
                    bot_answer,
                })
            );

            const { error: convError } = await supabase
                .from("conversation")
                .insert(conversationRecords);

            if (convError) throw convError;
        }

        return {
            chatId: chatData[0].chat_id,
            chatData: chatData[0],
            message: "chat and conversation(s) created successfully.",
        };
    } catch (err) {
        throw new Error(
            "Failed to create chat with conversations: " + err.message
        );
    }
};

// Add single message to an existing chat
exports.addMessage = async (chatId, user_prompt, bot_answer) => {
    try {
        const { data, error } = await supabase
            .from("conversation")
            .insert([
                {
                    chat_id: chatId,
                    user_prompt,
                    bot_answer,
                },
            ])
            .select("*"); // return inserted row

        if (error) throw error;

        console.log("Message added to conversation with ID:", data[0].conversation_id);

        return {
            conversationId: data[0].conversation_id,
            message: "Message added to conversation.",
        };
    } catch (error) {
        throw new Error("Failed to add message: " + error.message);
    }
};


// Get all chats by userId
exports.getChatsByUserId = async (userId) => {
    console.log("Fetching chats for userId:", userId);
    try {
        const { data, error } = await supabase
            .from("chat")
            .select("*")
            .eq("user_id", userId);

        if (error) throw error;

        return data;
    } catch (err) {
        throw new Error("Failed to retrieve chats: " + err.message);
    }
};

// Get single chat by chatId
exports.getChatById = async (chatId) => {
    try {
        const { data, error } = await supabase
            .from("chat")
            .select("*")
            .eq("chat_id", chatId)
            .single();

        if (error) throw error;

        return data;
    } catch (err) {
        throw new Error("Failed to retrieve chat: " + err.message);
    }
};

// Get all conversations for a chat
exports.getConversationsByChatId = async (chatId) => {
    try {
        const { data, error } = await supabase
            .from("conversation")
            .select("*")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true });

        if (error) throw error;

        return data;
    } catch (err) {
        throw new Error(`Error retrieving conversations: ${err.message}`);
    }
};

// Update chat title
exports.updateChatTitle = async (chatId, title) => {
    try {
        const { error } = await supabase
            .from("chat")
            .update({ title })
            .eq("chat_id", chatId);

        if (error) throw error;

        return { message: "chat updated" };
    } catch (err) {
        throw new Error("Failed to update chat: " + err.message);
    }
};

// Delete chat and its conversations
exports.deleteChat = async (chatId) => {
    try {
        // Delete conversations first
        const { error: convError } = await supabase
            .from("conversation")
            .delete()
            .eq("chat_id", chatId);
        if (convError) throw convError;

        // Delete chat
        const { error: chatError } = await supabase
            .from("chat")
            .delete()
            .eq("chat_id", chatId);
        if (chatError) throw chatError;

        return { message: "chat and conversations deleted" };
    } catch (err) {
        throw new Error("Failed to delete chat: " + err.message);
    }
};
