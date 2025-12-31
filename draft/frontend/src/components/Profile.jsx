import React, { useState, useRef } from "react";
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
    const [photoURL, setPhotoURL] = useState(user?.photoURL || "");

    // Outer container for full viewport height
    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: darkMode ? "#111827" : "#f3f6fb",
                padding: 0,
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 520,
                    margin: "0 auto",
                    padding: "40px 0",
                }}
            >
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
                    photoURL={photoURL}
                    setPhotoURL={setPhotoURL}
                />
            </div>
        </div>
    );
};

// The original profile card UI moved to a new component
const ProfileCard = ({ user, name, setName, email, password, setPassword, message, setMessage, error, setError, darkMode, photoURL, setPhotoURL }) => {
    const fileInputRef = useRef();

    // Update profile photo in Firebase and Supabase
    const handlePhotoChange = async (e) => {
        setMessage("");
        setError("");
        const file = e.target.files[0];
        if (!file) return;
        // For demo: use a local preview and update Firebase
        // In production: upload to storage and get a URL
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                // Update Firebase Auth profile
                await updateProfile(auth.currentUser, { photoURL: reader.result });
                setPhotoURL(reader.result);
                // Update backend (Supabase)
                await api.put(`/users/${user.uid}`, { photoURL: reader.result });
                setMessage("Profile photo updated!");
            } catch (err) {
                setError("Failed to update photo: " + err.message);
            }
        };
        reader.readAsDataURL(file);
    };

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
                maxWidth: 440,
                width: "100%",
                margin: "0 auto",
                padding: "36px 36px 28px 36px",
                background: darkMode ? "#181f2a" : "#fff",
                borderRadius: 22,
                boxShadow: darkMode
                    ? "0 6px 32px rgba(25, 118, 210, 0.13)"
                    : "0 6px 32px rgba(25, 118, 210, 0.10)",
                border: `1.5px solid ${darkMode ? "#232b3b" : "#e0e0e0"}`,
                position: "relative",
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
                <div style={{
                    width: 96,
                    height: 96,
                    borderRadius: "50%",
                    background: darkMode ? "#232b3b" : "#e3eaf6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 8px rgba(25, 118, 210, 0.10)",
                    border: `2.5px solid #1976d2`,
                    overflow: "hidden",
                }}>
                    <img
                        src={photoURL || user?.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(name || "User")}
                        alt="Profile"
                        style={{ width: 96, height: 96, objectFit: "cover" }}
                    />
                </div>
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handlePhotoChange}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    style={{
                        background: darkMode ? "#232b3b" : "#e3eaf6",
                        color: "#1976d2",
                        border: "1.2px solid #1976d2",
                        borderRadius: 6,
                        padding: "3px 12px",
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: "pointer",
                        marginBottom: 2,
                        marginTop: 0,
                        letterSpacing: 0.2,
                        boxShadow: "none",
                        transition: "background 0.2s, color 0.2s, border 0.2s",
                    }}
                    onMouseOver={e => {
                        e.currentTarget.style.background = "#1976d2";
                        e.currentTarget.style.color = "#fff";
                        e.currentTarget.style.border = "1.2px solid #1976d2";
                    }}
                    onMouseOut={e => {
                        e.currentTarget.style.background = darkMode ? "#232b3b" : "#e3eaf6";
                        e.currentTarget.style.color = "#1976d2";
                        e.currentTarget.style.border = "1.2px solid #1976d2";
                    }}
                >
                    Change Photo
                </button>
            </div>
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