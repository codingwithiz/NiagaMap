import React, { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import EmptyState from "./EmptyState";
import SkeletonLoader from "./SkeletonLoader";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";


const Analysis = ({darkMode = false}) => {
    const { user } = useAuth();
    const { showToast } = useToast();
     // Assuming from context
    const userId = user?.uid;

    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [chatIds, setChatIds] = useState([]);
    const [referenceNames, setReferenceNames] = useState([]);
    const [selectedChatId, setSelectedChatId] = useState("all");
    const [selectedRefName, setSelectedRefName] = useState("all");
    const [selectedDate, setSelectedDate] = useState("");
    const [sortOrder, setSortOrder] = useState("desc");

    const [showModal, setShowModal] = useState(false);
    const [selectedAnalysis, setSelectedAnalysis] = useState(null);
    const [formData, setFormData] = useState({ name: "", lat: "", lon: "" });

    useEffect(() => {
        fetchAnalyses();
    }, []);

    const fetchAnalyses = async () => {
        try {
            const response = await api.get(`/analysis/${userId}`);
            const allAnalyses = response.data.analyses;
            setAnalyses(allAnalyses);

            const uniqueChatIds = Array.from(
                new Set(allAnalyses.map((a) => a.chatId))
            );
            const uniqueRefNames = Array.from(
                new Set(
                    allAnalyses
                        .map((a) => a.referencePoint?.name)
                        .filter((name) => name != null)
                )
            );

            setChatIds(uniqueChatIds);
            setReferenceNames(uniqueRefNames);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch analyses.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (analysisId) => {
        if (!window.confirm("Are you sure you want to delete this analysis?"))
            return;
        try {
            await api.delete(`/analysis/${analysisId}`);
            setAnalyses((prev) =>
                prev.filter((a) => a.analysisId !== analysisId)
            );
            showToast("Analysis deleted successfully!", "success");
        } catch (err) {
            console.error("Failed to delete analysis:", err);
            showToast("Failed to delete analysis.", "error");
        }
    };

    const openUpdateModal = (analysis) => {
        setSelectedAnalysis(analysis);
        setFormData({
            name: analysis.referencePoint?.name || "",
            lat: analysis.referencePoint?.lat || "",
            lon: analysis.referencePoint?.lon || "",
        });
        setShowModal(true);
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.patch(
                `/analysis/${selectedAnalysis.analysisId}`,
                formData
            );
            setShowModal(false);
            fetchAnalyses();
            showToast("Analysis updated successfully!", "success");
        } catch (err) {
            console.error("Failed to update:", err);
            showToast("Failed to update analysis.", "error");
        }
    };

    const handleExportPDF = async (analysis) => {
        try {
            showToast("Generating PDF... This may take a moment.", "info", 3000);

            // Fetch recommended locations for this analysis
            let locations = [];
            try {
                const recsResponse = await api.get(`/analysis/${analysis.analysisId}/recommendations`);
                locations = recsResponse.data.locations || [];
                
                // Map to match PDF expectations: breakdown -> score_breakdown, reason -> ai_reason
                locations = locations.map(loc => ({
                    ...loc,
                    score_breakdown: loc.breakdown,  // Already parsed by backend
                    ai_reason: loc.reason             // AI reasoning text
                }));
            } catch (err) {
                console.warn("Could not fetch recommendations:", err);
            }

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 20;
            let yPos = margin;

            const checkPageBreak = (requiredSpace) => {
                if (yPos + requiredSpace > pageHeight - 20) {
                    pdf.addPage();
                    yPos = margin;
                    return true;
                }
                return false;
            };

            // Header with gradient effect (simulated with rectangles)
            pdf.setFillColor(139, 92, 246);
            pdf.rect(0, 0, pageWidth, 30, 'F');
            
            // Title
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(24);
            pdf.setFont('helvetica', 'bold');
            pdf.text('NiagaMap Analysis Report', margin, 20);
            
            yPos = 45;
            pdf.setTextColor(0, 0, 0);

            // Analysis Info Section
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Analysis Details', margin, yPos);
            yPos += 10;

            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            
            // Reference Point
            pdf.setFont('helvetica', 'bold');
            pdf.text('Reference Point:', margin, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(analysis.referencePoint?.name || 'N/A', margin + 50, yPos);
            yPos += 8;

            // Coordinates
            pdf.setFont('helvetica', 'bold');
            pdf.text('Coordinates:', margin, yPos);
            pdf.setFont('helvetica', 'normal');
            const coords = `${analysis.referencePoint?.lat?.toFixed(4) || 'N/A'}, ${analysis.referencePoint?.lon?.toFixed(4) || 'N/A'}`;
            pdf.text(coords, margin + 50, yPos);
            yPos += 8;

            // Analysis ID
            pdf.setFont('helvetica', 'bold');
            pdf.text('Analysis ID:', margin, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(analysis.analysisId.substring(0, 16) + '...', margin + 50, yPos);
            yPos += 8;

            // Created At
            pdf.setFont('helvetica', 'bold');
            pdf.text('Created:', margin, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(formatDateTime(analysis.createdAt), margin + 50, yPos);
            yPos += 15;

            // Weights Section
            if (analysis.weights) {
                checkPageBreak(40);
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Analysis Weights', margin, yPos);
                yPos += 8;

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                
                const weights = JSON.parse(analysis.weights);
                Object.entries(weights).forEach(([key, value]) => {
                    const displayKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                    pdf.text(`${displayKey}: ${(value * 100).toFixed(0)}%`, margin + 5, yPos);
                    yPos += 6;
                });
                yPos += 10;
            }

            // Recommended Locations Section
            if (locations && locations.length > 0) {
                checkPageBreak(50);
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Recommended Locations', margin, yPos);
                yPos += 10;

                locations.forEach((loc, index) => {
                    checkPageBreak(80);

                    // Location box background - make it taller for more content
                    const boxHeight = 70 + (loc.reasoning ? 15 : 0) + (loc.score_breakdown ? 20 : 0);
                    pdf.setFillColor(245, 247, 250);
                    pdf.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, boxHeight, 3, 3, 'F');

                    // Location number and name - use "Location 1", "Location 2" format
                    pdf.setFontSize(13);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(139, 92, 246);
                    pdf.text(`${index + 1}. Location ${index + 1}`, margin + 3, yPos);
                    yPos += 8;

                    pdf.setTextColor(0, 0, 0);
                    pdf.setFontSize(9);
                    pdf.setFont('helvetica', 'normal');

                    // Address
                    if (loc.address) {
                        const addressLines = pdf.splitTextToSize(loc.address, pageWidth - 2 * margin - 10);
                        pdf.text(addressLines, margin + 3, yPos);
                        yPos += addressLines.length * 4 + 2;
                    }

                    // Score
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(34, 197, 94);
                    pdf.text(`Suitability Score: ${loc.score?.toFixed(1) || 'N/A'}%`, margin + 3, yPos);
                    yPos += 6;
                    pdf.setTextColor(0, 0, 0);

                    // Score Breakdown
                    if (loc.score_breakdown) {
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(8);
                        pdf.text('Score Breakdown:', margin + 3, yPos);
                        yPos += 5;
                        
                        pdf.setFont('helvetica', 'normal');
                        const breakdown = loc.score_breakdown;
                        
                        // Extract score from nested objects
                        Object.entries(breakdown).forEach(([key, value]) => {
                            if (value && typeof value === 'object' && 'score' in value) {
                                const displayKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                                const scoreValue = typeof value.score === 'number' ? value.score.toFixed(1) : 'N/A';
                                pdf.text(`  • ${displayKey}: ${scoreValue}`, margin + 5, yPos);
                                yPos += 4;
                            }
                        });
                        yPos += 2;
                    }

                    // Distance
                    if (loc.distance_km) {
                        pdf.setFontSize(9);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(`Distance from reference: ${loc.distance_km.toFixed(2)} km`, margin + 3, yPos);
                        yPos += 5;
                    }

                    // Coordinates
                    if (loc.lat && loc.lon) {
                        pdf.text(`Coordinates: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`, margin + 3, yPos);
                        yPos += 6;
                    }

                    // AI Reasoning
                    if (loc.ai_reason) {
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(8);
                        pdf.setTextColor(0, 0, 0);
                        pdf.text('AI Analysis:', margin + 3, yPos);
                        yPos += 5;
                        
                        pdf.setFont('helvetica', 'italic');
                        pdf.setFontSize(9);
                        pdf.setTextColor(60, 60, 60);
                        const reasoningLines = pdf.splitTextToSize(`"${loc.ai_reason}"`, pageWidth - 2 * margin - 10);
                        pdf.text(reasoningLines, margin + 3, yPos);
                        yPos += reasoningLines.length * 4 + 3;
                        pdf.setTextColor(0, 0, 0);
                    }

                    // Quick Links Section
                    if (loc.lat && loc.lon) {
                        checkPageBreak(15);
                        pdf.setFont('helvetica', 'bold');
                        pdf.setFontSize(8);
                        pdf.setTextColor(0, 0, 0);
                        pdf.text('Quick Links:', margin + 3, yPos);
                        yPos += 5;

                        pdf.setFont('helvetica', 'underline');
                        pdf.setFontSize(9);
                        
                        // OpenStreetMap Link
                        const osmUrl = `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=19/${loc.lat}/${loc.lon}`;
                        pdf.setTextColor(139, 92, 246); // Purple
                        pdf.textWithLink('View on OpenStreetMap', margin + 5, yPos, { url: osmUrl });
                        yPos += 6;
                        
                        // Google Maps Navigation Link
                        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`;
                        pdf.setTextColor(59, 130, 246); // Blue
                        pdf.textWithLink('Navigate with Google Maps', margin + 5, yPos, { url: googleMapsUrl });
                        yPos += 6;
                        
                        pdf.setTextColor(0, 0, 0);
                        pdf.setFont('helvetica', 'normal');
                    }

                    yPos += 10;
                });
            } else {
                checkPageBreak(20);
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'italic');
                pdf.setTextColor(100, 100, 100);
                pdf.text('No recommended locations available for this analysis.', margin, yPos);
                yPos += 10;
            }

            // Footer
            const footerY = pageHeight - 15;
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.text('Generated by NiagaMap - AI-Powered Location Intelligence', pageWidth / 2, footerY, { align: 'center' });
            pdf.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 5, { align: 'center' });

            // Save PDF
            const fileName = `NiagaMap_Analysis_${analysis.referencePoint?.name?.replace(/[^a-z0-9]/gi, '_') || 'Report'}_${new Date().getTime()}.pdf`;
            pdf.save(fileName);
            
            showToast("PDF exported successfully!", "success");
        } catch (err) {
            console.error("Failed to export PDF:", err);
            showToast("Failed to export PDF. Please try again.", "error");
        }
    };

    const getFilteredAndSortedAnalyses = () => {
        let filtered = analyses.filter((a) => {
            const chatMatch =
                selectedChatId === "all" || a.chatId === selectedChatId;
            const refMatch =
                selectedRefName === "all" ||
                (a.referencePoint && a.referencePoint.name === selectedRefName);
            const dateMatch =
                !selectedDate ||
                (() => {
                    // Parse both as UTC to avoid timezone issues
                    const created = new Date(a.createdAt);
                    const selected = new Date(selectedDate + 'T00:00:00Z');
                    return (
                        created.getUTCFullYear() === selected.getUTCFullYear() &&
                        created.getUTCMonth() === selected.getUTCMonth() &&
                        created.getUTCDate() === selected.getUTCDate()
                    );
                })();
            return chatMatch && refMatch && dateMatch;
        });

        return filtered.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        });
    };

    const filteredAnalyses = getFilteredAndSortedAnalyses();

    const formatDateTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    };

    if (loading)
        return (
            <div style={{
                minHeight: "100vh",
                background: darkMode ? "#0f0f1a" : "#f8fafc",
                padding: "40px 20px",
            }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <SkeletonLoader darkMode={darkMode} count={3} type="card" />
                </div>
            </div>
        );
    if (error) return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: darkMode ? "#0f0f1a" : "#f8fafc",
        }}>
            <div style={{
                padding: "20px 32px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: 12,
                color: "#ef4444",
            }}>
                {error}
            </div>
        </div>
    );

    return (
        <div style={{
            minHeight: "100vh",
            padding: "32px",
            background: darkMode 
                ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)" 
                : "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)",
        }}>
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                {/* Header */}
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{
                        fontSize: 32,
                        fontWeight: 700,
                        background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        marginBottom: 8,
                    }}>
                        Analysis Results
                    </h1>
                    <p style={{ color: darkMode ? "#94a3b8" : "#64748b", fontSize: 14 }}>
                        View and manage your location analysis history
                    </p>
                </div>

                {/* Filters Card */}
                <div style={{
                    background: darkMode ? "rgba(26, 26, 46, 0.8)" : "rgba(255, 255, 255, 0.9)",
                    backdropFilter: "blur(20px)",
                    borderRadius: 20,
                    padding: 24,
                    marginBottom: 32,
                    border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
                    boxShadow: darkMode 
                        ? "0 8px 32px rgba(0, 0, 0, 0.3)" 
                        : "0 8px 32px rgba(139, 92, 246, 0.1)",
                }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                        {/* Chat ID Filter */}
                        <div style={{ flex: "1 1 200px" }}>
                            <label style={{
                                display: "block",
                                marginBottom: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                color: darkMode ? "#94a3b8" : "#64748b",
                            }}>
                                Filter by Chat ID
                            </label>
                            <select
                                value={selectedChatId}
                                onChange={(e) => setSelectedChatId(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                    background: darkMode ? "#1a1a2e" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    transition: "all 0.25s ease",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#8B5CF6"}
                                onBlur={(e) => e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}
                            >
                                <option value="all">All Chats</option>
                                {chatIds.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Reference Point Filter */}
                        <div style={{ flex: "1 1 200px" }}>
                            <label style={{
                                display: "block",
                                marginBottom: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                color: darkMode ? "#94a3b8" : "#64748b",
                            }}>
                                Filter by Reference Point
                            </label>
                            <select
                                value={selectedRefName}
                                onChange={(e) => setSelectedRefName(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                    background: darkMode ? "#1a1a2e" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    transition: "all 0.25s ease",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#8B5CF6"}
                                onBlur={(e) => e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}
                            >
                                <option value="all">All Reference Points</option>
                                {referenceNames.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Filter */}
                        <div style={{ flex: "1 1 200px", position: "relative" }}>
                            <label style={{
                                display: "block",
                                marginBottom: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                color: darkMode ? "#94a3b8" : "#64748b",
                            }}>
                                Filter by Date
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                    background: darkMode ? "#1a1a2e" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    fontSize: 14,
                                    transition: "all 0.25s ease",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#8B5CF6"}
                                onBlur={(e) => e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}
                            />
                            {selectedDate && (
                                <button
                                    onClick={() => setSelectedDate("")}
                                    style={{
                                        position: "absolute",
                                        right: 12,
                                        top: "50%",
                                        transform: "translateY(25%)",
                                        background: "none",
                                        border: "none",
                                        color: "#64748b",
                                        cursor: "pointer",
                                        fontSize: 16,
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        {/* Sort Order */}
                        <div style={{ flex: "1 1 200px" }}>
                            <label style={{
                                display: "block",
                                marginBottom: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                color: darkMode ? "#94a3b8" : "#64748b",
                            }}>
                                Sort Order
                            </label>
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                    background: darkMode ? "#1a1a2e" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    fontSize: 14,
                                    cursor: "pointer",
                                    transition: "all 0.25s ease",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#8B5CF6"}
                                onBlur={(e) => e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}
                            >
                                <option value="desc">Newest First</option>
                                <option value="asc">Oldest First</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Render each analysis */}
                {filteredAnalyses.length === 0 ? (
                    <EmptyState
                        icon={analyses.length === 0 ? "🗺️" : "🔍"}
                        title={analyses.length === 0 ? "No Analyses Yet" : "No Results Found"}
                        description={
                            analyses.length === 0
                                ? "Start exploring locations with our AI-powered analysis tool. Create your first analysis from the chatbot!"
                                : "Try adjusting your filters or search criteria to find analyses."
                        }
                        darkMode={darkMode}
                    />
                ) : (
                    filteredAnalyses.map((analysis) => (
                        <div
                            key={analysis.analysisId}
                            style={{
                                background: darkMode ? "rgba(26, 26, 46, 0.8)" : "rgba(255, 255, 255, 0.9)",
                                backdropFilter: "blur(20px)",
                                borderRadius: 20,
                                padding: 28,
                                marginBottom: 24,
                                border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
                                boxShadow: darkMode 
                                    ? "0 8px 32px rgba(0, 0, 0, 0.3)" 
                                    : "0 8px 32px rgba(139, 92, 246, 0.08)",
                                transition: "all 0.3s ease",
                            }}
                        >
                            {/* Analysis Header */}
                            <div style={{ 
                                display: "flex", 
                                justifyContent: "space-between", 
                                alignItems: "flex-start",
                                marginBottom: 24,
                                flexWrap: "wrap",
                                gap: 16,
                            }}>
                                <div>
                                    <h2 style={{
                                        fontSize: 20,
                                        fontWeight: 600,
                                        color: darkMode ? "#f1f5f9" : "#1e293b",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        marginBottom: 8,
                                    }}>
                                        <span style={{ color: "#8B5CF6" }}>📍</span>
                                        {analysis.referencePoint?.name || (
                                            <span style={{ color: "#64748b", fontStyle: "italic" }}>No reference</span>
                                        )}
                                    </h2>
                                    <div style={{ 
                                        display: "flex", 
                                        flexWrap: "wrap", 
                                        gap: 16,
                                        fontSize: 13,
                                        color: darkMode ? "#94a3b8" : "#64748b",
                                    }}>
                                        <span>
                                            Lat: {analysis.referencePoint?.lat?.toFixed(6) ?? "N/A"}
                                        </span>
                                        <span>
                                            Lon: {analysis.referencePoint?.lon?.toFixed(6) ?? "N/A"}
                                        </span>
                                        <span style={{
                                            padding: "2px 10px",
                                            background: "rgba(139, 92, 246, 0.1)",
                                            borderRadius: 20,
                                            fontSize: 11,
                                            color: "#8B5CF6",
                                            fontWeight: 500,
                                        }}>
                                            {formatDateTime(analysis.createdAt)}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button
                                        onClick={() => handleExportPDF(analysis)}
                                        style={{
                                            padding: "10px 20px",
                                            borderRadius: 10,
                                            background: darkMode ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.1)",
                                            color: "#22c55e",
                                            border: "2px solid rgba(34, 197, 94, 0.3)",
                                            fontWeight: 600,
                                            fontSize: 13,
                                            cursor: "pointer",
                                            transition: "all 0.25s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = "rgba(34, 197, 94, 0.2)";
                                            e.target.style.borderColor = "#22c55e";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = darkMode ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.1)";
                                            e.target.style.borderColor = "rgba(34, 197, 94, 0.3)";
                                        }}
                                        title="Export to PDF"
                                    >
                                        📄 PDF
                                    </button>
                                    <button
                                        onClick={() => openUpdateModal(analysis)}
                                        style={{
                                            padding: "10px 20px",
                                            borderRadius: 10,
                                            background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                            color: "#fff",
                                            border: "none",
                                            fontWeight: 600,
                                            fontSize: 13,
                                            cursor: "pointer",
                                            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                                            transition: "all 0.25s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.transform = "translateY(-2px)";
                                            e.target.style.boxShadow = "0 6px 16px rgba(139, 92, 246, 0.4)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.transform = "translateY(0)";
                                            e.target.style.boxShadow = "0 4px 12px rgba(139, 92, 246, 0.3)";
                                        }}
                                    >
                                        Update
                                    </button>
                                    <button
                                        onClick={() => handleDelete(analysis.analysisId)}
                                        style={{
                                            padding: "10px 20px",
                                            borderRadius: 10,
                                            background: "transparent",
                                            color: "#ef4444",
                                            border: "2px solid rgba(239, 68, 68, 0.3)",
                                            fontWeight: 600,
                                            fontSize: 13,
                                            cursor: "pointer",
                                            transition: "all 0.25s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = "#ef4444";
                                            e.target.style.color = "#fff";
                                            e.target.style.borderColor = "#ef4444";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = "transparent";
                                            e.target.style.color = "#ef4444";
                                            e.target.style.borderColor = "rgba(239, 68, 68, 0.3)";
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>

                            {/* Recommended Locations Grid */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                                gap: 20,
                            }}>
                                {analysis.recommendedLocations.map((loc, idx) => (
                                    <div
                                        key={loc.locationId}
                                        style={{
                                            background: darkMode ? "#252540" : "#f8fafc",
                                            borderRadius: 16,
                                            padding: 20,
                                            border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.15)" : "#e2e8f0"}`,
                                            transition: "all 0.25s ease",
                                            position: "relative",
                                            overflow: "hidden",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = "#8B5CF6";
                                            e.currentTarget.style.boxShadow = "0 8px 24px rgba(139, 92, 246, 0.15)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.15)" : "#e2e8f0";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                    >
                                        {/* Rank Badge */}
                                        <div style={{
                                            position: "absolute",
                                            top: 12,
                                            right: 12,
                                            width: 32,
                                            height: 32,
                                            borderRadius: "50%",
                                            background: idx === 0 
                                                ? "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)" 
                                                : darkMode ? "#2d2d5a" : "#e2e8f0",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: idx === 0 ? "#fff" : darkMode ? "#94a3b8" : "#64748b",
                                        }}>
                                            {idx + 1}
                                        </div>

                                        <h3 style={{
                                            fontSize: 15,
                                            fontWeight: 600,
                                            color: darkMode ? "#f1f5f9" : "#1e293b",
                                            marginBottom: 12,
                                            paddingRight: 40,
                                        }}>
                                            🗺️ Location #{loc.locationId.slice(-6)}
                                        </h3>
                                        
                                        <div style={{ 
                                            display: "flex", 
                                            gap: 16, 
                                            fontSize: 12, 
                                            color: darkMode ? "#94a3b8" : "#64748b",
                                            marginBottom: 12,
                                        }}>
                                            <span>Lat: {loc.lat?.toFixed(6)}</span>
                                            <span>Lon: {loc.lon?.toFixed(6)}</span>
                                        </div>

                                        {/* Score Bar */}
                                        <div style={{ marginBottom: 14 }}>
                                            <div style={{ 
                                                display: "flex", 
                                                justifyContent: "space-between", 
                                                marginBottom: 6,
                                                fontSize: 12,
                                            }}>
                                                <span style={{ color: darkMode ? "#94a3b8" : "#64748b" }}>Score</span>
                                                <span style={{ 
                                                    fontWeight: 700, 
                                                    background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                                    WebkitBackgroundClip: "text",
                                                    WebkitTextFillColor: "transparent",
                                                }}>
                                                    {(loc.score)}%
                                                </span>
                                            </div>
                                            <div style={{
                                                height: 6,
                                                background: darkMode ? "#1a1a2e" : "#e2e8f0",
                                                borderRadius: 10,
                                                overflow: "hidden",
                                            }}>
                                                <div style={{
                                                    width: `${loc.score}%`,
                                                    height: "100%",
                                                    background: "linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%)",
                                                    borderRadius: 10,
                                                    transition: "width 0.5s ease",
                                                }} />
                                            </div>
                                        </div>

                                        {/* AI Reasoning */}
                                        <p style={{
                                            fontSize: 13,
                                            color: darkMode ? "#cbd5e1" : "#475569",
                                            lineHeight: 1.6,
                                            fontStyle: "italic",
                                            marginBottom: 16,
                                        }}>
                                            {loc.ai_reason}
                                        </p>

                                        {/* Action Links */}
                                        <div style={{ 
                                            display: "flex", 
                                            gap: 12, 
                                            fontSize: 12,
                                        }}>
                                            <a
                                                href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=19/${loc.lat}/${loc.lon}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: "#8B5CF6",
                                                    textDecoration: "none",
                                                    fontWeight: 500,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                }}
                                            >
                                                🗺️ View on OSM
                                            </a>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: "#3B82F6",
                                                    textDecoration: "none",
                                                    fontWeight: 500,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                }}
                                            >
                                                📍 Navigate
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}

                {/* Modal */}
                {showModal && (
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.7)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}>
                        <div style={{
                            background: darkMode ? "#1a1a2e" : "#fff",
                            borderRadius: 24,
                            padding: 32,
                            width: "100%",
                            maxWidth: 440,
                            border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
                            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.3)",
                        }}>
                            <h2 style={{
                                fontSize: 22,
                                fontWeight: 600,
                                marginBottom: 24,
                                background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}>
                                Update Reference Point
                            </h2>
                            <form onSubmit={handleUpdateSubmit}>
                                {["name", "lat", "lon"].map((field) => (
                                    <div key={field} style={{ marginBottom: 16 }}>
                                        <label style={{
                                            display: "block",
                                            marginBottom: 8,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: darkMode ? "#94a3b8" : "#64748b",
                                            textTransform: "capitalize",
                                        }}>
                                            {field}
                                        </label>
                                        <input
                                            type={field === "name" ? "text" : "number"}
                                            value={formData[field]}
                                            step={field === "name" ? undefined : "any"}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    [field]: field === "name" ? e.target.value : parseFloat(e.target.value),
                                                })
                                            }
                                            style={{
                                                width: "100%",
                                                padding: "14px 16px",
                                                borderRadius: 12,
                                                border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0"}`,
                                                background: darkMode ? "#252540" : "#f8fafc",
                                                color: darkMode ? "#f1f5f9" : "#1e293b",
                                                fontSize: 14,
                                                transition: "all 0.25s ease",
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = "#8B5CF6";
                                                e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.2)" : "#e2e8f0";
                                                e.target.style.boxShadow = "none";
                                            }}
                                            required
                                        />
                                    </div>
                                ))}
                                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        style={{
                                            flex: 1,
                                            padding: "14px",
                                            borderRadius: 12,
                                            background: darkMode ? "#252540" : "#f1f5f9",
                                            color: darkMode ? "#f1f5f9" : "#64748b",
                                            border: "none",
                                            fontWeight: 600,
                                            fontSize: 14,
                                            cursor: "pointer",
                                            transition: "all 0.25s ease",
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{
                                            flex: 1,
                                            padding: "14px",
                                            borderRadius: 12,
                                            background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                            color: "#fff",
                                            border: "none",
                                            fontWeight: 600,
                                            fontSize: 14,
                                            cursor: "pointer",
                                            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                                            transition: "all 0.25s ease",
                                        }}
                                    >
                                        Update
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Analysis;
