const EmptyState = ({ 
  icon = "📭", 
  title = "No items found", 
  description = "There are no items to display at this time.", 
  actionLabel,
  onAction,
  darkMode = false 
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 40px",
        textAlign: "center",
        minHeight: 400,
      }}
    >
      {/* Icon with gradient background */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: darkMode
            ? "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)"
            : "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 48,
          marginBottom: 32,
          border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`,
          animation: "float 3s ease-in-out infinite",
        }}
      >
        {icon}
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: 24,
          fontWeight: 700,
          background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: 12,
          letterSpacing: "-0.5px",
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: 15,
          color: darkMode ? "#94a3b8" : "#64748b",
          maxWidth: 420,
          lineHeight: 1.6,
          marginBottom: actionLabel ? 32 : 0,
        }}
      >
        {description}
      </p>

      {/* Optional Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            padding: "14px 32px",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 14,
            background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(139, 92, 246, 0.3)",
            transition: "all 0.25s ease",
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 12px 32px rgba(139, 92, 246, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 8px 24px rgba(139, 92, 246, 0.3)";
          }}
        >
          {actionLabel}
        </button>
      )}

      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
        `}
      </style>
    </div>
  );
};

export default EmptyState;
