import React, { useState } from "react";
import { auth, googleProvider } from "../firebase";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
} from "firebase/auth";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AuthPage = ({ darkMode = false }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showForgot, setShowForgot] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetMsg, setResetMsg] = useState("");
    const navigate = useNavigate();

    const handleAuth = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        try {
            let userCredential;
            if (isLogin) {
                userCredential = await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
            } else {
                userCredential = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
            }
            const token = await userCredential.user.getIdToken();
            console.log("Firebase auth successful, verifying with backend...");
            await axios.post("http://localhost:3001/auth/verify", { token });
            setSuccess(isLogin ? "Login successful!" : "Signup successful!");
            navigate("/map");
        } catch (err) {
            console.error("Auth error:", err);
            if (err.response) {
                console.error("Backend response:", err.response.data);
                setError(`Backend error: ${err.response.data.message || err.message}`);
            } else if (err.code) {
                console.error("Firebase error:", err.code, err.message);
                setError(`Firebase error: ${err.message}`);
            } else {
                setError(err.message);
            }
        }
    };

    const handleGoogle = async () => {
        setError("");
        setSuccess("");
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const token = await result.user.getIdToken();
            await axios.post("http://localhost:3001/auth/verify", { token });
            setSuccess("Google login successful!");
            navigate("/map");
        } catch (err) {
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
        padding: "12px 14px",
        borderRadius: 8,
        border: `1px solid ${darkMode ? "#555" : "#cfd8dc"}`,
        fontSize: 16,
        color: darkMode ? "#f5f5f5" : "#222",
        background: darkMode ? "#1e1e1e" : "#fff",
        outline: "none",
        transition: "border 0.2s",
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                background: darkMode
                    ? "linear-gradient(135deg, #1a1a1a 0%, #121212 100%)"
                    : "linear-gradient(135deg, #e3f0ff 0%, #f9f9f9 100%)",
                display: "flex",
                flexDirection: "column",
                color: darkMode ? "#f0f0f0" : "#222",
            }}
        >
            <div
                style={{
                    width: 400,
                    maxWidth: "90vw",
                    margin: "100px auto",
                    padding: 40,
                    border: `1px solid ${darkMode ? "#333" : "#e0e6ed"}`,
                    borderRadius: 20,
                    background: darkMode ? "#222" : "#fff",
                    boxShadow: "0 4px 24px rgba(25, 118, 210, 0.07)",
                }}
            >
                <h2
                    style={{
                        textAlign: "center",
                        marginBottom: 24,
                        fontWeight: 700,
                        letterSpacing: 1,
                    }}
                >
                    {isLogin ? "Login" : "Sign Up"}
                </h2>

                <form
                    onSubmit={handleAuth}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 18,
                    }}
                >
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        required
                        onChange={(e) => setEmail(e.target.value)}
                        style={inputStyle}
                        onFocus={(e) =>
                            (e.target.style.border = "1.5px solid #1976d2")
                        }
                        onBlur={(e) =>
                            (e.target.style.border = `1px solid ${
                                darkMode ? "#555" : "#cfd8dc"
                            }`)
                        }
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        required
                        onChange={(e) => setPassword(e.target.value)}
                        style={inputStyle}
                        onFocus={(e) =>
                            (e.target.style.border = "1.5px solid #1976d2")
                        }
                        onBlur={(e) =>
                            (e.target.style.border = `1px solid ${
                                darkMode ? "#555" : "#cfd8dc"
                            }`)
                        }
                    />
                    {isLogin && (
                        <div style={{ textAlign: "right", marginBottom: -10 }}>
                            <button
                                type="button"
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#90caf9",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    fontSize: 14,
                                    padding: 0,
                                }}
                                onClick={() => setShowForgot(true)}
                            >
                                Forgot your password?
                            </button>
                        </div>
                    )}
                    <button
                        type="submit"
                        style={{
                            background: "#1976d2",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "12px 0",
                            fontWeight: 600,
                            fontSize: 17,
                            marginTop: 8,
                            cursor: "pointer",
                            boxShadow: "0 2px 8px rgba(25, 118, 210, 0.08)",
                        }}
                        onMouseOver={(e) =>
                            (e.currentTarget.style.background = "#1251a3")
                        }
                        onMouseOut={(e) =>
                            (e.currentTarget.style.background = "#1976d2")
                        }
                    >
                        {isLogin ? "Login" : "Sign Up"}
                    </button>
                </form>

                <div
                    style={{
                        margin: "18px 0",
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            height: 1,
                            background: darkMode ? "#444" : "#e0e0e0",
                        }}
                    />
                    <span
                        style={{
                            margin: "0 12px",
                            color: darkMode ? "#bbb" : "#888",
                            fontSize: 14,
                        }}
                    >
                        or
                    </span>
                    <div
                        style={{
                            flex: 1,
                            height: 1,
                            background: darkMode ? "#444" : "#e0e0e0",
                        }}
                    />
                </div>

                <button
                    onClick={handleGoogle}
                    style={{
                        width: "100%",
                        background: darkMode ? "#1e1e1e" : "#fff",
                        color: darkMode ? "#f0f0f0" : "#222",
                        border: `1px solid ${darkMode ? "#555" : "#cfd8dc"}`,
                        borderRadius: 8,
                        padding: "12px 0",
                        fontWeight: 600,
                        fontSize: 16,
                        cursor: "pointer",
                        boxShadow: darkMode
                            ? "0 2px 8px rgba(255,255,255,0.03)"
                            : "0 2px 8px rgba(25, 118, 210, 0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                    }}
                    onMouseOver={(e) =>
                        (e.currentTarget.style.border = "1.5px solid #1976d2")
                    }
                    onMouseOut={(e) =>
                        (e.currentTarget.style.border = `1px solid ${
                            darkMode ? "#555" : "#cfd8dc"
                        }`)
                    }
                >
                    <img
                        src="https://www.svgrepo.com/show/475656/google-color.svg"
                        alt="Google"
                        style={{ width: 22, height: 22 }}
                    />
                    Continue with Google
                </button>

                <div
                    style={{ marginTop: 20, textAlign: "center", fontSize: 15 }}
                >
                    <span>
                        {isLogin
                            ? "Don't have an account?"
                            : "Already have an account?"}{" "}
                        <button
                            style={{
                                color: "#90caf9",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                fontWeight: 600,
                                fontSize: 15,
                            }}
                            onClick={() => setIsLogin(!isLogin)}
                        >
                            {isLogin ? "Sign Up" : "Login"}
                        </button>
                    </span>
                </div>

                {error && (
                    <div
                        style={{
                            color: "#ef5350",
                            marginTop: 14,
                            textAlign: "center",
                            fontWeight: 500,
                        }}
                    >
                        {error}
                    </div>
                )}
                {success && (
                    <div
                        style={{
                            color: "#66bb6a",
                            marginTop: 14,
                            textAlign: "center",
                            fontWeight: 500,
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
                        background: "rgba(0,0,0,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            background: darkMode ? "#222" : "#fff",
                            padding: 24,
                            borderRadius: 12,
                            minWidth: 320,
                            boxShadow: "0 2px 16px rgba(0,0,0,0.25)",
                            color: darkMode ? "#f0f0f0" : "#222",
                        }}
                    >
                        <h3>Reset Password</h3>
                        <form onSubmit={handleForgotPassword}>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                required
                                style={{
                                    width: "100%",
                                    padding: 8,
                                    marginBottom: 12,
                                    borderRadius: 6,
                                    border: `1px solid ${
                                        darkMode ? "#555" : "#ccc"
                                    }`,
                                    background: darkMode ? "#1e1e1e" : "#fff",
                                    color: darkMode ? "#f0f0f0" : "#222",
                                }}
                            />
                            <button
                                type="submit"
                                style={{
                                    background: "#1976d2",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "8px 16px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Send Reset Email
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForgot(false);
                                    setResetMsg("");
                                }}
                                style={{
                                    marginLeft: 12,
                                    background: darkMode ? "#444" : "#eee",
                                    color: darkMode ? "#eee" : "#222",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "8px 16px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                        </form>
                        {resetMsg && (
                            <div
                                style={{
                                    marginTop: 12,
                                    color: resetMsg.startsWith("Password reset")
                                        ? "lightgreen"
                                        : "red",
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
