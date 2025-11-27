function ChatbotHeader({ onClose, darkMode }) {
  return (
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
  );
}

export default ChatbotHeader;