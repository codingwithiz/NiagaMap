function ChatSidebar({ 
  sidebarOpen, 
  setSidebarOpen, 
  chats, 
  selectedChat, 
  fetchConversation, 
  handleDeleteChat, 
  newChatTitle, 
  setNewChatTitle, 
  handleCreateChat,
  favourites = [],
  handleViewFavourite,
  handleRemoveFavourite,
  darkMode 
}) {
  return (
    <div
      style={{
        width: sidebarOpen ? 280 : 50,
        background: darkMode 
          ? "linear-gradient(180deg, rgba(26, 26, 46, 0.95) 0%, rgba(15, 15, 26, 0.98) 100%)" 
          : "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
        borderRight: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)"}`,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {sidebarOpen && (
          <h4 style={{ 
            margin: 0, 
            fontSize: 14, 
            fontWeight: 600,
            background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Chat History
          </h4>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            width: 32,
            height: 32,
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(139, 92, 246, 0.3)",
            transition: "all 0.25s ease",
          }}
          title={sidebarOpen ? "Collapse" : "Expand"}
        >
          {sidebarOpen ? "◀" : "▶"}
        </button>
      </div>

      {sidebarOpen && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 12px 12px", gap: 10, minHeight: 0 }}>
          {/* Favourites Section */}
          {favourites.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <h5 style={{ 
                margin: "0 0 8px 0", 
                fontSize: 12, 
                fontWeight: 600, 
                color: "#8B5CF6",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                ⭐ Favourites
              </h5>
              <div style={{ 
                maxHeight: "200px", 
                overflowY: "auto", 
                display: "flex", 
                flexDirection: "column", 
                gap: 6,
                paddingRight: 6
              }}>
                {favourites.map((fav) => {
                  // Safely handle null or undefined analysis_id
                  const analysisId = fav.analysis_id || '';
                  const displayName = fav.name || `Analysis ${analysisId.substring(0, 8) || 'N/A'}`;
                  
                  return (
                    <div
                      key={fav.favourite_id}
                      style={{
                        background: darkMode 
                          ? "rgba(139, 92, 246, 0.1)" 
                          : "rgba(139, 92, 246, 0.05)",
                        padding: "10px 12px",
                        borderRadius: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                        border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.25)" : "rgba(139, 92, 246, 0.15)"}`,
                        cursor: analysisId ? "pointer" : "default",
                        transition: "all 0.25s ease",
                        opacity: analysisId ? 1 : 0.5,
                      }}
                      onMouseEnter={(e) => {
                        if (analysisId) {
                          e.currentTarget.style.background = darkMode 
                            ? "rgba(139, 92, 246, 0.2)" 
                            : "rgba(139, 92, 246, 0.1)";
                          e.currentTarget.style.transform = "translateX(2px)";
                          e.currentTarget.style.borderColor = "#8B5CF6";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = darkMode 
                          ? "rgba(139, 92, 246, 0.1)" 
                          : "rgba(139, 92, 246, 0.05)";
                        e.currentTarget.style.transform = "translateX(0)";
                        e.currentTarget.style.borderColor = darkMode 
                          ? "rgba(139, 92, 246, 0.25)" 
                          : "rgba(139, 92, 246, 0.15)";
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}
                        onClick={() => analysisId && handleViewFavourite(analysisId)}
                        title={displayName}
                      >
                        📊 {displayName}
                      </span>
                      
                      <button
                        style={{
                          marginLeft: 8,
                          color: "#ef4444",
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "none",
                          fontWeight: "bold",
                          cursor: "pointer",
                          fontSize: 16,
                          padding: 4,
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s ease",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFavourite(analysisId);
                        }}
                        title="Remove from favourites"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ 
                borderTop: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)"}`, 
                marginTop: 10, 
                paddingTop: 10 
              }} />
            </div>
          )}

          {/* Chat History Section */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 6 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {chats.map((chat) => (
                <div
                  key={chat.chat_id}
                  style={{
                    background: selectedChat === chat.chat_id 
                      ? "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.15) 100%)" 
                      : "transparent",
                    padding: "12px 14px",
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                    transition: "all 0.25s ease",
                    border: selectedChat === chat.chat_id 
                      ? "1.5px solid #8B5CF6" 
                      : `1px solid ${darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)"}`,
                    marginBottom: 8,
                    boxShadow: selectedChat === chat.chat_id 
                      ? "0 4px 12px rgba(139, 92, 246, 0.2)" 
                      : "none",
                  }}
                >
                  {selectedChat === chat.chat_id && (
                    <span style={{ marginRight: 8, fontSize: 16 }}>💬</span>
                  )}
                  
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: selectedChat === chat.chat_id ? 600 : 400,
                    }}
                    onClick={() => fetchConversation(chat.chat_id)}
                    title={chat.title}
                  >
                    {chat.title}
                  </span>
                  
                  <button
                    style={{
                      marginLeft: 8,
                      color: "#ef4444",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontSize: 18,
                      padding: 4,
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(chat.chat_id);
                    }}
                    title="Delete chat"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)"}`, paddingTop: 10 }}>
            <input
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleCreateChat()}
              placeholder="New chat name..."
              style={{
                width: "100%",
                marginBottom: 6,
                fontSize: 13,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1.5px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`,
                background: darkMode ? "rgba(37, 37, 64, 0.6)" : "#fff",
                color: darkMode ? "#e2e8f0" : "#1f2937",
                boxSizing: "border-box",
                outline: "none",
                transition: "all 0.25s ease",
              }}
              onFocus={(e) => {
                e.target.style.border = "1.5px solid #8B5CF6";
                e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
              }}
              onBlur={(e) => {
                e.target.style.border = `1.5px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`;
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              onClick={handleCreateChat}
              disabled={!newChatTitle.trim()}
              style={{
                width: "100%",
                fontSize: 13,
                padding: "10px 0",
                borderRadius: 10,
                background: newChatTitle.trim() 
                  ? "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)" 
                  : darkMode ? "rgba(100, 116, 139, 0.3)" : "#e2e8f0",
                color: newChatTitle.trim() ? "#fff" : darkMode ? "#64748b" : "#94a3b8",
                border: "none",
                cursor: newChatTitle.trim() ? "pointer" : "not-allowed",
                fontWeight: 600,
                boxShadow: newChatTitle.trim() ? "0 4px 12px rgba(139, 92, 246, 0.3)" : "none",
                transition: "all 0.25s ease",
              }}
            >
              + New Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatSidebar;