// src/context/AuthContext.js
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import api from "../api/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                try {
                    // ✅ Get the Firebase ID token
                    const token = await currentUser.getIdToken();
                    
                    // ✅ Call backend to verify token and create user in Supabase
                    const response = await api.post("/auth/verify", { token });
                    
                    console.log("Auth verify response:", response.data);
                    
                    // ✅ Merge Firebase user with backend response (includes name)
                    setUser({
                        ...currentUser,
                        displayName: response.data.name || currentUser.displayName,
                        dbName: response.data.name,  // Name from Supabase
                    });
                } catch (err) {
                    console.error("Error verifying user with backend:", err);
                    // Still set the user even if backend fails
                    setUser(currentUser);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
