import { useRef, useEffect } from "react";

function InputArea({
  selectedChat,
  // selectedFile,
  // setSelectedFile,
  input,
  handleInputChange,
  handleSend,
  loading,
  isValidatingLocation,
  locationError,
  showLocationDropdown,
  locationSuggestions,
  handleLocationSelect,
  darkMode,
  setShowLocationDropdown
}) {
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLocationDropdown(false);
      }
    };

    if (showLocationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLocationDropdown, setShowLocationDropdown]);

  return (
    <div
      style={{
        borderTop: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.15)" : "#e2e8f0"}`,
        background: darkMode 
          ? "linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)" 
          : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        padding: "20px 24px",
        flexShrink: 0,
      }}
    >


      {/* Message Input */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>


        {/* Text Input with Location Dropdown */}
        <div ref={dropdownRef} style={{ flex: 1, position: 'relative' }}>
          <textarea
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={selectedChat ? "Describe your ideal location (e.g., 'clinic near Bangsar within 2km')..." : "Create a chat first"}
            disabled={!selectedChat}
            style={{
              width: '100%',
              fontSize: 14,
              padding: "14px 18px",
              borderRadius: 14,
              border: `2px solid ${locationError ? '#ef4444' : darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
              resize: "none",
              background: darkMode ? "#1a1a2e" : "#fff",
              color: darkMode ? "#f1f5f9" : "#1e293b",
              minHeight: 50,
              maxHeight: 120,
              fontFamily: "inherit",
              transition: "all 0.25s ease",
            }}
            onFocus={(e) => {
              if (!locationError) {
                e.target.style.borderColor = "#8B5CF6";
                e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
              }
            }}
            onBlur={(e) => {
              if (!locationError) {
                e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0";
                e.target.style.boxShadow = "none";
              }
            }}
          />
          
          {/* Location Error Message */}
          {locationError && (
            <div style={{
              position: 'absolute',
              bottom: -22,
              left: 0,
              fontSize: 11,
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 500,
            }}>
              ⚠️ {locationError}
            </div>
          )}
          
          {/* Location Suggestions Dropdown */}
          {showLocationDropdown && locationSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              maxHeight: 220,
              overflowY: 'auto',
              background: darkMode ? "#1a1a2e" : "#fff",
              border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`,
              borderRadius: 14,
              marginBottom: 10,
              boxShadow: darkMode 
                ? "0 -8px 32px rgba(0, 0, 0, 0.4)" 
                : "0 -8px 32px rgba(139, 92, 246, 0.15)",
              zIndex: 1000,
            }}>
              {locationSuggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  onClick={() => handleLocationSelect(suggestion)}
                  style={{
                    padding: "14px 18px",
                    cursor: "pointer",
                    fontSize: 13,
                    borderBottom: idx < locationSuggestions.length - 1 
                      ? `1px solid ${darkMode ? "rgba(139, 92, 246, 0.15)" : "#f1f5f9"}` 
                      : "none",
                    transition: "all 0.2s ease",
                    color: darkMode ? "#f1f5f9" : "#1e293b",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "transparent";
                  }}
                >
                  <div style={{ 
                    fontWeight: 600, 
                    marginBottom: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span style={{ color: "#8B5CF6" }}>📍</span>
                    {suggestion.text}
                  </div>
                  {suggestion.score && (
                    <div style={{ fontSize: 11, color: darkMode ? "#64748b" : "#94a3b8" }}>
                      Relevance: {Math.round(suggestion.score * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={loading || isValidatingLocation || !selectedChat || !input.trim()}
          style={{
            minWidth: 110,
            fontSize: 14,
            padding: "14px 24px",
            borderRadius: 14,
            background: isValidatingLocation
              ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              : loading || !selectedChat || !input.trim()
                ? darkMode ? "#252540" : "#e2e8f0"
                : "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
            color: loading || !selectedChat || !input.trim() 
              ? darkMode ? "#64748b" : "#94a3b8" 
              : "#fff",
            border: "none",
            cursor: loading || isValidatingLocation || !selectedChat || !input.trim() ? "not-allowed" : "pointer",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: loading || !selectedChat || !input.trim() 
              ? "none" 
              : "0 8px 24px rgba(139, 92, 246, 0.3)",
            transition: "all 0.25s ease",
          }}
          onMouseEnter={(e) => {
            if (!loading && !isValidatingLocation && selectedChat && input.trim()) {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 12px 32px rgba(139, 92, 246, 0.4)";
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            if (!loading && !isValidatingLocation && selectedChat && input.trim()) {
              e.target.style.boxShadow = "0 8px 24px rgba(139, 92, 246, 0.3)";
            }
          }}
        >
          {(loading || isValidatingLocation) && (
            <div
              style={{
                width: 16,
                height: 16,
                border: "2px solid rgba(255, 255, 255, 0.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          )}
          {isValidatingLocation ? "Checking..." : loading ? "Analyzing..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default InputArea;