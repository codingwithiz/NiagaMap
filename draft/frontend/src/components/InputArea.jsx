function InputArea({
  selectedChat,
  selectedFile,
  setSelectedFile,
  input,
  handleInputChange,
  handleSend,
  loading,
  isValidatingLocation,
  locationError,
  showLocationDropdown,
  locationSuggestions,
  handleLocationSelect,
  darkMode
}) {
  return (
    <div
      style={{
        borderTop: `1px solid ${darkMode ? "#444" : "#e0e0e0"}`,
        background: darkMode ? "#252525" : "#fafafa",
        padding: "16px 20px",
        flexShrink: 0,
      }}
    >
      {/* File Upload Preview */}
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
          <span style={{ 
            fontSize: 13, 
            flex: 1, 
            overflow: "hidden", 
            textOverflow: "ellipsis", 
            whiteSpace: "nowrap" 
          }}>
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
        {/* File Upload Button */}
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

        {/* Text Input with Location Dropdown */}
        <div style={{ flex: 1, position: 'relative' }}>
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
            placeholder={selectedChat ? "Describe your location (e.g., 'clinic near Bangsar within 2km')..." : "Create a chat first"}
            disabled={!selectedChat}
            style={{
              width: '100%',
              fontSize: 14,
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px solid ${locationError ? '#d32f2f' : darkMode ? "#555" : "#ccc"}`,
              resize: "none",
              background: darkMode ? "#2e2e2e" : "#fff",
              color: darkMode ? "#e0e0e0" : "#000",
              minHeight: 42,
              maxHeight: 120,
              fontFamily: "inherit",
            }}
          />
          
          {/* Location Error Message */}
          {locationError && (
            <div style={{
              position: 'absolute',
              bottom: -25,
              left: 0,
              fontSize: 11,
              color: '#d32f2f',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              ⚠️ {locationError}
            </div>
          )}
          
          {/* Location Suggestions Dropdown - Updated for ArcGIS format */}
          {showLocationDropdown && locationSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              maxHeight: 200,
              overflowY: 'auto',
              background: darkMode ? "#2e2e2e" : "#fff",
              border: `1px solid ${darkMode ? "#555" : "#ccc"}`,
              borderRadius: 8,
              marginBottom: 8,
              boxShadow: "0 -4px 12px rgba(0,0,0,0.15)",
              zIndex: 1000,
            }}>
              {locationSuggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  onClick={() => handleLocationSelect(suggestion)}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontSize: 13,
                    borderBottom: idx < locationSuggestions.length - 1 
                      ? `1px solid ${darkMode ? "#444" : "#e0e0e0"}` 
                      : "none",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => e.target.style.background = darkMode ? "#3d3d3d" : "#f5f5f5"}
                  onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    📍 {suggestion.text}
                  </div>
                  {suggestion.score && (
                    <div style={{ fontSize: 11, color: darkMode ? "#aaa" : "#666" }}>
                      Score: {suggestion.score}
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
          disabled={loading || isValidatingLocation || !selectedChat || (!input.trim() && !selectedFile)}
          style={{
            minWidth: 100,
            fontSize: 14,
            padding: "10px 20px",
            borderRadius: 8,
            background: isValidatingLocation
              ? "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)"
              : loading || !selectedChat || (!input.trim() && !selectedFile)
                ? darkMode ? "#444" : "#bdbdbd"
                : "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
            color: "#fff",
            border: "none",
            cursor: loading || isValidatingLocation || !selectedChat || (!input.trim() && !selectedFile) ? "not-allowed" : "pointer",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {(loading || isValidatingLocation) && (
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
          {isValidatingLocation ? "Checking..." : loading ? "Analyzing..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default InputArea;