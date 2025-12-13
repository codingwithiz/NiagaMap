import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import { updateProfile, updatePassword } from "firebase/auth";
import api from "../api/api";

const Profile = ({darkMode = false}) => {
    const { user } = useAuth();
    const [name, setName] = useState(user?.displayName || "");
    const [email] = useState(user?.email || "");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Outer container for full viewport height
    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: darkMode ? "#1f2937" : "#f9fafe" }}>
            <ProfileCard
                user={user}
                name={name}
                setName={setName}
                email={email}
                password={password}
                setPassword={setPassword}
                message={message}
                setMessage={setMessage}
                error={error}
                setError={setError}
                darkMode={darkMode}
            />
        </div>
    );
};

// The original profile card UI moved to a new component
const ProfileCard = ({ user, name, setName, email, password, setPassword, message, setMessage, error, setError, darkMode }) => {

    // Update name in Firebase and Supabase
    const handleUpdateName = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");
        try {
            await updateProfile(auth.currentUser, { displayName: name });
            await api.put(`/users/${user.uid}`, { name });
            setMessage("Name updated successfully!");
        } catch (err) {
            setError("Failed to update name: " + err.message);
        }
    };

    // Update password in Firebase
    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");
        try {
            await updatePassword(auth.currentUser, password);
            setMessage("Password updated successfully!");
            setPassword("");
        } catch (err) {
            setError("Failed to update password: " + err.message);
        }
    };

    return (
        <div
            style={{
                maxWidth: 420,
                width: "100%",
                margin: "0 auto",
                padding: "32px 32px 24px 32px",
                background: darkMode ? "#1f2937" : "#f9fafe",
                borderRadius: 18,
                boxShadow: "0 4px 24px rgba(25, 118, 210, 0.10)",
                border: `1px solid ${darkMode ? "#374151" : "#e0e0e0"}`,
            }}
        >
            <h2
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 700,
                    fontSize: 26,
                    marginBottom: 24,
                    color: "#1976d2",
                    letterSpacing: 1,
                }}
            >
                <span role="img" aria-label="profile">
                    👤
                </span>{" "}
                Profile
            </h2>
            <form onSubmit={handleUpdateName} style={{ marginBottom: 32 }}>
                <label
                    style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 6,
                        color: darkMode ? "#d1d5db" : "#333",
                        fontSize: 15,
                    }}
                >
                    Name:
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 8,
                        border: "1.5px solid #cfd8dc",
                        fontSize: 16,
                        marginBottom: 18,
                        background: darkMode ? "#374151" : "#fff",
                        color: darkMode ? "#d1d5db" : "#222",
                        outline: "none",
                        transition: "border 0.2s",
                    }}
                    onFocus={(e) =>
                        (e.target.style.border = `1.5px solid ${
                            darkMode ? "#fff" : "#1976d2"
                        }`)
                    }
                    onBlur={(e) =>
                        (e.target.style.border = "1.5px solid #cfd8dc")
                    }
                />
                <label
                    style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 6,
                        color: darkMode ? "#d1d5db" : "#333",
                        fontSize: 15,
                    }}
                >
                    Email:
                </label>
                <input
                    type="email"
                    value={email}
                    disabled
                    style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 8,
                        border: "1.5px solid #e0e0e0",
                        fontSize: 16,
                        marginBottom: 18,
                        background: darkMode ? "#374151" : "#fff",
                        color: darkMode ? "#d1d5db" : "#222",
                        cursor: "not-allowed",
                    }}
                />
                <button
                    type="submit"
                    style={{
                        padding: "12px 0",
                        width: "100%",
                        background: "#1976d2",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 16,
                        marginTop: 4,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(25, 118, 210, 0.08)",
                        transition: "background 0.2s",
                    }}
                    onMouseOver={(e) =>
                        (e.currentTarget.style.background = "#1251a3")
                    }
                    onMouseOut={(e) =>
                        (e.currentTarget.style.background = "#1976d2")
                    }
                >
                    Update Name
                </button>
            </form>
            <form onSubmit={handleUpdatePassword}>
                <label
                    style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 6,
                        color: darkMode ? "#d1d5db" : "#333",
                        fontSize: 15,
                    }}
                >
                    New Password:
                </label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 8,
                        border: "1.5px solid #cfd8dc",
                        fontSize: 16,
                        marginBottom: 18,
                        background: darkMode ? "#374151" : "#fff",
                        color: darkMode ? "#d1d5db" : "#222",
                        outline: "none",
                        transition: "border 0.2s",
                    }}
                    onFocus={(e) =>
                        (e.target.style.border = `1.5px solid ${
                            darkMode ? "#fff" : "#1976d2"
                        }`)
                    }
                    onBlur={(e) =>
                        (e.target.style.border = "1.5px solid #cfd8dc")
                    }
                />
                <button
                    type="submit"
                    style={{
                        padding: "12px 0",
                        width: "100%",
                        background: "#1976d2",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 16,
                        marginTop: 4,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(25, 118, 210, 0.08)",
                        transition: "background 0.2s",
                    }}
                    onMouseOver={(e) =>
                        (e.currentTarget.style.background = "#1251a3")
                    }
                    onMouseOut={(e) =>
                        (e.currentTarget.style.background = "#1976d2")
                    }
                >
                    Update Password
                </button>
            </form>
            {message && (
                <div
                    style={{
                        color: "#388e3c",
                        background: "#e8f5e9",
                        borderRadius: 8,
                        padding: "10px 16px",
                        marginTop: 18,
                        fontWeight: 500,
                        textAlign: "center",
                    }}
                >
                    {message}
                </div>
            )}
            {error && (
                <div
                    style={{
                        color: "#d32f2f",
                        background: "#ffebee",
                        borderRadius: 8,
                        padding: "10px 16px",
                        marginTop: 18,
                        fontWeight: 500,
                        textAlign: "center",
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    );
};

export default Profile;