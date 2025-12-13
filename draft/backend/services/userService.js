const supabase = require("../supabase/supabase_client");

module.exports = {
    // CREATE user + preference
    createUser: async (user) => {
        try {
            console.log("createUser called with:", { userId: user.userId, name: user.name });

            // Check if user already exists using maybeSingle (returns null instead of error)
            const { data: existingUser, error: checkError } = await supabase
                .from("users")
                .select("*")
                .eq("user_id", user.userId)
                .maybeSingle();

            // If user exists, return existing user
            if (existingUser) {
                console.log("User already exists, returning:", existingUser.user_id);
                return existingUser;
            }

            // Log if there was an error checking (but not "no rows" error)
            if (checkError) {
                console.log("Check error (non-fatal):", checkError.message);
            }

            console.log("Creating new preference...");

            // Insert preference first
            const { data: prefData, error: prefError } = await supabase
                .from("preferences")
                .insert([
                    {
                        default_prompt: user.default_prompt || null,
                        theme: user.theme || "light",
                    },
                ])
                .select();

            if (prefError) {
                console.error("Preference creation error:", prefError);
                throw prefError;
            }

            if (!prefData || prefData.length === 0) {
                throw new Error("Failed to create preference - no data returned");
            }

            console.log("Preference created with ID:", prefData[0].preference_id);
            console.log("Creating new user...");

            // Insert user with reference to preference
            const { data: newUserData, error: newUserError } = await supabase
                .from("users")
                .insert([
                    {
                        user_id: user.userId,
                        name: user.name || "User",
                        preference_id: prefData[0].preference_id,
                    },
                ])
                .select(`
                    *,
                    preferences:preferences(*)  
                `);

            if (newUserError) {
                console.error("User creation error:", newUserError);
                // Clean up preference if user creation fails
                await supabase
                    .from("preferences")
                    .delete()
                    .eq("preference_id", prefData[0].preference_id);
                throw newUserError;
            }

            if (!newUserData || newUserData.length === 0) {
                throw new Error("Failed to create user - no data returned");
            }

            console.log("✅ User created successfully:", newUserData[0].user_id);
            return newUserData[0];
        } catch (err) {
            console.error("createUser error:", err);
            throw err;
        }
    },

    // READ all users (with preference)
    getUsers: async () => {
        const { data, error } = await supabase.from("users").select(`
            *,
            preferences:preferences(*),
            favourites:favourites(*)
        `);

        if (error) throw error;
        return data;
    },

    // GET user by user_id (with preference)
    getUserById: async (user_id) => {
        const { data, error } = await supabase
            .from("users")
            .select(`
                *,
                preferences:preferences(*),
                favourites:favourites(*)  
            `)
            .eq("user_id", user_id)
            .maybeSingle();  // ✅ Use maybeSingle to return null instead of throwing error

        if (error) {
            console.error("getUserById error:", error);
            throw error;
        }

        return data;  // Returns null if not found
    },

    // UPDATE user + preference
    updateUser: async (user_id, data) => {
        try {
            // Find user
            const { data: existingUser, error: fetchError } = await supabase
                .from("users")
                .select(`
                    *,
                    preferences:preferences(*),
                    favourites:favourites(*)  
                `)
                .eq("user_id", user_id)
                .single();

            if (fetchError) throw fetchError;
            if (!existingUser) throw new Error("User not found");

            // Update preference if provided
            if (data.preference) {
                const { error: prefError } = await supabase
                    .from("preferences")
                    .update({
                        default_prompt: data.preference.default_prompt,
                        theme: data.preference.theme,
                    })
                    .eq("preference_id", existingUser.preferences.preference_id);

                if (prefError) throw prefError;
            }

            // Update user
            const { data: updatedUser, error: userError } = await supabase
                .from("users")
                .update({
                    name: data.name,
                })
                .eq("user_id", user_id)
                .select(`
                    *,
                    preferences:preferences(*),
                    favourites:favourites(*)
                `);

            if (userError) throw userError;

            return updatedUser[0];
        } catch (err) {
            throw err;
        }
    },

    // DELETE user + preference
    deleteUser: async (user_id) => {
        try {
            // Get user to find preference_id
            const { data: userData, error: fetchError } = await supabase
                .from("users")
                .select("*")
                .eq("user_id", user_id)
                .single();

            if (fetchError) throw fetchError;

            const preference_id = userData.preference_id;

            // Delete favourites first (due to foreign key)
            await supabase
                .from("favourites")
                .delete()
                .eq("user_id", user_id);

            // Delete user
            const { error: userError } = await supabase
                .from("users")
                .delete()
                .eq("user_id", user_id);

            if (userError) throw userError;

            // Delete preference
            await supabase
                .from("preferences")
                .delete()
                .eq("preference_id", preference_id);

            return { deletedUser: userData };
        } catch (err) {
            throw err;
        }
    },
};
