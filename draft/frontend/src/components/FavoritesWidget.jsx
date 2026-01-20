import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api/api";

const FavoritesWidget = ({ 
  darkMode = false, 
  onViewFavourite,
  onRemoveFavourite,
  onRefresh 
}) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [favorites, setFavorites] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user?.uid && isExpanded) {
            fetchFavorites();
        }
    }, [user?.uid, isExpanded]);

    const fetchFavorites = async () => {
        if (!user?.uid) return;
        try {
            setIsLoading(true);
            const res = await api.get(`/favourites/${user.uid}`);
            setFavorites(res.data || []);
        } catch (err) {
            console.error("Error fetching favorites:", err);
            showToast("Failed to load favorites", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewClick = (favorite) => {
        if (onViewFavourite) {
            onViewFavourite(favorite.analysis_id);
        }
        setIsExpanded(false);
    };

    const handleRemoveClick = async (favorite) => {
        if (!user?.uid) return;
        try {
            await api.delete(`/favourites`, {
                data: { user_id: user.uid, analysis_id: favorite.analysis_id }
            });
            setFavorites(prev => prev.filter(f => f.analysis_id !== favorite.analysis_id));
            showToast("Removed from favourites", "info");
            if (onRemoveFavourite) {
                onRemoveFavourite(favorite.analysis_id);
            }
        } catch (err) {
            console.error("Error removing favourite:", err);
            showToast("Failed to remove favourite", "error");
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                bottom: 32,
                left: 32,
                zIndex: 1000,
                fontFamily: "system-ui, -apple-system, sans-serif",
            }}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    borderRadius: "50%",
                    width: 56,
                    height: 56,
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "#fff",
                    fontSize: 24,
                    border: "none",
                    boxShadow: "0 8px 32px rgba(245, 158, 11, 0.4)",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                }}
                onMouseEnter={(e) => {
                    e.target.style.transform = "scale(1.1)";
                    e.target.style.boxShadow = "0 12px 40px rgba(245, 158, 11, 0.5)";
                }}
                onMouseLeave={(e) => {
                    e.target.style.transform = "scale(1)";
                    e.target.style.boxShadow = "0 8px 32px rgba(245, 158, 11, 0.4)";
                }}
                title="View Favourites"
                aria-label="View Favourites"
            >
                ⭐
                {favorites.length > 0 && (
                    <span style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: "50%",
                        width: 20,
                        height: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid #fff",
                    }}>
                        {favorites.length}
                    </span>
                )}
            </button>

            {/* Favorites Panel */}
            {isExpanded && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 70,
                        left: 0,
                        width: 320,
                        maxHeight: 500,
                        background: darkMode ? "rgba(26, 26, 46, 0.95)" : "rgba(255, 255, 255, 0.95)",
                        backdropFilter: "blur(20px)",
                        borderRadius: 16,
                        border: `1px solid ${darkMode ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.15)"}`,
                        boxShadow: darkMode
                            ? "0 8px 32px rgba(245, 158, 11, 0.15), 0 4px 16px rgba(0, 0, 0, 0.3)"
                            : "0 8px 32px rgba(245, 158, 11, 0.1), 0 4px 16px rgba(0, 0, 0, 0.05)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "16px",
                            borderBottom: `1px solid ${darkMode ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.15)"}`,
                            background: darkMode ? "rgba(37, 37, 64, 0.5)" : "rgba(245, 158, 11, 0.05)",
                        }}
                    >
                        <h3
                            style={{
                                margin: 0,
                                fontSize: 14,
                                fontWeight: 600,
                                color: darkMode ? "#e2e8f0" : "#1f2937",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            ⭐ My Favourites
                        </h3>
                        <p
                            style={{
                                margin: "4px 0 0 0",
                                fontSize: 12,
                                color: darkMode ? "#94a3b8" : "#64748b",
                            }}
                        >
                            {favorites.length} {favorites.length === 1 ? 'analysis' : 'analyses'} saved
                        </p>
                    </div>

                    {/* List */}
                    <div
                        style={{
                            overflowY: "auto",
                            flex: 1,
                            padding: "8px",
                        }}
                    >
                        {isLoading ? (
                            <div
                                style={{
                                    padding: "24px 16px",
                                    textAlign: "center",
                                    color: darkMode ? "#94a3b8" : "#64748b",
                                }}
                            >
                                Loading...
                            </div>
                        ) : favorites.length === 0 ? (
                            <div
                                style={{
                                    padding: "24px 16px",
                                    textAlign: "center",
                                    color: darkMode ? "#94a3b8" : "#64748b",
                                    fontSize: 13,
                                }}
                            >
                                <div style={{ fontSize: 32, marginBottom: 8 }}>☆</div>
                                <div>No favourites yet</div>
                                <div style={{ fontSize: 11, marginTop: 4 }}>
                                    Star your analyses to save them here
                                </div>
                            </div>
                        ) : (
                            favorites.map((fav, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: "12px",
                                        marginBottom: "6px",
                                        background: darkMode ? "rgba(37, 37, 64, 0.6)" : "rgba(245, 158, 11, 0.08)",
                                        border: `1px solid ${darkMode ? "rgba(245, 158, 11, 0.3)" : "rgba(245, 158, 11, 0.2)"}`,
                                        borderRadius: 10,
                                        transition: "all 0.25s ease",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: darkMode ? "#e2e8f0" : "#1f2937",
                                            marginBottom: 8,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                        }}
                                    >
                                        {fav.name || "Untitled Analysis"}
                                    </div>
                                    
                                    <div style={{
                                        display: "flex",
                                        gap: 6,
                                        marginTop: 8,
                                    }}>
                                        {/* View Button */}
                                        <button
                                            onClick={() => handleViewClick(fav)}
                                            style={{
                                                flex: 1,
                                                padding: "8px 12px",
                                                background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: 8,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                transition: "all 0.25s ease",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: 6,
                                            }}
                                            onMouseEnter={(e) => {
                                                e.target.style.transform = "translateY(-2px)";
                                                e.target.style.boxShadow = "0 4px 12px rgba(139, 92, 246, 0.3)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.transform = "translateY(0)";
                                                e.target.style.boxShadow = "none";
                                            }}
                                        >
                                            <span>📍</span>
                                            <span>View</span>
                                        </button>

                                        {/* Remove Button - Same style as Chatbot */}
                                        <button
                                            onClick={() => handleRemoveClick(fav)}
                                            style={{
                                                padding: "8px 12px",
                                                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: 8,
                                                fontSize: 16,
                                                cursor: "pointer",
                                                transition: "all 0.25s ease",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.target.style.transform = "scale(1.1)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.transform = "scale(1)";
                                            }}
                                            title="Remove from favourites"
                                        >
                                            ⭐
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {favorites.length > 0 && (
                        <div
                            style={{
                                padding: "8px",
                                borderTop: `1px solid ${darkMode ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.15)"}`,
                                background: darkMode ? "rgba(37, 37, 64, 0.5)" : "rgba(245, 158, 11, 0.05)",
                            }}
                        >
                            <button
                                onClick={fetchFavorites}
                                style={{
                                    width: "100%",
                                    padding: "8px",
                                    background: "transparent",
                                    border: `1px solid ${darkMode ? "#f59e0b" : "#d97706"}`,
                                    color: darkMode ? "#fbbf24" : "#d97706",
                                    borderRadius: 8,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.25s ease",
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
                                    e.target.style.color = "#fff";
                                    e.target.style.border = "1px solid transparent";
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = "transparent";
                                    e.target.style.color = darkMode ? "#fbbf24" : "#d97706";
                                    e.target.style.border = `1px solid ${darkMode ? "#f59e0b" : "#d97706"}`;
                                }}
                            >
                                🔄 Refresh
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FavoritesWidget;
