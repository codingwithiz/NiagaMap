import { forwardRef } from "react";
import { extractCleanMessage, extractCategory, extractWeights } from "../utils/messageUtils";
import EmptyState from "./EmptyState";

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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptyState
          icon="🗺️"
          title="Welcome to NiagaMap AI"
          description="Start a new chat to analyze business locations with AI-powered insights. Our intelligent system will help you find the perfect spot for your business."
          darkMode={darkMode}
        />
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
                    background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                    color: "#fff",
                    padding: "4px 10px",
                    borderRadius: 12,
                    fontWeight: 600,
                  }}>
                    {category}
                  </span>
                  <span style={{
                    background: darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)",
                    color: darkMode ? "#c4b5fd" : "#7c3aed",
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
                  background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                  color: "#fff",
                  borderRadius: "18px 18px 4px 18px",
                  padding: "12px 18px",
                  maxWidth: "70%",
                  wordBreak: "break-word",
                  fontSize: 14,
                  lineHeight: 1.5,
                  boxShadow: "0 4px 16px rgba(139, 92, 246, 0.3)",
                }}
              >
                {cleanMessage}
              </div>
            </div>

            {/* Bot Response */}
            <div style={{ display: "flex", justifyContent: "flex-start", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  background: darkMode ? "rgba(37, 37, 64, 0.8)" : "#f8fafc",
                  color: darkMode ? "#e2e8f0" : "#1f2937",
                  borderRadius: "18px 18px 18px 4px",
                  padding: "12px 18px",
                  maxWidth: "70%",
                  wordBreak: "break-word",
                  fontSize: 14,
                  lineHeight: 1.5,
                  border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
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
                      background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 18px",
                      fontSize: 13,
                      cursor: "pointer",
                      fontWeight: 600,
                      boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                      transition: "all 0.25s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = "translateY(-2px)";
                      e.target.style.boxShadow = "0 6px 20px rgba(139, 92, 246, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 4px 12px rgba(139, 92, 246, 0.3)";
                    }}
                    onClick={() => handleShowRecommendations(msg.analysisId)}
                  >
                    <span style={{ fontSize: 16 }}>📍</span>
                    <span>View Locations on Map</span>
                  </button>

                  <button
                    style={{
                      background: isFavourited 
                        ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                        : darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)",
                      color: isFavourited ? "#fff" : darkMode ? "#c4b5fd" : "#8B5CF6",
                      border: isFavourited ? "none" : `1.5px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`,
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 18,
                      cursor: "pointer",
                      boxShadow: isFavourited 
                        ? "0 4px 12px rgba(245, 158, 11, 0.3)"
                        : "none",
                      transition: "all 0.25s ease",
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