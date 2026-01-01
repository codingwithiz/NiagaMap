const SkeletonLoader = ({ darkMode = false, count = 1, type = "card" }) => {
  const shimmerKeyframes = `
    @keyframes shimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }
  `;

  const baseStyle = {
    background: darkMode
      ? "linear-gradient(90deg, rgba(26, 26, 46, 0.6) 0%, rgba(139, 92, 246, 0.1) 50%, rgba(26, 26, 46, 0.6) 100%)"
      : "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
    backgroundSize: "1000px 100%",
    animation: "shimmer 2s infinite linear",
    borderRadius: 12,
  };

  // Card skeleton for Analysis page
  const AnalysisCardSkeleton = () => (
    <div
      style={{
        background: darkMode ? "rgba(26, 26, 46, 0.8)" : "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(20px)",
        borderRadius: 16,
        padding: "20px 24px",
        border: `1.5px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.15)"}`,
        marginBottom: 16,
      }}
    >
      {/* Header skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          {/* Title */}
          <div style={{ ...baseStyle, height: 24, width: "60%", marginBottom: 12 }} />
          {/* Subtitle */}
          <div style={{ ...baseStyle, height: 16, width: "40%", marginBottom: 8 }} />
          {/* Date */}
          <div style={{ ...baseStyle, height: 14, width: "30%" }} />
        </div>
        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ ...baseStyle, width: 32, height: 32, borderRadius: 8 }} />
          <div style={{ ...baseStyle, width: 32, height: 32, borderRadius: 8 }} />
          <div style={{ ...baseStyle, width: 32, height: 32, borderRadius: 8 }} />
        </div>
      </div>

      {/* Content rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...baseStyle, height: 14, width: "80%" }} />
        <div style={{ ...baseStyle, height: 14, width: "70%" }} />
        <div style={{ ...baseStyle, height: 14, width: "90%" }} />
      </div>
    </div>
  );

  // Simple line skeleton
  const LineSkeleton = ({ width = "100%" }) => (
    <div style={{ ...baseStyle, height: 16, width, marginBottom: 12 }} />
  );

  // Circle skeleton for avatars/icons
  const CircleSkeleton = ({ size = 48 }) => (
    <div style={{ ...baseStyle, width: size, height: size, borderRadius: "50%" }} />
  );

  return (
    <>
      <style>{shimmerKeyframes}</style>
      {type === "card" && Array.from({ length: count }).map((_, idx) => (
        <AnalysisCardSkeleton key={idx} />
      ))}
      {type === "line" && Array.from({ length: count }).map((_, idx) => (
        <LineSkeleton key={idx} />
      ))}
      {type === "circle" && <CircleSkeleton />}
    </>
  );
};

export default SkeletonLoader;
