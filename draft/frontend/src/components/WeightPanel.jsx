import { INDICATOR_LABELS } from "../constants/chatbotConstants";

function WeightPanel({ 
  showWeightPanel, 
  weights, 
  handleWeightChange, 
  resetWeights, 
  totalWeight, 
  isWeightValid, 
  darkMode 
}) {
  if (!showWeightPanel) return null;

  return (
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
        onClick={resetWeights}
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
  );
}

export default WeightPanel;