const supabase = require("../supabase/supabase_client");

module.exports = {
    // Add a favourite for a user
    addFavourite: async (user_id, analysis_id, name = null) => {
        // Optional: check if the favourite already exists
        const { data: existing, error: fetchError } = await supabase
            .from("favourites")
            .select("*")
            .eq("user_id", user_id)
            .eq("analysis_id", analysis_id)
            .single();

        if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
        if (existing) return existing;

        // Insert favourite with name
        const { data, error } = await supabase
            .from("favourites")
            .insert([{ 
                user_id, 
                analysis_id,
                name: name || `Analysis ${new Date().toLocaleDateString()}`
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Get all favourites for a user
    getFavourites: async (user_id) => {
        const { data, error } = await supabase
            .from("favourites")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    },

    removeFavourite: async (user_id, analysis_id) => {
        const { data, error } = await supabase
            .from("favourites")
            .delete()
            .eq("user_id", user_id)
            .eq("analysis_id", analysis_id)
            .select();

        if (error) throw error;
        return data;
    },
};
