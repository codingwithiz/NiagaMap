import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";

const API = "http://localhost:3001";

// Category mappings with default weights (A-B-C-D-E format)
const CATEGORY_PRESETS = {
  retail: { label: "Retail", weights: { demand: 30, competition: 20, accessibility: 25, zoning: 15, risk: 10 } },
  fnb: { label: "Food & Beverage", weights: { demand: 25, competition: 25, accessibility: 25, zoning: 15, risk: 10 } },
  health: { label: "Health & Wellness", weights: { demand: 30, competition: 15, accessibility: 20, zoning: 25, risk: 10 } },
  automotive: { label: "Automotive", weights: { demand: 20, competition: 25, accessibility: 30, zoning: 15, risk: 10 } },
  sports: { label: "Sports & Recreation", weights: { demand: 30, competition: 20, accessibility: 25, zoning: 15, risk: 10 } },
};

const INDICATOR_LABELS = {
  demand: "Demand",
  competition: "Competition",
  accessibility: "Accessibility",
  zoning: "Zoning/Context",
  risk: "Risk/Hazard",
};

const INDICATOR_DESCRIPTIONS = {
  demand: "Population density & target demographics",
  competition: "Density of similar businesses",
  accessibility: "Roads, transport & connectivity",
  zoning: "Legal & regulatory compliance",
  risk: "Environmental & disaster vulnerability",
};

function Chatbot({ onExtracted, onClose, onShowRecommendations, darkMode = false }) {
  const { user } = useAuth();
  const userId = user?.uid;

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);

  // NEW: Category and weight management
  const [selectedCategory, setSelectedCategory] = useState("retail");
  const [weights, setWeights] = useState(CATEGORY_PRESETS.retail.weights);
  const [showWeightPanel, setShowWeightPanel] = useState(false);

  const messagesEndRef = useRef(null);
  const conversationRef = useRef(null);

  useEffect(() => {
    if (userId) fetchChats();
  }, [userId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation]);

  // Update weights when category changes
  useEffect(() => {
    setWeights(CATEGORY_PRESETS[selectedCategory].weights);
  }, [selectedCategory]);

  const fetchChats = async () => {
    if (!userId) return;
    const res = await axios.get(`${API}/chats/${userId}`);
    setChats(res.data);
  };

  const fetchConversation = async (chatId) => {
    const res = await axios.get(`${API}/chats/${chatId}/conversations`);
    setConversation(res.data);
    setSelectedChat(chatId);
  };

  const handleCreateChat = async () => {
    if (!newChatTitle.trim()) return;
    const res = await axios.post(`${API}/chats`, {
      title: newChatTitle,
      thread_id: `thread_${Date.now()}`,
      userId,
      conversation: [],
    });
    setNewChatTitle("");
    fetchChats();
    setSelectedChat(res.data.chatId);
    setConversation([]);
  };

  const handleDeleteChat = async (chatId) => {
    await axios.delete(`${API}/chats/${chatId}`);
    fetchChats();
    setSelectedChat(null);
    setConversation([]);
  };

  // Handle weight slider changes with auto-balancing
  const handleWeightChange = (indicator, newValue) => {
    const oldValue = weights[indicator];
    const delta = newValue - oldValue;
    
    if (delta === 0) return;

    // Get other indicators
    const otherIndicators = Object.keys(weights).filter(k => k !== indicator);
    const otherTotal = otherIndicators.reduce((sum, k) => sum + weights[k], 0);

    // If trying to set to 100, set all others to 0
    if (newValue === 100) {
      const newWeights = { ...weights };
      otherIndicators.forEach(k => newWeights[k] = 0);
      newWeights[indicator] = 100;
      setWeights(newWeights);
      return;
    }

    // Calculate how much to distribute to others
    const newWeights = { ...weights, [indicator]: newValue };
    
    if (otherTotal === 0) {
      // If all others are 0, distribute evenly
      const perIndicator = Math.floor((100 - newValue) / otherIndicators.length);
      let remaining = 100 - newValue;
      otherIndicators.forEach((k, idx) => {
        if (idx === otherIndicators.length - 1) {
          newWeights[k] = remaining;
        } else {
          newWeights[k] = perIndicator;
          remaining -= perIndicator;
        }
      });
    } else {
      // Proportionally adjust others
      const targetOtherTotal = 100 - newValue;
      const scale = targetOtherTotal / otherTotal;
      
      let adjustedTotal = 0;
      otherIndicators.forEach((k, idx) => {
        if (idx === otherIndicators.length - 1) {
          // Last one gets the remainder to ensure exactly 100
          newWeights[k] = targetOtherTotal - adjustedTotal;
        } else {
          const adjusted = Math.round(weights[k] * scale);
          newWeights[k] = adjusted;
          adjustedTotal += adjusted;
        }
      });
    }

    setWeights(newWeights);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || !selectedChat) return;
    setLoading(true);

    try {
      // Ensure weights sum to exactly 100
      const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
      const normalizedWeights = { ...weights };
      if (total !== 100) {
        const scale = 100 / total;
        Object.keys(normalizedWeights).forEach(key => {
          normalizedWeights[key] = Math.round(normalizedWeights[key] * scale);
        });
        // Fix rounding errors
        const newTotal = Object.values(normalizedWeights).reduce((sum, val) => sum + val, 0);
        if (newTotal !== 100) {
          const diff = 100 - newTotal;
          normalizedWeights.demand += diff;
        }
      }

      // Construct enriched message
      const enrichedMessage = `
Category: ${CATEGORY_PRESETS[selectedCategory].label}
Indicator Weights:
- Demand: ${normalizedWeights.demand}%
- Competition: ${normalizedWeights.competition}%
- Accessibility: ${normalizedWeights.accessibility}%
- Zoning/Context: ${normalizedWeights.zoning}%
- Risk/Hazard: ${normalizedWeights.risk}%

User Message: ${input}
      `.trim();

      let botResult;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("message", enrichedMessage);
        const res = await axios.post(`${API}/api/chatbot/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        botResult = res.data;
      } else {
        const res = await axios.post(`${API}/api/chatbot`, { message: enrichedMessage });
        botResult = res.data;
      }

      // Save conversation
      const saveRes = await axios.put(`${API}/chats/${selectedChat}/messages`, {
        user_prompt: input,
        bot_answer: JSON.stringify(botResult),
      });
      const conversationId = saveRes.data.conversationId;

      if (
        onExtracted &&
        (botResult.location || botResult.nearbyMe) &&
        botResult.category
      ) {
        onExtracted({
          location: botResult.location,
          category: selectedCategory,
          radius: botResult.radius || 1000,
          nearbyMe: botResult.nearbyMe || false,
          weights: normalizedWeights,
          chatId: selectedChat,
          userId: userId,
          conversationId,
        });
      }

      fetchConversation(selectedChat);
      setSelectedFile(null);
      setInput("");
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setLoading(false); // ✅ Always stop loading
    }
  };

  const handleShowRecommendations = async (analysisId) => {
    if (!analysisId) return;
    try {
      const res = await api.get(`/analysis/${analysisId}/recommendations`);
      const locations = res.data.locations || [];
      const referencePoint = res.data.referencePoint || null;
      if (onShowRecommendations) {
        onShowRecommendations(locations, referencePoint);
      }
    } catch (err) {
      alert("Failed to fetch recommendations.");
    }
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (userId) {
        try {
          const res = await axios.get(`${API}/users/${userId}`);
          setUserInfo(res.data);
        } catch (err) {
          setUserInfo(null);
        }
      }
    };
    fetchUserInfo();
  }, [userId]);

  if (!userId) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        Please log in to use the chatbot.
      </div>
    );
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const isWeightValid = totalWeight === 100;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        height: "88vh",
        maxHeight: "900px",
        width: "75vw", // ✅ Increased from 65vw
        maxWidth: "1100px", // ✅ Increased from 900px
        minWidth: "800px", // ✅ Increased from 700px
        background: darkMode ? "#1e1e1e" : "#fff",
        color: darkMode ? "#e0e0e0" : "#000",
        borderRadius: 16,
        boxShadow: "0 12px 48px rgba(0,0,0,0.4)",
        overflow: "hidden",
        flexDirection: "column",
        zIndex: 9999,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: darkMode ? "#2d2d2d" : "#1976d2",
          color: "#fff",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `2px solid ${darkMode ? "#444" : "#1565c0"}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>💼</span>
          <span style={{ fontWeight: 600, fontSize: 18 }}>Business Location Assistant</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "#fff",
            fontSize: 26,
            cursor: "pointer",
            borderRadius: 8,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.3)"}
          onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.2)"}
          aria-label="Close Chatbot"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div
          style={{
            width: sidebarOpen ? 280 : 50, // ✅ Increased from 220
            background: darkMode ? "#2b2b2b" : "#f8f9fa",
            borderRight: `1px solid ${darkMode ? "#444" : "#e0e0e0"}`,
            display: "flex",
            flexDirection: "column",
            transition: "width 0.3s ease",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {sidebarOpen && <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Chat History</h4>}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: darkMode ? "#3d3d3d" : "#e3f2fd",
                color: darkMode ? "#e0e0e0" : "#1976d2",
                border: "none",
                borderRadius: 6,
                width: 32,
                height: 32,
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={sidebarOpen ? "Collapse" : "Expand"}
            >
              {sidebarOpen ? "◀" : "▶"}
            </button>
          </div>

          {sidebarOpen && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 12px 12px", gap: 10, minHeight: 0 }}>
              <div style={{ 
                flex: 1, 
                overflowY: "auto", 
                minHeight: 0,
                paddingRight: 6,
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {chats.map((chat) => (
                    <div
                      key={chat.chatId}
                      style={{
                        background: selectedChat === chat.chatId 
                          ? `linear-gradient(135deg, ${darkMode ? "#1976d2" : "#e3f2fd"} 0%, ${darkMode ? "#1565c0" : "#bbdefb"} 100%)` 
                          : "transparent",
                        padding: "12px 14px",
                        borderRadius: 10,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 13,
                        transition: "all 0.2s",
                        border: selectedChat === chat.chatId 
                          ? "2px solid #1976d2" 
                          : `1px solid ${darkMode ? "#3d3d3d" : "#e0e0e0"}`,
                        marginBottom: 8, // ✅ Add spacing between items
                        boxShadow: selectedChat === chat.chatId 
                          ? "0 4px 12px rgba(25, 118, 210, 0.2)" 
                          : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedChat !== chat.chatId) {
                          e.currentTarget.style.background = darkMode ? "#3d3d3d" : "#f5f5f5";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedChat !== chat.chatId) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      {/* ✅ Add icon for active chat */}
                      {selectedChat === chat.chatId && (
                        <span style={{ marginRight: 8, fontSize: 16 }}>💬</span>
                      )}
                      
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: selectedChat === chat.chatId ? 600 : 400,
                        }}
                        onClick={() => fetchConversation(chat.chatId)}
                        title={chat.title}
                      >
                        {chat.title}
                      </span>
                      
                      <button
                        style={{
                          marginLeft: 8,
                          color: "#d32f2f",
                          background: "rgba(211, 47, 47, 0.1)",
                          border: "none",
                          fontWeight: "bold",
                          cursor: "pointer",
                          fontSize: 18,
                          padding: 4,
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.chatId);
                        }}
                        title="Delete chat"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${darkMode ? "#444" : "#e0e0e0"}`, paddingTop: 10 }}>
                <input
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleCreateChat()}
                  placeholder="New chat name..."
                  style={{
                    width: "100%",
                    marginBottom: 6,
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: `1px solid ${darkMode ? "#444" : "#ccc"}`,
                    background: darkMode ? "#2e2e2e" : "#fff",
                    color: darkMode ? "#e0e0e0" : "#000",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={handleCreateChat}
                  disabled={!newChatTitle.trim()}
                  style={{
                    width: "100%",
                    fontSize: 13,
                    padding: "8px 0",
                    borderRadius: 6,
                    background: newChatTitle.trim() ? "#1976d2" : "#bdbdbd",
                    color: "#fff",
                    border: "none",
                    cursor: newChatTitle.trim() ? "pointer" : "not-allowed",
                    fontWeight: 600,
                  }}
                >
                  + New Chat
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Conversation */}
          <div
            ref={conversationRef}
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
            {conversation.length === 0 && (
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
            )}
            
            {conversation.map((msg, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* User Message */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
                    {msg.user_prompt}
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
                    <button
                      style={{
                        background: "linear-gradient(135deg, #4caf50 0%, #45a049 100%)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 16px",
                        fontSize: 13,
                        cursor: "pointer",
                        alignSelf: "flex-start",
                        fontWeight: 600,
                        boxShadow: "0 3px 10px rgba(76, 175, 80, 0.3)",
                        transition: "transform 0.2s",
                      }}
                      onMouseEnter={(e) => e.target.style.transform = "translateY(-2px)"}
                      onMouseLeave={(e) => e.target.style.transform = "translateY(0)"}
                      onClick={() => handleShowRecommendations(msg.analysisId)}
                    >
                      📍 View on Map
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            style={{
              borderTop: `1px solid ${darkMode ? "#444" : "#e0e0e0"}`,
              background: darkMode ? "#252525" : "#fafafa",
              padding: "16px 20px",
              flexShrink: 0,
            }}
          >
            {/* Category & Weights Section */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    disabled={!selectedChat}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: `1px solid ${darkMode ? "#555" : "#ccc"}`,
                      background: darkMode ? "#2e2e2e" : "#fff",
                      color: darkMode ? "#e0e0e0" : "#000",
                      fontSize: 14,
                      cursor: selectedChat ? "pointer" : "not-allowed",
                    }}
                  >
                    {Object.entries(CATEGORY_PRESETS).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ✅ Show current weights inline */}
                <div style={{ 
                  fontSize: 11, 
                  color: darkMode ? "#aaa" : "#666",
                  whiteSpace: "nowrap",
                  padding: "8px 12px",
                  background: darkMode ? "#2a2a2a" : "#f5f5f5",
                  borderRadius: 6,
                }}>
                  D:{weights.demand}% C:{weights.competition}% A:{weights.accessibility}% Z:{weights.zoning}% R:{weights.risk}%
                </div>

                <button
                  onClick={() => setShowWeightPanel(!showWeightPanel)}
                  disabled={!selectedChat}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    background: showWeightPanel ? (darkMode ? "#d32f2f" : "#f44336") : darkMode ? "#3d3d3d" : "#1976d2",
                    color: "#fff",
                    border: "none",
                    cursor: selectedChat ? "pointer" : "not-allowed",
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {showWeightPanel ? "✕" : "⚙️"} Weights
                </button>
              </div>

              {/* Weight Sliders Panel - Compact Grid Layout */}
              {showWeightPanel && (
                <div
                  style={{
                    background: darkMode ? "#2a2a2a" : "#fff",
                    border: `2px solid ${isWeightValid ? "#4caf50" : "#ff9800"}`,
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginBottom: 12,
                    paddingBottom: 10,
                    borderBottom: `1px solid ${darkMode ? "#444" : "#e0e0e0"}`,
                  }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                      Indicator Weights
                    </h4>
                    <span style={{ 
                      fontSize: 18, 
                      fontWeight: 700,
                      color: isWeightValid ? "#4caf50" : "#ff9800",
                    }}>
                      {totalWeight}%
                    </span>
                  </div>

                  {!isWeightValid && (
                    <div style={{
                      background: "rgba(255, 152, 0, 0.1)",
                      border: "1px solid #ff9800",
                      borderRadius: 6,
                      padding: "8px 12px",
                      marginBottom: 12,
                      fontSize: 12,
                      color: "#ff9800",
                      lineHeight: 1.4,
                    }}>
                      ⚠️ Adjusting one slider auto-rebalances others to maintain 100%
                    </div>
                  )}

                  {/* Compact 2-column grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {Object.entries(weights).map(([key, value]) => (
                      <div key={key}>
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center",
                          marginBottom: 5,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            {INDICATOR_LABELS[key]}
                          </div>
                          <span style={{ 
                            fontSize: 16, 
                            fontWeight: 700,
                            color: "#1976d2",
                          }}>
                            {value}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(e) => handleWeightChange(key, parseInt(e.target.value))}
                          style={{ 
                            width: "100%",
                            height: 6,
                            borderRadius: 3,
                            outline: "none",
                            background: `linear-gradient(to right, #1976d2 0%, #1976d2 ${value}%, ${darkMode ? "#444" : "#ddd"} ${value}%, ${darkMode ? "#444" : "#ddd"} 100%)`,
                            cursor: "pointer",
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setWeights(CATEGORY_PRESETS[selectedCategory].weights)}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      padding: "8px",
                      borderRadius: 6,
                      background: darkMode ? "#3d3d3d" : "#f5f5f5",
                      color: darkMode ? "#e0e0e0" : "#000",
                      border: `1px solid ${darkMode ? "#555" : "#ccc"}`,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => e.target.style.background = darkMode ? "#4a4a4a" : "#e0e0e0"}
                    onMouseLeave={(e) => e.target.style.background = darkMode ? "#3d3d3d" : "#f5f5f5"}
                  >
                    🔄 Reset to Default
                  </button>
                </div>
              )}
            </div>

            {/* File Upload */}
            {selectedFile && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
                padding: "7px 12px",
                background: darkMode ? "#2e2e2e" : "#e3f2fd",
                borderRadius: 7,
                border: `1px solid ${darkMode ? "#444" : "#90caf9"}`,
              }}>
                <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  📎 {selectedFile.name}
                </span>
                <button
                  onClick={() => setSelectedFile(null)}
                  style={{
                    color: "#d32f2f",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: 20,
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Message Input */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <label
                htmlFor="file-upload"
                style={{
                  background: darkMode ? "#3d3d3d" : "#e3f2fd",
                  color: darkMode ? "#e0e0e0" : "#1976d2",
                  borderRadius: 8,
                  padding: "10px 12px",
                  cursor: selectedChat ? "pointer" : "not-allowed",
                  fontSize: 20,
                  opacity: selectedChat ? 1 : 0.5,
                  border: `1px solid ${darkMode ? "#555" : "#90caf9"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (selectedChat) e.target.style.background = darkMode ? "#4a4a4a" : "#bbdefb";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = darkMode ? "#3d3d3d" : "#e3f2fd";
                }}
              >
                📎
              </label>
              <input
                id="file-upload"
                type="file"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                style={{ display: "none" }}
                disabled={!selectedChat}
              />

              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={selectedChat ? "Describe your location (e.g., 'clinic near Bangsar within 2km')..." : "Create a chat first"}
                disabled={!selectedChat}
                style={{
                  flex: 1,
                  fontSize: 14,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${darkMode ? "#555" : "#ccc"}`,
                  resize: "none",
                  background: darkMode ? "#2e2e2e" : "#fff",
                  color: darkMode ? "#e0e0e0" : "#000",
                  minHeight: 42,
                  maxHeight: 120,
                  fontFamily: "inherit",
                }}
              />

              <button
                onClick={handleSend}
                disabled={loading || !selectedChat || (!input.trim() && !selectedFile)}
                style={{
                  minWidth: 100,
                  fontSize: 14,
                  padding: "10px 20px",
                  borderRadius: 8,
                  background: loading 
                    ? "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)" // ✅ Orange when loading
                    : loading || !selectedChat || (!input.trim() && !selectedFile)
                      ? darkMode ? "#444" : "#bdbdbd"
                      : "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                  color: "#fff",
                  border: "none",
                  cursor: loading || !selectedChat || (!input.trim() && !selectedFile) ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {loading && (
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid #fff",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                )}
                {loading ? "Analyzing..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;