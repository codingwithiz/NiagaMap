import { CATEGORY_PRESETS } from "../constants/chatbotConstants";

function CategorySelector({ selectedCategory, setSelectedCategory, weights, disabled, darkMode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ flex: 1 }}>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          disabled={disabled}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1.5px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`,
            background: darkMode ? "rgba(37, 37, 64, 0.6)" : "#fff",
            color: darkMode ? "#e2e8f0" : "#1f2937",
            fontSize: 14,
            cursor: disabled ? "not-allowed" : "pointer",
            outline: "none",
            transition: "all 0.25s ease",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {Object.entries(CATEGORY_PRESETS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ 
        fontSize: 11, 
        color: darkMode ? "#c4b5fd" : "#7c3aed",
        whiteSpace: "nowrap",
        padding: "10px 14px",
        background: darkMode ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.1)",
        borderRadius: 10,
        fontWeight: 500,
        border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.25)" : "rgba(139, 92, 246, 0.15)"}`,
      }}>
        D:{weights.demand}% C:{weights.competition}% A:{weights.accessibility}% Z:{weights.zoning}% R:{weights.risk}%
      </div>
    </div>
  );
}

export default CategorySelector;