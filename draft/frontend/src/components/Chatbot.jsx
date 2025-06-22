import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import api from "../api/api"; // If you have a central api.js, otherwise use axios

const API = "http://localhost:3001";

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

  useEffect(() => {
    if (userId) fetchChats();
  }, [userId]);

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

  const handleSend = async () => {
    if (!input.trim() || !selectedChat) return;
    setLoading(true);
    try {
        const res = await axios.post(`${API}/api/chatbot`, { message: input });
        const botResult = res.data;

        // Save conversation and get conversationId
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
                category: botResult.category,
                radius: botResult.radius || 1000,
                nearbyMe: botResult.nearbyMe || false,
                chatId: selectedChat,
                userId: userId,
                conversationId, // Pass it here!
            });
        }

        fetchConversation(selectedChat);
        setInput("");
    } catch (err) {
        alert("Something went wrong.");
    } finally {
        setLoading(false);
    }
  };

  // New: Fetch top 3 recommended locations for an analysisId
  const handleShowRecommendations = async (analysisId) => {
    if (!analysisId) return;
    try {
      // Fetch recommended locations for this analysisId
      const res = await api.get(`/analysis/${analysisId}/recommendations`);
      // You need to implement this endpoint in your backend!
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
    return <div>Please log in to use the chatbot.</div>;
  }

  return (
      <div
          style={{
              display: "flex",
              height: 500,
              width: 400,
              background: darkMode ? "#1e1e1e" : "#fff",
              color: darkMode ? "#e0e0e0" : "#000",
              borderRadius: 16,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              overflow: "hidden",
              flexDirection: "column",
          }}
      >
          {/* Header */}
          <div
              style={{
                  background: darkMode ? "#333" : "#1976d2",
                  color: "#fff",
                  padding: "0.75rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
              }}
          >
              <span style={{ fontWeight: "bold" }}>
                  Business Location Chatbot
              </span>
              <button
                  onClick={onClose}
                  style={{
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      fontSize: 24,
                      cursor: "pointer",
                      marginLeft: 8,
                  }}
                  aria-label="Close Chatbot"
              >
                  ×
              </button>
          </div>
          {/* Body */}
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              {/* Collapsible Sidebar */}
              <div
                  style={{
                      width: sidebarOpen ? 120 : 24,
                      background: darkMode ? "#2b2b2b" : "#f5f5f5",
                      borderRight: `1px solid ${darkMode ? "#444" : "#e0e0e0"}`,
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      minWidth: 0,
                      transition: "width 0.2s",
                      alignItems: sidebarOpen ? "stretch" : "center",
                  }}
              >
                  {/* Title and Collapse Button in a Row */}
                  <div
                      style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8,
                          gap: 4,
                      }}
                  >
                      {sidebarOpen && (
                          <h4 style={{ margin: 0, fontSize: 14, flex: 1 }}>
                              Past Chats
                          </h4>
                      )}
                      <button
                          onClick={() => setSidebarOpen((open) => !open)}
                          style={{
                              background: "#1976d2",
                              color: "#fff",
                              border: "none",
                              borderRadius: 4,
                              width: 24,
                              height: 24,
                              cursor: "pointer",
                              fontWeight: "bold",
                              fontSize: 16,
                              padding: 0,
                              marginLeft: sidebarOpen ? 4 : 0,
                          }}
                          title={sidebarOpen ? "Collapse" : "Expand"}
                      >
                          {sidebarOpen ? "<" : ">"}
                      </button>
                  </div>
                  {sidebarOpen && (
                      <>
                          <ul
                              style={{
                                  listStyle: "none",
                                  padding: 0,
                                  margin: 0,
                                  flex: 1,
                                  overflowY: "auto",
                              }}
                          >
                              {chats.map((chat) => (
                                  <li
                                      key={chat.chatId}
                                      style={{
                                          background:
                                              selectedChat === chat.chatId
                                                  ? "#e3f2fd"
                                                  : "transparent",
                                          marginBottom: 4,
                                          padding: 4,
                                          borderRadius: 6,
                                          cursor: "pointer",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          fontSize: 13,
                                      }}
                                  >
                                      <span
                                          style={{
                                              flex: 1,
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                          }}
                                          onClick={() =>
                                              fetchConversation(chat.chatId)
                                          }
                                          title={chat.title}
                                      >
                                          {chat.title}
                                      </span>
                                      <button
                                          style={{
                                              marginLeft: 4,
                                              color: "#d32f2f",
                                              background: "none",
                                              border: "none",
                                              fontWeight: "bold",
                                              cursor: "pointer",
                                          }}
                                          onClick={() =>
                                              handleDeleteChat(chat.chatId)
                                          }
                                          title="Delete chat"
                                      >
                                          ×
                                      </button>
                                  </li>
                              ))}
                          </ul>
                          {/* New chat input and button */}
                          <input
                              value={newChatTitle}
                              onChange={(e) => setNewChatTitle(e.target.value)}
                              placeholder="New chat title"
                              style={{
                                  width: "100%",
                                  marginBottom: 4,
                                  fontSize: 13,
                                  padding: "6px 8px",
                                  borderRadius: 4,
                                  border: "1px solid #ccc",
                                  boxSizing: "border-box",
                              }}
                          />
                          <button
                              onClick={handleCreateChat}
                              style={{
                                  width: "100%",
                                  fontSize: 14,
                                  padding: "6px 0",
                                  borderRadius: 4,
                                  background: "#1976d2",
                                  color: "#fff",
                                  border: "none",
                                  cursor: "pointer",
                              }}
                          >
                              + New Chat
                          </button>
                      </>
                  )}
              </div>
              {/* Main: Conversation */}
              <div
                  style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      minWidth: 0,
                  }}
              >
                  <div
                      style={{
                          flex: 1,
                          overflowY: "auto",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 12, // This controls all vertical spacing!
                      }}
                  >
                      {conversation.map((msg, idx) => (
                          <div key={idx}>
                              {/* User message */}
                              <div
                                  style={{
                                      display: "flex",
                                      justifyContent: "flex-end",
                                  }}
                              >
                                  <div
                                      style={{
                                          background: "#1976d2",
                                          color: "#fff",
                                          borderRadius: "16px 16px 4px 16px",
                                          padding: "8px 14px",
                                          maxWidth: 200,
                                          wordBreak: "break-word",
                                          whiteSpace: "pre-wrap",
                                          fontSize: 14,
                                          boxShadow:
                                              "0 1px 4px rgba(25, 118, 210, 0.08)",
                                      }}
                                  >
                                      {msg.user_prompt}
                                  </div>
                              </div>
                              {/* Bot message */}
                              <div
                                  style={{
                                      display: "flex",
                                      justifyContent: "flex-start",
                                      flexDirection: "column",
                                  }}
                              >
                                  <div
                                      style={{
                                          background: darkMode
                                              ? "#2a2a2a"
                                              : "#f1f1f1",
                                          color: darkMode ? "#e0e0e0" : "#222",
                                          borderRadius: "16px 16px 16px 4px",
                                          padding: "8px 14px",
                                          maxWidth: 200,
                                          wordBreak: "break-word",
                                          whiteSpace: "pre-wrap",
                                          fontSize: 14,
                                          boxShadow:
                                              "0 1px 4px rgba(0,0,0,0.04)",
                                      }}
                                  >
                                      {(() => {
                                          try {
                                              const parsed = JSON.parse(
                                                  msg.bot_answer
                                              );
                                              return (
                                                  parsed.reason ||
                                                  parsed.text ||
                                                  msg.bot_answer
                                              );
                                          } catch {
                                              return msg.bot_answer;
                                          }
                                      })()}
                                  </div>
                                  {/* Show Recommendations Button */}
                                  {msg.analysisId && (
                                      <button
                                          style={{
                                              marginTop: 8,
                                              background: "#1976d2",
                                              color: "#fff",
                                              border: "none",
                                              borderRadius: 4,
                                              padding: "6px 12px",
                                              fontSize: 13,
                                              cursor: "pointer",
                                              alignSelf: "flex-start",
                                          }}
                                          onClick={() =>
                                              handleShowRecommendations(
                                                  msg.analysisId
                                              )
                                          }
                                      >
                                          Show Recommendations on Map
                                      </button>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
                  {/* Input */}
                  <div
                      style={{
                          display: "flex",
                          gap: 8,
                          padding: 8,
                          borderTop: `1px solid ${darkMode ? "#444" : "#eee"}`,
                          background: darkMode ? "#1a1a1a" : "#fafafa",
                      }}
                  >
                      <textarea
                          rows={2}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Type your message..."
                          style={{
                              flex: 1,
                              fontSize: 13,
                              padding: "6px 8px",
                              borderRadius: 4,
                              border: `1px solid ${darkMode ? "#555" : "#ccc"}`,
                              resize: "none",
                              boxSizing: "border-box",
                              background: darkMode ? "#2e2e2e" : "#fff",
                              color: darkMode ? "#e0e0e0" : "#000",
                          }}
                          disabled={!selectedChat}
                      />
                      <button
                          onClick={handleSend}
                          disabled={loading || !selectedChat}
                          style={{
                              minWidth: 100,
                              fontSize: 14,
                              padding: "6px 0",
                              borderRadius: 4,
                              background: "#1976d2",
                              color: "#fff",
                              border: "none",
                              cursor:
                                  loading || !selectedChat
                                      ? "not-allowed"
                                      : "pointer",
                          }}
                      >
                          {loading ? "Thinking..." : "Send"}
                      </button>
                  </div>
              </div>
          </div>
      </div>
  );
}

export default Chatbot;