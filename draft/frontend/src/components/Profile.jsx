import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import { updateProfile, updatePassword } from "firebase/auth";
import api from "../api/api";

// NiagaMap Logo Component
const NiagaMapLogo = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="profileLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
        </defs>
        <path d="M50 5C30.67 5 15 20.67 15 40c0 25 35 55 35 55s35-30 35-55c0-19.33-15.67-35-35-35z" 
              fill="url(#profileLogoGradient)" />
        <circle cx="50" cy="40" r="20" fill="white" fillOpacity="0.95"/>
        <circle cx="50" cy="40" r="8" fill="url(#profileLogoGradient)"/>
        <path d="M50 28v-4M50 56v-4M38 40h-4M66 40h-4" stroke="url(#profileLogoGradient)" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="42" cy="34" r="2" fill="url(#profileLogoGradient)"/>
        <circle cx="58" cy="34" r="2" fill="url(#profileLogoGradient)"/>
        <circle cx="42" cy="46" r="2" fill="url(#profileLogoGradient)"/>
        <circle cx="58" cy="46" r="2" fill="url(#profileLogoGradient)"/>
    </svg>
);

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
                background: darkMode 
                    ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)" 
                    : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                padding: "20px",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Decorative background orbs */}
            <div style={{
                position: "absolute",
                top: "-10%",
                right: "-5%",
                width: "300px",
                height: "300px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)",
                filter: "blur(60px)",
                pointerEvents: "none",
            }} />
            <div style={{
                position: "absolute",
                bottom: "-10%",
                left: "-5%",
                width: "250px",
                height: "250px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)",
                filter: "blur(60px)",
                pointerEvents: "none",
            }} />
            
            <div
                style={{
                    width: "100%",
                    maxWidth: 480,
                    margin: "0 auto",
                    padding: "40px 0",
                    position: "relative",
                    zIndex: 1,
                }}
            >
                {/* Header with Logo */}
                <div style={{
                    textAlign: "center",
                    marginBottom: 24,
                }}>
                    <NiagaMapLogo size={56} />
                    <h1 style={{
                        fontSize: 24,
                        fontWeight: 700,
                        background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        marginTop: 12,
                        marginBottom: 4,
                    }}>
                        Profile Settings
                    </h1>
                    <p style={{
                        color: darkMode ? "#94a3b8" : "#64748b",
                        fontSize: 14,
                    }}>
                        Manage your account information
                    </p>
                </div>
                
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
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

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
        // client-side validation: ensure confirmation matches
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        try {
            await updatePassword(auth.currentUser, password);
            setMessage("Password updated successfully!");
            setPassword("");
            setConfirmPassword("");
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
                background: darkMode 
                    ? "rgba(26, 26, 46, 0.8)" 
                    : "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: 24,
                boxShadow: darkMode
                    ? "0 8px 32px rgba(139, 92, 246, 0.15), 0 4px 16px rgba(0, 0, 0, 0.3)"
                    : "0 8px 32px rgba(139, 92, 246, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)",
                border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.15)"}`,
                position: "relative",
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
                <div style={{
                    width: 100,
                    height: 100,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                    padding: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                    boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)",
                }}>
                    <div style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: darkMode ? "#1a1a2e" : "#fff",
                    }}>
                        <img
                            src={photoURL || user?.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(name || "User") + "&background=8B5CF6&color=fff"}
                            alt="Profile"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    </div>
                </div>
                {/* <input
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
                        background: "transparent",
                        color: "#8B5CF6",
                        border: "1.5px solid #8B5CF6",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontWeight: 500,
                        fontSize: 13,
                        cursor: "pointer",
                        marginTop: 4,
                        letterSpacing: 0.2,
                        transition: "all 0.25s ease",
                    }}
                    onMouseOver={e => {
                        e.currentTarget.style.background = "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)";
                        e.currentTarget.style.color = "#fff";
                        e.currentTarget.style.border = "1.5px solid transparent";
                    }}
                    onMouseOut={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#8B5CF6";
                        e.currentTarget.style.border = "1.5px solid #8B5CF6";
                    }}
                >
                    Change Photo
                </button> */}
            </div>
            <form onSubmit={handleUpdateName} style={{ marginBottom: 28 }}>
                <label
                    style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 8,
                        color: darkMode ? "#e2e8f0" : "#374151",
                        fontSize: 14,
                    }}
                >
                    Name
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                        width: "100%",
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: darkMode ? "1.5px solid rgba(139, 92, 246, 0.3)" : "1.5px solid #e2e8f0",
                        fontSize: 15,
                        marginBottom: 16,
                        background: darkMode ? "rgba(37, 37, 64, 0.6)" : "#f8fafc",
                        color: darkMode ? "#e2e8f0" : "#1f2937",
                        outline: "none",
                        transition: "all 0.25s ease",
                        boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                        e.target.style.border = "1.5px solid #8B5CF6";
                        e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
                    }}
                    onBlur={(e) => {
                        e.target.style.border = darkMode ? "1.5px solid rgba(139, 92, 246, 0.3)" : "1.5px solid #e2e8f0";
                        e.target.style.boxShadow = "none";
                    }}
                />
                <label
                    style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 8,
                        color: darkMode ? "#e2e8f0" : "#374151",
                        fontSize: 14,
                    }}
                >
                    Email
                </label>
                <input
                    type="email"
                    value={email}
                    disabled
                    style={{
                        width: "100%",
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: darkMode ? "1.5px solid rgba(100, 116, 139, 0.3)" : "1.5px solid #e2e8f0",
                        fontSize: 15,
                        marginBottom: 16,
                        background: darkMode ? "rgba(37, 37, 64, 0.4)" : "#f1f5f9",
                        color: darkMode ? "#94a3b8" : "#64748b",
                        cursor: "not-allowed",
                        boxSizing: "border-box",
                    }}
                />
                <button
                    type="submit"
                    style={{
                        padding: "14px 0",
                        width: "100%",
                        background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 12,
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: "pointer",
                        boxShadow: "0 4px 16px rgba(139, 92, 246, 0.3)",
                        transition: "all 0.25s ease",
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(139, 92, 246, 0.4)";
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 16px rgba(139, 92, 246, 0.3)";
                    }}
                >
                    Update Name
                </button>
            </form>
            <form onSubmit={handleUpdatePassword}>
                <label
                    style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 8,
                        color: darkMode ? "#e2e8f0" : "#374151",
                        fontSize: 14,
                    }}
                >
                    New Password
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        required
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        style={{
                            flex: 1,
                            padding: "14px 12px",
                            borderRadius: 12,
                            border: darkMode ? "1.5px solid rgba(139, 92, 246, 0.3)" : "1.5px solid #e2e8f0",
                            fontSize: 15,
                            background: darkMode ? "rgba(37, 37, 64, 0.6)" : "#f8fafc",
                            color: darkMode ? "#e2e8f0" : "#1f2937",
                            outline: "none",
                            transition: "all 0.25s ease",
                            boxSizing: "border-box",
                        }}
                        onFocus={(e) => {
                            e.target.style.border = "1.5px solid #8B5CF6";
                            e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
                        }}
                        onBlur={(e) => {
                            e.target.style.border = darkMode ? "1.5px solid rgba(139, 92, 246, 0.3)" : "1.5px solid #e2e8f0";
                            e.target.style.boxShadow = "none";
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        style={{
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.08)",
                            background: showPassword ? "#e6f0ff" : "transparent",
                            cursor: "pointer",
                        }}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? "Hide" : "Show"}
                    </button>
                </div>

                <label
                    style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 8,
                        color: darkMode ? "#e2e8f0" : "#374151",
                        fontSize: 14,
                    }}
                >
                    Confirm Password
                </label>
                <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    required
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    style={{
                        width: "100%",
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: darkMode ? "1.5px solid rgba(139, 92, 246, 0.3)" : "1.5px solid #e2e8f0",
                        fontSize: 15,
                        marginBottom: 16,
                        background: darkMode ? "rgba(37, 37, 64, 0.6)" : "#f8fafc",
                        color: darkMode ? "#e2e8f0" : "#1f2937",
                        outline: "none",
                        transition: "all 0.25s ease",
                        boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                        e.target.style.border = "1.5px solid #8B5CF6";
                        e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
                    }}
                    onBlur={(e) => {
                        e.target.style.border = darkMode ? "1.5px solid rgba(139, 92, 246, 0.3)" : "1.5px solid #e2e8f0";
                        e.target.style.boxShadow = "none";
                    }}
                />
                <button
                    type="submit"
                    style={{
                        padding: "14px 0",
                        width: "100%",
                        background: "transparent",
                        color: "#8B5CF6",
                        border: "2px solid #8B5CF6",
                        borderRadius: 12,
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: "pointer",
                        transition: "all 0.25s ease",
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)";
                        e.currentTarget.style.color = "#fff";
                        e.currentTarget.style.border = "2px solid transparent";
                        e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#8B5CF6";
                        e.currentTarget.style.border = "2px solid #8B5CF6";
                        e.currentTarget.style.transform = "translateY(0)";
                    }}
                >
                    Update Password
                </button>
            </form>
            {message && (
                <div
                    style={{
                        color: "#10b981",
                        background: darkMode ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
                        borderRadius: 12,
                        padding: "12px 16px",
                        marginTop: 20,
                        fontWeight: 500,
                        textAlign: "center",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                >
                    ✓ {message}
                </div>
            )}
            {error && (
                <div
                    style={{
                        color: "#ef4444",
                        background: darkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)",
                        borderRadius: 12,
                        padding: "12px 16px",
                        marginTop: 20,
                        fontWeight: 500,
                        textAlign: "center",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                    }}
                >
                    ✕ {error}
                </div>
            )}
        </div>
    );
};

export default Profile;