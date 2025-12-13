import { forwardRef } from "react";
import { extractCleanMessage, extractCategory, extractWeights } from "../utils/messageUtils";

const ConversationArea = forwardRef(({ 
  conversation, 
  handleShowRecommendations,
  handleToggleFavourite,
  favourites,
  darkMode,
  messagesEndRef 
}, ref) => {
  if (conversation.length === 0) {
    return (
      <div
        ref={ref}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          scrollBehavior: "smooth",
        }}
      >
        <div style={{ 
          textAlign: "center", 
          color: darkMode ? "#888" : "#999",
          marginTop: 40,
          fontSize: 15,
        }}>
          <p style={{ fontSize: 42, marginBottom: 14 }}>👋</p>
          <p style={{ fontSize: 17, fontWeight: 500, marginBottom: 10 }}>
            Welcome! Start a new chat to analyze business locations.
          </p>
          <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
            Select a category, adjust weights, and ask about locations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        scrollBehavior: "smooth",
      }}
    >
      {conversation.map((msg, idx) => {
        const cleanMessage = extractCleanMessage(msg.user_prompt);
        const category = extractCategory(msg.user_prompt);
        const displayWeights = extractWeights(msg.user_prompt);
        const isFavourited = msg.analysisId && favourites.has(msg.analysisId);

        return (
          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* User Message */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              {category && displayWeights && (
                <div style={{
                  display: "flex",
                  gap: 6,
                  fontSize: 11,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}>
                  <span style={{
                    background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                    color: "#fff",
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontWeight: 600,
                  }}>
                    {category}
                  </span>
                  <span style={{
                    background: darkMode ? "#2a2a2a" : "#f5f5f5",
                    color: darkMode ? "#aaa" : "#666",
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontWeight: 500,
                  }}>
                    D:{displayWeights.demand}% C:{displayWeights.competition}% A:{displayWeights.accessibility}% Z:{displayWeights.zoning}% R:{displayWeights.risk}%
                  </span>
                </div>
              )}

              <div
                style={{
                  background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                  color: "#fff",
                  borderRadius: "18px 18px 4px 18px",
                  padding: "12px 18px",
                  maxWidth: "70%",
                  wordBreak: "break-word",
                  fontSize: 14,
                  lineHeight: 1.5,
                  boxShadow: "0 3px 10px rgba(25, 118, 210, 0.3)",
                }}
              >
                {cleanMessage}
              </div>
            </div>

            {/* Bot Response */}
            <div style={{ display: "flex", justifyContent: "flex-start", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  background: darkMode ? "#2a2a2a" : "#f1f3f4",
                  color: darkMode ? "#e0e0e0" : "#222",
                  borderRadius: "18px 18px 18px 4px",
                  padding: "12px 18px",
                  maxWidth: "70%",
                  wordBreak: "break-word",
                  fontSize: 14,
                  lineHeight: 1.5,
                  border: `1px solid ${darkMode ? "#3d3d3d" : "#e0e0e0"}`,
                }}
              >
                {(() => {
                  try {
                    const parsed = JSON.parse(msg.bot_answer);
                    return parsed.reason || parsed.text || msg.bot_answer;
                  } catch {
                    return msg.bot_answer;
                  }
                })()}
              </div>
              
              {msg.analysisId && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    style={{
                      background: "linear-gradient(135deg, #4caf50 0%, #45a049 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 18px",
                      fontSize: 13,
                      cursor: "pointer",
                      fontWeight: 600,
                      boxShadow: "0 3px 10px rgba(76, 175, 80, 0.3)",
                      transition: "transform 0.2s",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = "translateY(-2px)";
                      e.target.style.boxShadow = "0 5px 15px rgba(76, 175, 80, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 3px 10px rgba(76, 175, 80, 0.3)";
                    }}
                    onClick={() => handleShowRecommendations(msg.analysisId)}
                  >
                    <span style={{ fontSize: 16 }}>📍</span>
                    <span>View Locations on Map</span>
                  </button>

                  <button
                    style={{
                      background: isFavourited 
                        ? "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)"
                        : darkMode ? "#3d3d3d" : "#e0e0e0",
                      color: isFavourited ? "#fff" : darkMode ? "#aaa" : "#666",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 18,
                      cursor: "pointer",
                      boxShadow: isFavourited 
                        ? "0 3px 10px rgba(255, 152, 0, 0.3)"
                        : "none",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = "scale(1)";
                    }}
                    onClick={() => handleToggleFavourite(msg.analysisId, cleanMessage)}
                    title={isFavourited ? "Remove from favourites" : "Add to favourites"}
                  >
                    {isFavourited ? "⭐" : "☆"}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
});

ConversationArea.displayName = "ConversationArea";

export default ConversationArea;