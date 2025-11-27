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
  darkMode 
}) {
  return (
    <div
      style={{
        width: sidebarOpen ? 280 : 50,
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
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 6 }}>
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
                    marginBottom: 8,
                    boxShadow: selectedChat === chat.chatId 
                      ? "0 4px 12px rgba(25, 118, 210, 0.2)" 
                      : "none",
                  }}
                >
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
  );
}

export default ChatSidebar;