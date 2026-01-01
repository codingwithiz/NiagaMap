import { INDICATOR_LABELS } from "../constants/chatbotConstants";

function WeightPanel({ 
  showWeightPanel, 
  weights, 
  lockedIndicators,
  toggleLock,
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
        background: darkMode ? "rgba(37, 37, 64, 0.8)" : "#fff",
        border: `2px solid ${isWeightValid ? "#10b981" : "#f59e0b"}`,
        borderRadius: 12,
        padding: 16,
        boxShadow: isWeightValid 
          ? "0 4px 12px rgba(16, 185, 129, 0.15)"
          : "0 4px 12px rgba(245, 158, 11, 0.15)",
      }}
    >
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: 12,
        paddingBottom: 10,
        borderBottom: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
      }}>
        <h4 style={{ 
          margin: 0, 
          fontSize: 14, 
          fontWeight: 600,
          background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Indicator Weights
        </h4>
        <span style={{ 
          fontSize: 18, 
          fontWeight: 700,
          color: isWeightValid ? "#10b981" : "#f59e0b",
        }}>
          {totalWeight}%
        </span>
      </div>

      {!isWeightValid && (
        <div style={{
          background: "rgba(245, 158, 11, 0.1)",
          border: "1px solid #f59e0b",
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 12,
          fontSize: 12,
          color: "#f59e0b",
          lineHeight: 1.4,
        }}>
          ⚠️ Adjusting unlocked sliders auto-rebalances to maintain 100%
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {Object.entries(weights).map(([key, value]) => {
          const isLocked = lockedIndicators[key];
          
          return (
            <div key={key}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: 5,
              }}>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 6 
                }}>
                  {/* Lock Checkbox */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isLocked}
                      onChange={() => toggleLock(key)}
                      style={{
                        width: 16,
                        height: 16,
                        cursor: "pointer",
                        accentColor: "#8B5CF6",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        marginLeft: 4,
                        userSelect: "none",
                      }}
                      title={isLocked ? "Locked" : "Unlocked"}
                    >
                      {isLocked ? "🔒" : "🔓"}
                    </span>
                  </label>
                  
                  <div style={{ 
                    fontSize: 12, 
                    fontWeight: 600,
                    color: isLocked ? "#8B5CF6" : "inherit",
                  }}>
                    {INDICATOR_LABELS[key]}
                  </div>
                </div>
                
                <span style={{ 
                  fontSize: 16, 
                  fontWeight: 700,
                  color: "#8B5CF6",
                  background: isLocked ? "rgba(139, 92, 246, 0.15)" : "transparent",
                  padding: "2px 8px",
                  borderRadius: 6,
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
                disabled={isLocked}
                style={{ 
                  width: "100%",
                  height: 6,
                  borderRadius: 3,
                  outline: "none",
                  background: isLocked
                    ? `linear-gradient(to right, #c4b5fd 0%, #c4b5fd ${value}%, ${darkMode ? "#374151" : "#e2e8f0"} ${value}%, ${darkMode ? "#374151" : "#e2e8f0"} 100%)`
                    : `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${value}%, ${darkMode ? "#374151" : "#e2e8f0"} ${value}%, ${darkMode ? "#374151" : "#e2e8f0"} 100%)`,
                  cursor: isLocked ? "not-allowed" : "pointer",
                  opacity: isLocked ? 0.6 : 1,
                }}
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={resetWeights}
        style={{
          marginTop: 14,
          width: "100%",
          padding: "10px",
          borderRadius: 10,
          background: darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)",
          color: darkMode ? "#c4b5fd" : "#7c3aed",
          border: `1.5px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          transition: "all 0.25s ease",
        }}
        onMouseEnter={(e) => {
          e.target.style.background = "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)";
          e.target.style.color = "#fff";
          e.target.style.border = "1.5px solid transparent";
        }}
        onMouseLeave={(e) => {
          e.target.style.background = darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)";
          e.target.style.color = darkMode ? "#c4b5fd" : "#7c3aed";
          e.target.style.border = `1.5px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`;
        }}
      >
        🔄 Reset All (Unlock & Restore Defaults)
      </button>
    </div>
  );
}

export default WeightPanel;