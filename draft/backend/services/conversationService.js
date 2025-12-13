const supabase = require("../supabase/supabase_client");

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
        throw new Error(`Error fetching conversations: ${err.message}`);
    }
};

exports.addConversation = async (chatId, user_prompt, bot_answer) => {
    try {
        const { data, error } = await supabase
            .from("conversation")
            .insert({
                chat_id: chatId,
                user_prompt,
                bot_answer
            })
            .select("*");

        if (error) throw error;
        return data[0];
    } catch (err) {
        throw new Error(`Error adding conversation: ${err.message}`);
    }
};

exports.updateAnalysisId = async (conversationId, analysisId) => {
    try {
        const { data, error } = await supabase
            .from("conversation")
            .update({ analysis_id: analysisId })
            .eq("conversation_id", conversationId)
            .select("*");

        if (error) throw error;
        return data[0];
    } catch (err) {
        throw new Error(`Error updating analysisId: ${err.message}`);
    }
};
