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
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${darkMode ? "#555" : "#ccc"}`,
            background: darkMode ? "#2e2e2e" : "#fff",
            color: darkMode ? "#e0e0e0" : "#000",
            fontSize: 14,
            cursor: disabled ? "not-allowed" : "pointer",
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
        color: darkMode ? "#aaa" : "#666",
        whiteSpace: "nowrap",
        padding: "8px 12px",
        background: darkMode ? "#2a2a2a" : "#f5f5f5",
        borderRadius: 6,
      }}>
        D:{weights.demand}% C:{weights.competition}% A:{weights.accessibility}% Z:{weights.zoning}% R:{weights.risk}%
      </div>
    </div>
  );
}

export default CategorySelector;