import React, { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";


const Analysis = ({darkMode = false}) => {
    const { user } = useAuth();
     // Assuming from context
    const userId = user?.uid;

    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [chatIds, setChatIds] = useState([]);
    const [referenceNames, setReferenceNames] = useState([]);
    const [selectedChatId, setSelectedChatId] = useState("all");
    const [selectedRefName, setSelectedRefName] = useState("all");
    const [selectedDate, setSelectedDate] = useState("");
    const [sortOrder, setSortOrder] = useState("desc");

    const [showModal, setShowModal] = useState(false);
    const [selectedAnalysis, setSelectedAnalysis] = useState(null);
    const [formData, setFormData] = useState({ name: "", lat: "", lon: "" });

    useEffect(() => {
        fetchAnalyses();
    }, []);

    const fetchAnalyses = async () => {
        try {
            const response = await api.get(`/analysis/${userId}`);
            const allAnalyses = response.data.analyses;
            setAnalyses(allAnalyses);

            const uniqueChatIds = Array.from(
                new Set(allAnalyses.map((a) => a.chatId))
            );
            const uniqueRefNames = Array.from(
                new Set(
                    allAnalyses
                        .map((a) => a.referencePoint?.name)
                        .filter((name) => name != null)
                )
            );

            setChatIds(uniqueChatIds);
            setReferenceNames(uniqueRefNames);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch analyses.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (analysisId) => {
        if (!window.confirm("Are you sure you want to delete this analysis?"))
            return;
        try {
            await api.delete(`/analysis/${analysisId}`);
            setAnalyses((prev) =>
                prev.filter((a) => a.analysisId !== analysisId)
            );
        } catch (err) {
            console.error("Failed to delete analysis:", err);
            alert("Delete failed.");
        }
    };

    const openUpdateModal = (analysis) => {
        setSelectedAnalysis(analysis);
        setFormData({
            name: analysis.referencePoint?.name || "",
            lat: analysis.referencePoint?.lat || "",
            lon: analysis.referencePoint?.lon || "",
        });
        setShowModal(true);
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.patch(
                `/analysis/${selectedAnalysis.analysisId}`,
                formData
            );
            setShowModal(false);
            fetchAnalyses();
        } catch (err) {
            console.error("Failed to update:", err);
            alert("Update failed.");
        }
    };

    const getFilteredAndSortedAnalyses = () => {
        let filtered = analyses.filter((a) => {
            const chatMatch =
                selectedChatId === "all" || a.chatId === selectedChatId;
            const refMatch =
                selectedRefName === "all" ||
                (a.referencePoint && a.referencePoint.name === selectedRefName);
            const dateMatch =
                !selectedDate ||
                (() => {
                    // Parse both as UTC to avoid timezone issues
                    const created = new Date(a.createdAt);
                    const selected = new Date(selectedDate + 'T00:00:00Z');
                    return (
                        created.getUTCFullYear() === selected.getUTCFullYear() &&
                        created.getUTCMonth() === selected.getUTCMonth() &&
                        created.getUTCDate() === selected.getUTCDate()
                    );
                })();
            return chatMatch && refMatch && dateMatch;
        });

        return filtered.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        });
    };

    const filteredAnalyses = getFilteredAndSortedAnalyses();

    const formatDateTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    };

    if (loading)
        return (
            <div style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: darkMode ? "#0f0f1a" : "#f8fafc",
            }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        border: "4px solid rgba(139, 92, 246, 0.2)",
                        borderTopColor: "#8B5CF6",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        margin: "0 auto 16px",
                    }} />
                    <p style={{ color: darkMode ? "#94a3b8" : "#64748b" }}>Loading analyses...</p>
                </div>
            </div>
        );
    if (error) return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: darkMode ? "#0f0f1a" : "#f8fafc",
        }}>
            <div style={{
                padding: "20px 32px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: 12,
                color: "#ef4444",
            }}>
                {error}
            </div>
        </div>
    );

    return (
        <div style={{
            minHeight: "100vh",
            padding: "32px",
            background: darkMode 
                ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)" 
                : "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)",
        }}>
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                {/* Header */}
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{
                        fontSize: 32,
                        fontWeight: 700,
                        background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        marginBottom: 8,
                    }}>
                        Analysis Results
                    </h1>
                    <p style={{ color: darkMode ? "#94a3b8" : "#64748b", fontSize: 14 }}>
                        View and manage your location analysis history
                    </p>
                </div>

                {/* Filters Card */}
                <div style={{
                    background: darkMode ? "rgba(26, 26, 46, 0.8)" : "rgba(255, 255, 255, 0.9)",
                    backdropFilter: "blur(20px)",
                    borderRadius: 20,
                    padding: 24,
                    marginBottom: 32,
                    border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
                    boxShadow: darkMode 
                        ? "0 8px 32px rgba(0, 0, 0, 0.3)" 
                        : "0 8px 32px rgba(139, 92, 246, 0.1)",
                }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                        {/* Chat ID Filter */}
                        <div style={{ flex: "1 1 200px" }}>
                            <label style={{
                                display: "block",
                                marginBottom: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                color: darkMode ? "#94a3b8" : "#64748b",
                            }}>
                                Filter by Chat ID
                            </label>
                            <select
                                value={selectedChatId}
                                onChange={(e) => setSelectedChatId(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                    background: darkMode ? "#1a1a2e" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    transition: "all 0.25s ease",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#8B5CF6"}
                                onBlur={(e) => e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}
                            >
                                <option value="all">All Chats</option>
                                {chatIds.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Reference Point Filter */}
                        <div style={{ flex: "1 1 200px" }}>
                            <label style={{
                                display: "block",
                                marginBottom: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                color: darkMode ? "#94a3b8" : "#64748b",
                            }}>
                                Filter by Reference Point
                            </label>
                            <select
                                value={selectedRefName}
                                onChange={(e) => setSelectedRefName(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                    background: darkMode ? "#1a1a2e" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    transition: "all 0.25s ease",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#8B5CF6"}
                                onBlur={(e) => e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}
                            >
                                <option value="all">All Reference Points</option>
                                {referenceNames.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Filter */}
                        <div style={{ flex: "1 1 200px", position: "relative" }}>
                            <label style={{
                                display: "block",
                                marginBottom: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                color: darkMode ? "#94a3b8" : "#64748b",
                            }}>
                                Filter by Date
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                    background: darkMode ? "#1a1a2e" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    fontSize: 14,
                                    transition: "all 0.25s ease",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#8B5CF6"}
                                onBlur={(e) => e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}
                            />
                            {selectedDate && (
                                <button
                                    onClick={() => setSelectedDate("")}
                                    style={{
                                        position: "absolute",
                                        right: 12,
                                        top: "50%",
                                        transform: "translateY(25%)",
                                        background: "none",
                                        border: "none",
                                        color: "#64748b",
                                        cursor: "pointer",
                                        fontSize: 16,
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        {/* Sort Order */}
                        <div style={{ flex: "1 1 200px" }}>
                            <label style={{
                                display: "block",
                                marginBottom: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                color: darkMode ? "#94a3b8" : "#64748b",
                            }}>
                                Sort Order
                            </label>
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                    background: darkMode ? "#1a1a2e" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    transition: "all 0.25s ease",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#8B5CF6"}
                                onBlur={(e) => e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}
                            >
                                <option value="desc">Newest First</option>
                                <option value="asc">Oldest First</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Render each analysis */}
                {filteredAnalyses.length === 0 ? (
                    <div style={{
                        textAlign: "center",
                        padding: "60px 20px",
                        color: darkMode ? "#64748b" : "#94a3b8",
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                        <p style={{ fontSize: 18, fontWeight: 500 }}>No analyses found</p>
                        <p style={{ fontSize: 14, marginTop: 8 }}>Try adjusting your filters or create a new analysis</p>
                    </div>
                ) : (
                    filteredAnalyses.map((analysis) => (
                        <div
                            key={analysis.analysisId}
                            style={{
                                background: darkMode ? "rgba(26, 26, 46, 0.8)" : "rgba(255, 255, 255, 0.9)",
                                backdropFilter: "blur(20px)",
                                borderRadius: 20,
                                padding: 28,
                                marginBottom: 24,
                                border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
                                boxShadow: darkMode 
                                    ? "0 8px 32px rgba(0, 0, 0, 0.3)" 
                                    : "0 8px 32px rgba(139, 92, 246, 0.08)",
                                transition: "all 0.3s ease",
                            }}
                        >
                            {/* Analysis Header */}
                            <div style={{ 
                                display: "flex", 
                                justifyContent: "space-between", 
                                alignItems: "flex-start",
                                marginBottom: 24,
                                flexWrap: "wrap",
                                gap: 16,
                            }}>
                                <div>
                                    <h2 style={{
                                        fontSize: 20,
                                        fontWeight: 600,
                                        color: darkMode ? "#f1f5f9" : "#1e293b",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        marginBottom: 8,
                                    }}>
                                        <span style={{ color: "#8B5CF6" }}>📍</span>
                                        {analysis.referencePoint?.name || (
                                            <span style={{ color: "#64748b", fontStyle: "italic" }}>No reference</span>
                                        )}
                                    </h2>
                                    <div style={{ 
                                        display: "flex", 
                                        flexWrap: "wrap", 
                                        gap: 16,
                                        fontSize: 13,
                                        color: darkMode ? "#94a3b8" : "#64748b",
                                    }}>
                                        <span>
                                            Lat: {analysis.referencePoint?.lat?.toFixed(6) ?? "N/A"}
                                        </span>
                                        <span>
                                            Lon: {analysis.referencePoint?.lon?.toFixed(6) ?? "N/A"}
                                        </span>
                                        <span style={{
                                            padding: "2px 10px",
                                            background: "rgba(139, 92, 246, 0.1)",
                                            borderRadius: 20,
                                            fontSize: 11,
                                            color: "#8B5CF6",
                                            fontWeight: 500,
                                        }}>
                                            {formatDateTime(analysis.createdAt)}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button
                                        onClick={() => openUpdateModal(analysis)}
                                        style={{
                                            padding: "10px 20px",
                                            borderRadius: 10,
                                            background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                            color: "#fff",
                                            border: "none",
                                            fontWeight: 600,
                                            fontSize: 13,
                                            cursor: "pointer",
                                            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                                            transition: "all 0.25s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.transform = "translateY(-2px)";
                                            e.target.style.boxShadow = "0 6px 16px rgba(139, 92, 246, 0.4)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.transform = "translateY(0)";
                                            e.target.style.boxShadow = "0 4px 12px rgba(139, 92, 246, 0.3)";
                                        }}
                                    >
                                        Update
                                    </button>
                                    <button
                                        onClick={() => handleDelete(analysis.analysisId)}
                                        style={{
                                            padding: "10px 20px",
                                            borderRadius: 10,
                                            background: "transparent",
                                            color: "#ef4444",
                                            border: "2px solid rgba(239, 68, 68, 0.3)",
                                            fontWeight: 600,
                                            fontSize: 13,
                                            cursor: "pointer",
                                            transition: "all 0.25s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = "#ef4444";
                                            e.target.style.color = "#fff";
                                            e.target.style.borderColor = "#ef4444";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = "transparent";
                                            e.target.style.color = "#ef4444";
                                            e.target.style.borderColor = "rgba(239, 68, 68, 0.3)";
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>

                            {/* Recommended Locations Grid */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                                gap: 20,
                            }}>
                                {analysis.recommendedLocations.map((loc, idx) => (
                                    <div
                                        key={loc.locationId}
                                        style={{
                                            background: darkMode ? "#252540" : "#f8fafc",
                                            borderRadius: 16,
                                            padding: 20,
                                            border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.15)" : "#e2e8f0"}`,
                                            transition: "all 0.25s ease",
                                            position: "relative",
                                            overflow: "hidden",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = "#8B5CF6";
                                            e.currentTarget.style.boxShadow = "0 8px 24px rgba(139, 92, 246, 0.15)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.15)" : "#e2e8f0";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                    >
                                        {/* Rank Badge */}
                                        <div style={{
                                            position: "absolute",
                                            top: 12,
                                            right: 12,
                                            width: 32,
                                            height: 32,
                                            borderRadius: "50%",
                                            background: idx === 0 
                                                ? "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)" 
                                                : darkMode ? "#2d2d5a" : "#e2e8f0",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: idx === 0 ? "#fff" : darkMode ? "#94a3b8" : "#64748b",
                                        }}>
                                            {idx + 1}
                                        </div>

                                        <h3 style={{
                                            fontSize: 15,
                                            fontWeight: 600,
                                            color: darkMode ? "#f1f5f9" : "#1e293b",
                                            marginBottom: 12,
                                            paddingRight: 40,
                                        }}>
                                            🗺️ Location #{loc.locationId.slice(-6)}
                                        </h3>
                                        
                                        <div style={{ 
                                            display: "flex", 
                                            gap: 16, 
                                            fontSize: 12, 
                                            color: darkMode ? "#94a3b8" : "#64748b",
                                            marginBottom: 12,
                                        }}>
                                            <span>Lat: {loc.lat?.toFixed(6)}</span>
                                            <span>Lon: {loc.lon?.toFixed(6)}</span>
                                        </div>

                                        {/* Score Bar */}
                                        <div style={{ marginBottom: 14 }}>
                                            <div style={{ 
                                                display: "flex", 
                                                justifyContent: "space-between", 
                                                marginBottom: 6,
                                                fontSize: 12,
                                            }}>
                                                <span style={{ color: darkMode ? "#94a3b8" : "#64748b" }}>Score</span>
                                                <span style={{ 
                                                    fontWeight: 700, 
                                                    background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                                    WebkitBackgroundClip: "text",
                                                    WebkitTextFillColor: "transparent",
                                                }}>
                                                    {(loc.score)}%
                                                </span>
                                            </div>
                                            <div style={{
                                                height: 6,
                                                background: darkMode ? "#1a1a2e" : "#e2e8f0",
                                                borderRadius: 10,
                                                overflow: "hidden",
                                            }}>
                                                <div style={{
                                                    width: `${loc.score}%`,
                                                    height: "100%",
                                                    background: "linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%)",
                                                    borderRadius: 10,
                                                    transition: "width 0.5s ease",
                                                }} />
                                            </div>
                                        </div>

                                        {/* AI Reasoning */}
                                        <p style={{
                                            fontSize: 13,
                                            color: darkMode ? "#cbd5e1" : "#475569",
                                            lineHeight: 1.6,
                                            fontStyle: "italic",
                                            marginBottom: 16,
                                        }}>
                                            {loc.ai_reason}
                                        </p>

                                        {/* Action Links */}
                                        <div style={{ 
                                            display: "flex", 
                                            gap: 12, 
                                            fontSize: 12,
                                        }}>
                                            <a
                                                href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=19/${loc.lat}/${loc.lon}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: "#8B5CF6",
                                                    textDecoration: "none",
                                                    fontWeight: 500,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                }}
                                            >
                                                🗺️ View on OSM
                                            </a>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: "#3B82F6",
                                                    textDecoration: "none",
                                                    fontWeight: 500,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                }}
                                            >
                                                📍 Navigate
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}

                {/* Modal */}
                {showModal && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.7)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}>
                        <div style={{
                            background: darkMode ? "#1a1a2e" : "#fff",
                            borderRadius: 24,
                            padding: 32,
                            width: "100%",
                            maxWidth: 440,
                            border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
                            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.3)",
                        }}>
                            <h2 style={{
                                fontSize: 22,
                                fontWeight: 600,
                                marginBottom: 24,
                                background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}>
                                Update Reference Point
                            </h2>
                            <form onSubmit={handleUpdateSubmit}>
                                {["name", "lat", "lon"].map((field) => (
                                    <div key={field} style={{ marginBottom: 16 }}>
                                        <label style={{
                                            display: "block",
                                            marginBottom: 8,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: darkMode ? "#94a3b8" : "#64748b",
                                            textTransform: "capitalize",
                                        }}>
                                            {field}
                                        </label>
                                        <input
                                            type={field === "name" ? "text" : "number"}
                                            value={formData[field]}
                                            step={field === "name" ? undefined : "any"}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    [field]: field === "name" ? e.target.value : parseFloat(e.target.value),
                                                })
                                            }
                                            style={{
                                                width: "100%",
                                                padding: "14px 16px",
                                                borderRadius: 12,
                                                border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                                background: darkMode ? "#252540" : "#f8fafc",
                                                color: darkMode ? "#f1f5f9" : "#1e293b",
                                                fontSize: 14,
                                                transition: "all 0.25s ease",
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = "#8B5CF6";
                                                e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0";
                                                e.target.style.boxShadow = "none";
                                            }}
                                            required
                                        />
                                    </div>
                                ))}
                                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        style={{
                                            flex: 1,
                                            padding: "14px",
                                            borderRadius: 12,
                                            background: darkMode ? "#252540" : "#f1f5f9",
                                            color: darkMode ? "#f1f5f9" : "#64748b",
                                            border: "none",
                                            fontWeight: 600,
                                            fontSize: 14,
                                            cursor: "pointer",
                                            transition: "all 0.25s ease",
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{
                                            flex: 1,
                                            padding: "14px",
                                            borderRadius: 12,
                                            background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                            color: "#fff",
                                            border: "none",
                                            fontWeight: 600,
                                            fontSize: 14,
                                            cursor: "pointer",
                                            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                                            transition: "all 0.25s ease",
                                        }}
                                    >
                                        Update
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Analysis;
