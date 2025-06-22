import React, { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";


const Analysis = ({darkMode = false}) => {
    const { user } = useAuth();
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
                new Set(allAnalyses.map((a) => a.referencePoint.name))
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
        } catch (err) {
            console.error("Failed to delete analysis:", err);
            alert("Delete failed.");
        }
    };

    const openUpdateModal = (analysis) => {
        setSelectedAnalysis(analysis);
        setFormData({
            name: analysis.referencePoint.name,
            lat: analysis.referencePoint.lat,
            lon: analysis.referencePoint.lon,
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
        } catch (err) {
            console.error("Failed to update:", err);
            alert("Update failed.");
        }
    };

    const getFilteredAndSortedAnalyses = () => {
        let filtered = analyses.filter((a) => {
            const chatMatch =
                selectedChatId === "all" || a.chatId === selectedChatId;
            const refMatch =
                selectedRefName === "all" ||
                a.referencePoint.name === selectedRefName;
            const dateMatch =
                !selectedDate ||
                new Date(a.created_at).toLocaleDateString() ===
                    new Date(selectedDate).toLocaleDateString();
            return chatMatch && refMatch && dateMatch;
        });

        return filtered.sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        });
    };

    const filteredAnalyses = getFilteredAndSortedAnalyses();

    const formatDateTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString("en-US", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    };

    const bg = darkMode ? "bg-gray-900" : "bg-white";
    const text = darkMode ? "text-white" : "text-black";
    const cardBg = darkMode ? "bg-gray-800" : "bg-white";
    const border = darkMode ? "border-gray-700" : "border-gray-300";
    const label = darkMode ? "text-gray-300" : "text-gray-700";
    const inputText = darkMode ? "text-gray-200" : "text-gray-700";
    const hoverBorder = darkMode
        ? "hover:border-[#90caf9]"
        : "hover:border-[#1976d2]";

    if (loading)
        return <p className={`text-center mt-10 ${text}`}>Loading...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;

    return (
        <div className={`p-6 max-w-6xl mx-auto ${bg} ${text}`}>
            <h1
                className={`text-3xl font-bold mb-6 ${
                    darkMode ? "text-[#90caf9]" : "text-[#1976d2]"
                }`}
            >
                Analysis Results
            </h1>

            {/* Filters */}
            <div
                className={`mb-8 p-4 rounded-lg shadow-md border ${border} ${cardBg}`}
            >
                <div className="flex flex-wrap gap-6 items-start">
                    {[
                        {
                            label: "Chat ID",
                            value: selectedChatId,
                            onChange: setSelectedChatId,
                            options: chatIds,
                        },
                        {
                            label: "Reference Point",
                            value: selectedRefName,
                            onChange: setSelectedRefName,
                            options: referenceNames,
                        },
                    ].map(({ label: lbl, value, onChange, options }, idx) => (
                        <div className="flex-1 min-w-[200px]" key={idx}>
                            <label
                                className={`block mb-2 text-sm font-semibold ${label}`}
                            >
                                Filter by {lbl}
                            </label>
                            <select
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                className={`w-full px-4 py-2.5 ${inputText} ${cardBg} border ${border} rounded-lg shadow-sm 
                                    focus:border-[#1976d2] focus:ring-2 focus:ring-[#1976d2] focus:ring-opacity-30 outline-none 
                                    transition-all duration-200 ${hoverBorder}`}
                            >
                                <option value="all">All {lbl}s</option>
                                {options.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}

                    {/* Date filter */}
                    <div className="flex-1 min-w-[200px] relative">
                        <label
                            className={`block mb-2 text-sm font-semibold ${label}`}
                        >
                            Filter by Date
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className={`w-full px-4 py-2.5 ${inputText} ${cardBg} border ${border} rounded-lg shadow-sm 
                                focus:border-[#1976d2] focus:ring-2 focus:ring-[#1976d2] focus:ring-opacity-30 outline-none 
                                transition-all duration-200 pr-10 ${hoverBorder}`}
                        />
                        {selectedDate && (
                            <button
                                onClick={() => setSelectedDate("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Sort Order */}
                    <div className="flex-1 min-w-[200px]">
                        <label
                            className={`block mb-2 text-sm font-semibold ${label}`}
                        >
                            Sort Order
                        </label>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className={`w-full px-4 py-2.5 ${inputText} ${cardBg} border ${border} rounded-lg shadow-sm 
                                focus:border-[#1976d2] focus:ring-2 focus:ring-[#1976d2] focus:ring-opacity-30 outline-none 
                                transition-all duration-200 ${hoverBorder}`}
                        >
                            <option value="desc">Newest First</option>
                            <option value="asc">Oldest First</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Render each analysis */}
            {filteredAnalyses.map((analysis) => (
                <div
                    key={analysis.analysisId}
                    className={`mb-10 pb-6 border-b ${border}`}
                >
                    <div className="mb-4 flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-semibold">
                                📍 Reference Point:{" "}
                                <span
                                    className={
                                        darkMode
                                            ? "text-[#90caf9]"
                                            : "text-[#1976d2]"
                                    }
                                >
                                    {analysis.referencePoint.name}
                                </span>
                            </h2>
                            <p className={`text-sm ${label}`}>
                                Lat: {analysis.referencePoint.lat}, Lon:{" "}
                                {analysis.referencePoint.lon}
                            </p>
                            <p className="text-sm text-gray-500">
                                Chat ID: {analysis.chatId}
                            </p>
                            <p className="text-sm text-gray-500">
                                Created: {formatDateTime(analysis.created_at)}
                            </p>
                        </div>
                        <div className="space-x-2">
                            <button
                                onClick={() => openUpdateModal(analysis)}
                                className="bg-[#1976d2] hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded shadow"
                            >
                                Update
                            </button>
                            <button
                                onClick={() =>
                                    handleDelete(analysis.analysisId)
                                }
                                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded shadow"
                            >
                                Delete
                            </button>
                        </div>
                    </div>

                    {/* Recommended locations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {analysis.recommendedLocations.map((loc) => (
                            <div
                                key={loc.locationId}
                                className={`${cardBg} border ${border} rounded-xl p-5 shadow-sm hover:shadow-lg transition-all duration-200`}
                            >
                                <h3
                                    className={`text-lg font-semibold ${text} mb-2`}
                                >
                                    🗺️ Location ID: {loc.locationId}
                                </h3>
                                <p className={`text-sm ${text}`}>
                                    📍 Lat: {loc.lat}
                                </p>
                                <p className={`text-sm ${text}`}>
                                    📍 Lon: {loc.lon}
                                </p>
                                <p className="text-sm font-medium text-[#1976d2] mt-1">
                                    ⭐ Score: {loc.score}
                                </p>
                                <p className={`text-sm mt-2 italic ${label}`}>
                                    {loc.reason}
                                </p>
                                <div className="mt-2 space-x-2 text-xs">
                                    <a
                                        href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=19/${loc.lat}/${loc.lon}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline text-blue-400"
                                    >
                                        View on OSM
                                    </a>
                                    <span>|</span>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline text-blue-400"
                                    >
                                        Navigate
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div
                        className={`${cardBg} p-6 rounded-xl shadow-xl w-full max-w-md ${text}`}
                    >
                        <h2
                            className={`text-xl font-bold mb-4 ${
                                darkMode ? "text-[#90caf9]" : "text-[#1976d2]"
                            }`}
                        >
                            Update Reference Point
                        </h2>
                        <form
                            onSubmit={handleUpdateSubmit}
                            className="space-y-4"
                        >
                            {["name", "lat", "lon"].map((field) => (
                                <div key={field}>
                                    <label
                                        className={`block text-sm font-medium mb-1 ${label}`}
                                    >
                                        {field.charAt(0).toUpperCase() +
                                            field.slice(1)}
                                    </label>
                                    <input
                                        type={
                                            field === "name" ? "text" : "number"
                                        }
                                        value={formData[field]}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                [field]:
                                                    field === "name"
                                                        ? e.target.value
                                                        : parseFloat(
                                                              e.target.value
                                                          ),
                                            })
                                        }
                                        className={`w-full border ${border} px-3 py-2 rounded ${text} ${cardBg} 
                                            focus:outline-none focus:ring-2 focus:ring-[#1976d2]`}
                                        required
                                    />
                                </div>
                            ))}
                            <div className="flex justify-end space-x-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-[#1976d2] hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold shadow"
                                >
                                    Update
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Analysis;
