function ChatbotHeader({ onClose, darkMode }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
        color: "#fff",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "rgba(255, 255, 255, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(10px)",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div>
          <span style={{ fontWeight: 600, fontSize: 17, display: "block" }}>NiagaMap AI</span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Location Intelligence Assistant</span>
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: "rgba(255, 255, 255, 0.15)",
          border: "none",
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
          borderRadius: 10,
          width: 38,
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          backdropFilter: "blur(10px)",
        }}
        onMouseEnter={(e) => {
          e.target.style.background = "rgba(255, 255, 255, 0.25)";
          e.target.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.target.style.background = "rgba(255, 255, 255, 0.15)";
          e.target.style.transform = "scale(1)";
        }}
        aria-label="Close Assistant"
      >
        ×
      </button>
    </div>
  );
}

export default ChatbotHeader;