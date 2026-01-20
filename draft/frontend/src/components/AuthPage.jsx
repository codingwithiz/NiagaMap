import React, { useState } from "react";
import { auth, googleProvider } from "../firebase";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

// NiagaMap Logo Component
const NiagaMapLogo = ({ size = 80 }) => (
  <svg width={size} height={size * 1.2} viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pinGradientAuth" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <linearGradient id="brainGradientAuth" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#A78BFA" />
      </linearGradient>
    </defs>
    <path d="M50 5C28 5 10 23 10 45C10 72 50 115 50 115S90 72 90 45C90 23 72 5 50 5Z" fill="url(#pinGradientAuth)" />
    <circle cx="50" cy="42" r="28" fill="#0f0f1a" opacity="0.9"/>
    <path d="M35 35C35 35 40 30 50 30C60 30 65 35 65 35M35 45C35 45 40 50 50 50C60 50 65 45 65 45M38 38L42 42M58 38L62 42M45 32V38M55 32V38M40 48L44 52M56 48L60 52" stroke="url(#brainGradientAuth)" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="50" cy="80" r="3" fill="white" opacity="0.9"/>
    <circle cx="42" cy="85" r="1.5" fill="white" opacity="0.6"/>
    <circle cx="58" cy="85" r="1.5" fill="white" opacity="0.6"/>
  </svg>
);

const AuthPage = ({ darkMode = false }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showForgot, setShowForgot] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetMsg, setResetMsg] = useState("");
    const navigate = useNavigate();

    const verifyWithBackend = async (user) => {
        try {
            const token = await user.getIdToken();
            const response = await api.post("/auth/verify", { token });
            console.log("User verified with backend:", response.data);
            return response.data;
        } catch (err) {
            console.error("Backend verification error:", err);
            throw err;
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        try {
            let userCredential;
            
            if (isLogin) {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            } else {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                if (name.trim()) {
                    await updateProfile(userCredential.user, {
                        displayName: name.trim(),
                    });
                    await userCredential.user.reload();
                }
            }

            await verifyWithBackend(userCredential.user);

            setSuccess(isLogin ? "Login successful!" : "Signup successful!");
            // Navigation will happen automatically via AuthContext
        } catch (err) {
            console.error("Auth error:", err);
            setError(err.message);
        }
    };

    const handleGoogle = async () => {
        setError("");
        setSuccess("");
        try {
            const result = await signInWithPopup(auth, googleProvider);
            await verifyWithBackend(result.user);
            console.log("Google user displayName:", result.user.displayName);
            setSuccess("Google login successful!");
            // Navigation will happen automatically via AuthContext
        } catch (err) {
            console.error("Google auth error:", err);
            setError(err.message);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setResetMsg("");
        try {
            await sendPasswordResetEmail(auth, resetEmail);
            setResetMsg("Password reset email sent! Please check your inbox.");
        } catch (err) {
            setResetMsg(err.message);
        }
    };

    const inputStyle = {
        padding: "14px 16px",
        borderRadius: 12,
        border: `2px solid ${darkMode ? "#2d2d5a" : "#e2e8f0"}`,
        fontSize: 15,
        color: darkMode ? "#f1f5f9" : "#1e293b",
        background: darkMode ? "#1a1a2e" : "#ffffff",
        outline: "none",
        transition: "all 0.25s ease",
        width: "100%",
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                background: darkMode
                    ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)"
                    : "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 50%, #f8fafc 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Background decorations */}
            <div style={{
                position: "absolute",
                top: "10%",
                left: "10%",
                width: 300,
                height: 300,
                background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
                borderRadius: "50%",
                pointerEvents: "none",
            }} />
            <div style={{
                position: "absolute",
                bottom: "10%",
                right: "10%",
                width: 400,
                height: 400,
                background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
                borderRadius: "50%",
                pointerEvents: "none",
            }} />

            {/* Logo and Title */}
            <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center", 
                marginBottom: 32,
                zIndex: 1,
            }}>
                <NiagaMapLogo size={70} />
                <h1 style={{
                    fontSize: 32,
                    fontWeight: 700,
                    marginTop: 16,
                    background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    letterSpacing: -0.5,
                }}>
                    NiagaMap
                </h1>
                <p style={{
                    color: darkMode ? "#94a3b8" : "#64748b",
                    fontSize: 14,
                    marginTop: 8,
                }}>
                    AI-Powered Location Intelligence
                </p>
            </div>

            {/* Auth Card */}
            <div
                style={{
                    width: 420,
                    maxWidth: "95vw",
                    padding: 36,
                    borderRadius: 24,
                    background: darkMode 
                        ? "rgba(26, 26, 46, 0.9)" 
                        : "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(20px)",
                    border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
                    boxShadow: darkMode 
                        ? "0 24px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.1)" 
                        : "0 24px 48px rgba(139, 92, 246, 0.1)",
                    zIndex: 1,
                }}
            >
                <h2
                    style={{
                        textAlign: "center",
                        marginBottom: 28,
                        fontWeight: 600,
                        fontSize: 24,
                        color: darkMode ? "#f1f5f9" : "#1e293b",
                    }}
                >
                    {isLogin ? "Welcome back" : "Create account"}
                </h2>

                <form
                    onSubmit={handleAuth}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                    }}
                >
                    {!isLogin && (
                        <input
                            type="text"
                            placeholder="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={inputStyle}
                            onFocus={(e) => {
                                e.target.style.borderColor = "#8B5CF6";
                                e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = darkMode ? "#2d2d5a" : "#e2e8f0";
                                e.target.style.boxShadow = "none";
                            }}
                        />
                    )}
                    <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        required
                        onChange={(e) => setEmail(e.target.value)}
                        style={inputStyle}
                        onFocus={(e) => {
                            e.target.style.borderColor = "#8B5CF6";
                            e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = darkMode ? "#2d2d5a" : "#e2e8f0";
                            e.target.style.boxShadow = "none";
                        }}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        required
                        onChange={(e) => setPassword(e.target.value)}
                        style={inputStyle}
                        onFocus={(e) => {
                            e.target.style.borderColor = "#8B5CF6";
                            e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = darkMode ? "#2d2d5a" : "#e2e8f0";
                            e.target.style.boxShadow = "none";
                        }}
                    />
                    {isLogin && (
                        <div style={{ textAlign: "right", marginBottom: -8, marginTop: -4 }}>
                            <button
                                type="button"
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#8B5CF6",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    padding: 0,
                                    fontWeight: 500,
                                }}
                                onClick={() => setShowForgot(true)}
                                onMouseOver={(e) => e.target.style.color = "#3B82F6"}
                                onMouseOut={(e) => e.target.style.color = "#8B5CF6"}
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}
                    <button
                        type="submit"
                        style={{
                            background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 12,
                            padding: "14px 0",
                            fontWeight: 600,
                            fontSize: 15,
                            marginTop: 8,
                            cursor: "pointer",
                            boxShadow: "0 8px 24px rgba(139, 92, 246, 0.3)",
                            transition: "all 0.25s ease",
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 12px 32px rgba(139, 92, 246, 0.4)";
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 8px 24px rgba(139, 92, 246, 0.3)";
                        }}
                    >
                        {isLogin ? "Sign In" : "Create Account"}
                    </button>
                </form>

                <div
                    style={{
                        margin: "24px 0",
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            height: 1,
                            background: darkMode 
                                ? "linear-gradient(90deg, transparent, #2d2d5a, transparent)" 
                                : "linear-gradient(90deg, transparent, #e2e8f0, transparent)",
                        }}
                    />
                    <span
                        style={{
                            margin: "0 16px",
                            color: darkMode ? "#64748b" : "#94a3b8",
                            fontSize: 13,
                            fontWeight: 500,
                        }}
                    >
                        or continue with
                    </span>
                    <div
                        style={{
                            flex: 1,
                            height: 1,
                            background: darkMode 
                                ? "linear-gradient(90deg, transparent, #2d2d5a, transparent)" 
                                : "linear-gradient(90deg, transparent, #e2e8f0, transparent)",
                        }}
                    />
                </div>

                <button
                    onClick={handleGoogle}
                    style={{
                        width: "100%",
                        background: darkMode ? "#1a1a2e" : "#fff",
                        color: darkMode ? "#f1f5f9" : "#1e293b",
                        border: `2px solid ${darkMode ? "#2d2d5a" : "#e2e8f0"}`,
                        borderRadius: 12,
                        padding: "14px 0",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        transition: "all 0.25s ease",
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = "#8B5CF6";
                        e.currentTarget.style.background = darkMode ? "#252540" : "#f8fafc";
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = darkMode ? "#2d2d5a" : "#e2e8f0";
                        e.currentTarget.style.background = darkMode ? "#1a1a2e" : "#fff";
                    }}
                >
                    <img
                        src="https://www.svgrepo.com/show/475656/google-color.svg"
                        alt="Google"
                        style={{ width: 20, height: 20 }}
                    />
                    Continue with Google
                </button>

                <div
                    style={{ marginTop: 24, textAlign: "center", fontSize: 14 }}
                >
                    <span style={{ color: darkMode ? "#94a3b8" : "#64748b" }}>
                        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                        <button
                            style={{
                                background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                fontWeight: 600,
                                fontSize: 14,
                            }}
                            onClick={() => setIsLogin(!isLogin)}
                        >
                            {isLogin ? "Sign Up" : "Sign In"}
                        </button>
                    </span>
                </div>

                {error && (
                    <div
                        style={{
                            color: "#ef4444",
                            marginTop: 16,
                            textAlign: "center",
                            fontWeight: 500,
                            fontSize: 13,
                            padding: "12px",
                            background: "rgba(239, 68, 68, 0.1)",
                            borderRadius: 8,
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                        }}
                    >
                        {error}
                    </div>
                )}
                {success && (
                    <div
                        style={{
                            color: "#10b981",
                            marginTop: 16,
                            textAlign: "center",
                            fontWeight: 500,
                            fontSize: 13,
                            padding: "12px",
                            background: "rgba(16, 185, 129, 0.1)",
                            borderRadius: 8,
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                        }}
                    >
                        {success}
                    </div>
                )}
            </div>

            {/* Forgot Password Modal */}
            {showForgot && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        background: "rgba(0, 0, 0, 0.6)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            background: darkMode ? "#1a1a2e" : "#fff",
                            padding: 32,
                            borderRadius: 20,
                            minWidth: 360,
                            maxWidth: "90vw",
                            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.3)",
                            border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
                        }}
                    >
                        <h3 style={{ 
                            color: darkMode ? "#f1f5f9" : "#1e293b",
                            marginBottom: 20,
                            fontSize: 20,
                            fontWeight: 600,
                        }}>
                            Reset Password
                        </h3>
                        <form onSubmit={handleForgotPassword}>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                required
                                style={{
                                    ...inputStyle,
                                    marginBottom: 16,
                                }}
                            />
                            <div style={{ display: "flex", gap: 12 }}>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 10,
                                        padding: "12px 20px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontSize: 14,
                                    }}
                                >
                                    Send Reset Link
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForgot(false);
                                        setResetMsg("");
                                    }}
                                    style={{
                                        background: darkMode ? "#252540" : "#f1f5f9",
                                        color: darkMode ? "#f1f5f9" : "#64748b",
                                        border: "none",
                                        borderRadius: 10,
                                        padding: "12px 20px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontSize: 14,
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                        {resetMsg && (
                            <div
                                style={{
                                    marginTop: 16,
                                    color: resetMsg.startsWith("Password reset")
                                        ? "#10b981"
                                        : "#ef4444",
                                    fontSize: 13,
                                    textAlign: "center",
                                }}
                            >
                                {resetMsg}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuthPage;
