import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api/api";
import ChatbotHeader from "./ChatbotHeader";
import ChatSidebar from "./ChatSidebar";
import ConversationArea from "./ConversationArea";
import CategorySelector from "./CategorySelector";
import WeightPanel from "./WeightPanel";
import InputArea from "./InputArea";
import { API, CATEGORY_PRESETS } from "../constants/chatbotConstants";
import { useWeightManager } from "../hooks/useWeightManager";
import { 
  fetchLocationSuggestions, 
  validateLocation, 
  extractPotentialLocation,
  replaceLocationInInput 
} from "../utils/locationUtils";
import { 
  normalizeWeights,
  buildEnrichedMessage 
} from "../utils/messageUtils";

function Chatbot({ onExtracted, onClose, onShowRecommendations, onViewFavourite, darkMode = false }) {
  const { user } = useAuth();
  const userId = user?.uid;
  const { showToast } = useToast();

  // Chat state
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);


  // Category and weights
  const [selectedCategory, setSelectedCategory] = useState("retail");
  const [showWeightPanel, setShowWeightPanel] = useState(false);
  const weightManager = useWeightManager(selectedCategory);

  // Location validation
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [isValidatingLocation, setIsValidatingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Favourites state
  const [favourites, setFavourites] = useState([]);
  const [favouriteIds, setFavouriteIds] = useState(new Set());

  // Enhanced Chat Features
  const [searchQuery, setSearchQuery] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef(null);
  const debounceTimeout = useRef(null);
  const conversationRef = useRef(null);

  // Chat templates
  const chatTemplates = [
    { id: 1, text: "Find coffee shops near", icon: "☕", category: "retail" },
    { id: 2, text: "Show restaurants with good ratings in", icon: "🍽️", category: "fnb" },
    { id: 3, text: "Find gyms and sports facilities around", icon: "🏃", category: "sports" },
    { id: 4, text: "Locate clinics and wellness centers near", icon: "🏥", category: "health" },
    { id: 5, text: "Find car workshops and service centers in", icon: "🚗", category: "automotive" },
    { id: 6, text: "Show parks and recreation areas around", icon: "🌳", category: "sports" }
  ];

  useEffect(() => {
    if (userId) {
      fetchChats();
      fetchFavourites();
    }
  }, [userId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation]);

  const fetchChats = async () => {
    if (!userId) return;
    const res = await axios.get(`${API}/chats/user/${userId}`);
    setChats(res.data);
  };

  const fetchConversation = async (chatId) => {
    try {
        const res = await axios.get(`${API}/chats/${chatId}/conversations`);
        console.log("Fetched conversation:", res.data);
        
        // Map the conversation to normalize analysisId field
        const normalizedConversation = res.data.map(msg => ({
            ...msg,
            analysisId: msg.analysis_id || msg.analysisId // Support both naming conventions
        }));
        
        setConversation(normalizedConversation);
        setSelectedChat(chatId);
    } catch (error) {
        console.error("Error fetching conversation:", error);
        setConversation([]);
    }
  };

  const fetchFavourites = async () => {
    if (!userId) return;
    try {
      const res = await api.get(`/favourites/${userId}`);
      setFavourites(res.data);
      setFavouriteIds(new Set(res.data.map(f => f.analysis_id)));
    } catch (err) {
      console.error("Error fetching favourites:", err);
    }
  };

  const handleCreateChat = async () => {
    if (!newChatTitle.trim()) return;
    const res = await axios.post(`${API}/chats`, {
      title: newChatTitle,
      thread_id: `thread_${Date.now()}`,
      userId,
      conversation: [],
    });
    setNewChatTitle("");
    fetchChats();
    setSelectedChat(res.data.chatId);
    setConversation([]);
  };

  const handleDeleteChat = async (chatId) => {
    await axios.delete(`${API}/chats/${chatId}`);
    fetchChats();
    setSelectedChat(null);
    setConversation([]);
  };

  // Template Selection
  const handleTemplateSelect = (template) => {
    setInput(template.text + " ");
    setSelectedCategory(template.category);
    setShowTemplates(false);
  };

  // Chat History Search
  const filteredConversation = conversation.filter(msg => 
    searchQuery === "" || 
    msg.user_prompt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.bot_answer?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    setLocationError("");
    
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    
    debounceTimeout.current = setTimeout(async () => {
      const potentialLocation = extractPotentialLocation(value);
      if (potentialLocation) {
        const suggestions = await fetchLocationSuggestions(potentialLocation);
        setLocationSuggestions(suggestions);
        setShowLocationDropdown(suggestions.length > 0);
      }
    }, 500);
  };

  const handleLocationSelect = (suggestion) => {
    // ArcGIS returns 'text' instead of 'display_name'
    const locationName = suggestion.text;
    
    setInput(replaceLocationInInput(input, locationName));
    setShowLocationDropdown(false);
    setLocationSuggestions([]);
    setLocationError("");
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedChat) return;
    
    setIsValidatingLocation(true);
    setLocationError("");
    
    const validation = await validateLocation(input);
    setIsValidatingLocation(false);
    
    if (!validation.valid) {
      setLocationError(validation.error);
      return;
    }
    
    setLoading(true);

    try {
      const normalizedWeights = normalizeWeights(weightManager.weights);
      const enrichedMessage = buildEnrichedMessage(
        CATEGORY_PRESETS[selectedCategory].label,
        normalizedWeights,
        input
      );

      // Step 1: Get parsed parameters from OpenAI
      const res = await axios.post(`${API}/api/chatbot`, { message: enrichedMessage });
      const botResult = res.data;

      console.log("Bot parsed result:", botResult);

      // Step 2: Save initial conversation with parsed data
      const saveRes = await axios.put(`${API}/chats/${selectedChat}/messages`, {
        user_prompt: enrichedMessage,
        bot_answer: JSON.stringify(botResult),
      });

      console.log("Save conversation response:", saveRes.data);

      const conversationId = saveRes.data.conversation_id || saveRes.data.conversationId;

      if (!conversationId) {
        console.error("No conversation_id in response:", saveRes.data);
        throw new Error("Failed to get conversation_id from server");
      }

      console.log("Got conversation_id:", conversationId);

      let analysisId = null;

      // Step 3: Call analysis workflow
      if ((botResult.location || botResult.nearbyMe) && botResult.category) {
        let currentLocation = null;
        let locationName = null;

        if (botResult.nearbyMe) {
          console.log("Requesting user's current location...");
          showToast("Getting your location...", "info");
          
          try {
            // Helper function to get location with specific options
            const getPosition = (options) => {
              return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                  reject(new Error("Geolocation is not supported by your browser"));
                  return;
                }
                
                navigator.geolocation.getCurrentPosition(
                  (pos) => resolve(pos),
                  (err) => reject(err),
                  options
                );
              });
            };

            let position;
            
            // First try: High accuracy with 10s timeout
            try {
              console.log("Trying high accuracy GPS...");
              position = await getPosition({ 
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0  // Force fresh location
              });
            } catch (firstError) {
              console.warn("High accuracy failed, trying low accuracy:", firstError);
              
              // Second try: Low accuracy (network-based) with 20s timeout
              try {
                showToast("GPS unavailable, using network location...", "info");
                position = await getPosition({ 
                  enableHighAccuracy: false,
                  timeout: 20000,
                  maximumAge: 0  // Force fresh location
                });
              } catch (secondError) {
                // Both attempts failed, provide helpful error message
                let errorMsg = "Unable to get your location";
                if (secondError.code === 1) {
                  errorMsg = "Location permission denied. Click the 🔒 icon in your address bar to allow location access";
                } else if (secondError.code === 2) {
                  errorMsg = "Location unavailable. Please check your device location settings";
                } else if (secondError.code === 3) {
                  errorMsg = "Location timed out. Please specify a location name instead (e.g., 'near KLCC')";
                }
                throw new Error(errorMsg);
              }
            }

            currentLocation = {
              lat: position.coords.latitude,
              lon: position.coords.longitude
            };

            console.log("Got current location:", currentLocation);
            showToast("Location found!", "success");
          } catch (geoError) {
            console.error("Geolocation error:", geoError);
            throw new Error(geoError.message || "Unable to get your location. Please enable location services or specify a location name.");
          }
        } else {
          locationName = botResult.location;
          console.log("Using location name:", locationName);
        }

        const workflowPayload = {
          radius: botResult.radius || 1000,
          locationName: locationName,
          currentLocation: currentLocation,
          nearbyMe: botResult.nearbyMe || false,
          category: CATEGORY_PRESETS[selectedCategory].label,
          userId: userId,
          chatId: selectedChat,
          weights: normalizedWeights
        };

        console.log("Calling workflow with:", workflowPayload);

        const workflowRes = await axios.post(`${API}/analysis/workflow`, workflowPayload);
        const analysisResults = workflowRes.data.results;

        console.log("Workflow results:", analysisResults);

        // Step 4: Update conversation with analysis_id and fetch recommendations
        if (analysisResults && analysisResults.length > 0) {
          analysisId = analysisResults[0].hexagon.analysis_id;
          
          console.log("Updating conversation", conversationId, "with analysis_id", analysisId);

          await axios.patch(`${API}/conversations/${conversationId}`, {
            analysis_id: analysisId
          });

          console.log("Successfully linked conversation to analysis");

          // Fetch recommendations with AI-generated reasoning from API
          try {
            const recsResponse = await axios.get(`${API}/analysis/${analysisId}/recommendations`);
            const { locations, referencePoint } = recsResponse.data;

            console.log("Fetched recommendations with reasoning:", { locations, referencePoint });

            // Trigger map update with AI-generated recommendations AND workflow results (hexagons)
            if (onShowRecommendations) {
              onShowRecommendations(locations, referencePoint, analysisResults);
              showToast("Analysis completed successfully! View results on map.", "success", 5000);
              // Auto-close chatbot after showing recommendations
              if (onClose) onClose();
            }
          } catch (recError) {
            console.error("Error fetching recommendations:", recError);
            if (onShowRecommendations) {
              onShowRecommendations(null, null, analysisResults);
            }
            showToast("Analysis completed but failed to load recommendations. Please click 'View Locations on Map' button.", "warning", 6000);
          }
        }
      }

      // Refresh conversation to show the button
      setConversation(prev => [...prev, {
        user_prompt: enrichedMessage,
        bot_answer: JSON.stringify(botResult),
        analysisId: analysisId
      }]);


      setInput("");
    } catch (err) {
      console.error("Chatbot error:", err);
      console.error("Error details:", err.response?.data);
      showToast(err.response?.data?.error || err.message || "An error occurred", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleShowRecommendations = async (analysisId) => {
    try {
      console.log("Fetching hexagons and recommendations for analysis:", analysisId);
      
      // Fetch hexagons with scores from the database
      const hexagonsResponse = await axios.get(`${API}/analysis/${analysisId}/hexagons`);
      const workflowData = hexagonsResponse.data.hexagons;
      
      console.log("Fetched hexagons from database:", workflowData);
      
      // Fetch recommendations with reasoning
      const recsResponse = await axios.get(`${API}/analysis/${analysisId}/recommendations`);
      const { locations, referencePoint } = recsResponse.data;
      
      console.log("Fetched recommendations:", { locations, referencePoint });
      
      // Pass all three: locations, referencePoint, and full workflowData (hexagons)
      if (onShowRecommendations) {
        onShowRecommendations(locations, referencePoint, workflowData);
        showToast("Loaded saved analysis successfully!", "success");
        // Auto-close chatbot after navigating to the map
        if (onClose) onClose();
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      showToast("Failed to load recommendations. Please try again.", "error");
    }
  };

  const handleToggleFavourite = async (analysisId, userPrompt = null) => {
    if (!analysisId || !userId) return;

    try {
      if (favouriteIds.has(analysisId)) {
        // Remove from favourites
        await api.delete(`/favourites`, {
          data: { user_id: userId, analysis_id: analysisId }
        });
        showToast("Removed from favourites", "info");
      } else {
        // Add to favourites with user's question
        await api.post(`/favourites`, {
          user_id: userId,
          analysis_id: analysisId,
          name: userPrompt || `Analysis ${new Date().toLocaleDateString()}`
        });
        showToast("Added to favourites!", "success");
      }
      fetchFavourites();
    } catch (err) {
      console.error("Error toggling favourite:", err);
      showToast(err.response?.data?.error || "Failed to update favourites", "error");
    }
  };

  const handleRemoveFavourite = async (analysisId) => {
    if (!analysisId || !userId) return;
    try {
      await api.delete(`/favourites`, {
        data: { user_id: userId, analysis_id: analysisId }
      });
      fetchFavourites();
      showToast("Removed from favourites", "info");
    } catch (err) {
      console.error("Error removing favourite:", err);
      showToast("Failed to remove favourite", "error");
    }
  };

  if (!userId) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        Please log in to use the chatbot.
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        height: "88vh",
        maxHeight: "900px",
        width: "75vw",
        maxWidth: "1100px",
        minWidth: "800px",
        background: darkMode 
          ? "linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)" 
          : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        color: darkMode ? "#e2e8f0" : "#1f2937",
        borderRadius: 20,
        boxShadow: darkMode 
          ? "0 16px 64px rgba(139, 92, 246, 0.2), 0 8px 32px rgba(0, 0, 0, 0.5)"
          : "0 16px 64px rgba(139, 92, 246, 0.15), 0 8px 32px rgba(0, 0, 0, 0.1)",
        border: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
        overflow: "hidden",
        flexDirection: "column",
        zIndex: 9999,
      }}
    >
      <ChatbotHeader onClose={onClose} darkMode={darkMode} />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <ChatSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          chats={chats}
          selectedChat={selectedChat}
          fetchConversation={fetchConversation}
          handleDeleteChat={handleDeleteChat}
          newChatTitle={newChatTitle}
          setNewChatTitle={setNewChatTitle}
          handleCreateChat={handleCreateChat}
          favourites={favourites}
          handleViewFavourite={(analysisId) => onViewFavourite(analysisId, true)}
          handleRemoveFavourite={handleRemoveFavourite}
          darkMode={darkMode}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Enhanced Chat Controls */}
          <div style={{
            display: "flex",
            gap: "14px",
            padding: "16px 24px",
            borderBottom: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.25)" : "rgba(139, 92, 246, 0.15)"}`,
            background: darkMode 
              ? "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)"
              : "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)",
            alignItems: "stretch"
          }}>
            {/* Chat History Search */}
            <div style={{ flex: 1, position: "relative" }}>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "18px",
                  pointerEvents: "none",
                  zIndex: 1
                }}>
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px 12px 44px",
                    borderRadius: 12,
                    background: darkMode ? "rgba(26, 26, 46, 0.8)" : "#fff",
                    border: `2px solid ${searchQuery ? "#8b5cf6" : darkMode ? "rgba(139, 92, 246, 0.3)" : "#e2e8f0"}`,
                    color: darkMode ? "#fff" : "#1e293b",
                    fontSize: 14,
                    fontWeight: 500,
                    outline: "none",
                    boxShadow: searchQuery ? "0 4px 12px rgba(139, 92, 246, 0.2)" : "none",
                    transition: "all 0.3s ease"
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#8b5cf6";
                    e.target.style.boxShadow = "0 4px 16px rgba(139, 92, 246, 0.25)";
                  }}
                  onBlur={(e) => {
                    if (!searchQuery) {
                      e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.3)" : "#e2e8f0";
                      e.target.style.boxShadow = "none";
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: darkMode ? "#94a3b8" : "#64748b",
                      fontSize: "18px",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "color 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.target.style.color = "#ef4444"}
                    onMouseLeave={(e) => e.target.style.color = darkMode ? "#94a3b8" : "#64748b"}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Templates Button */}
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                background: showTemplates 
                  ? "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)"
                  : darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.12)",
                border: `2px solid ${showTemplates ? "#8b5cf6" : darkMode ? "rgba(139, 92, 246, 0.4)" : "rgba(139, 92, 246, 0.25)"}`,
                color: showTemplates ? "#fff" : "#8b5cf6",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: showTemplates ? "0 4px 16px rgba(139, 92, 246, 0.3)" : "none",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                if (!showTemplates) {
                  e.target.style.background = "linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(99, 102, 241, 0.2) 100%)";
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 6px 20px rgba(139, 92, 246, 0.2)";
                }
              }}
              onMouseLeave={(e) => {
                if (!showTemplates) {
                  e.target.style.background = darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.12)";
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                }
              }}
            >
              <span style={{ fontSize: "16px" }}>📋</span>
              <span>Quick Templates</span>
              <span style={{ fontSize: "12px" }}>{showTemplates ? "▲" : "▼"}</span>
            </button>
          </div>

          {/* Templates Panel */}
          {showTemplates && (
            <div style={{
              padding: "20px 24px",
              background: darkMode 
                ? "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)"
                : "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.06) 100%)",
              borderBottom: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "14px"
            }}>
              {chatTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: darkMode 
                      ? "linear-gradient(135deg, rgba(26, 26, 46, 0.9) 0%, rgba(37, 37, 64, 0.8) 100%)"
                      : "linear-gradient(135deg, #fff 0%, rgba(248, 250, 252, 0.9) 100%)",
                    border: `2px solid ${darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)"}`,
                    color: darkMode ? "#f1f5f9" : "#1e293b",
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    boxShadow: darkMode 
                      ? "0 2px 8px rgba(0, 0, 0, 0.3)"
                      : "0 2px 8px rgba(139, 92, 246, 0.1)"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = darkMode 
                      ? "linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(99, 102, 241, 0.2) 100%)"
                      : "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)";
                    e.target.style.borderColor = "#8b5cf6";
                    e.target.style.transform = "translateY(-3px)";
                    e.target.style.boxShadow = darkMode
                      ? "0 8px 24px rgba(139, 92, 246, 0.3)"
                      : "0 8px 24px rgba(139, 92, 246, 0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = darkMode
                      ? "linear-gradient(135deg, rgba(26, 26, 46, 0.9) 0%, rgba(37, 37, 64, 0.8) 100%)"
                      : "linear-gradient(135deg, #fff 0%, rgba(248, 250, 252, 0.9) 100%)";
                    e.target.style.borderColor = darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.2)";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = darkMode
                      ? "0 2px 8px rgba(0, 0, 0, 0.3)"
                      : "0 2px 8px rgba(139, 92, 246, 0.1)";
                  }}
                >
                  <span style={{ fontSize: "22px", flexShrink: 0 }}>{template.icon}</span>
                  <span style={{ flex: 1 }}>{template.text}</span>
                  <span style={{ 
                    fontSize: "10px",
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: darkMode ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.15)",
                    color: "#8b5cf6",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    {template.category}
                  </span>
                </button>
              ))}
            </div>
          )}

          <ConversationArea
            ref={conversationRef}
            conversation={filteredConversation}
            handleShowRecommendations={handleShowRecommendations}
            handleToggleFavourite={handleToggleFavourite}
            favourites={favouriteIds}
            darkMode={darkMode}
            messagesEndRef={messagesEndRef}
          />

          <div
            style={{
              borderTop: `1px solid ${darkMode ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.1)"}`,
              background: darkMode ? "rgba(26, 26, 46, 0.8)" : "rgba(248, 250, 252, 0.9)",
              padding: "16px 20px",
              flexShrink: 0,
            }}
          >
            {/* Category & Weights Section */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <CategorySelector
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  weights={weightManager.weights}
                  disabled={!selectedChat}
                  darkMode={darkMode}
                />

                <button
                  onClick={() => setShowWeightPanel(!showWeightPanel)}
                  disabled={!selectedChat}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: showWeightPanel 
                      ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" 
                      : "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                    color: "#fff",
                    border: "none",
                    cursor: selectedChat ? "pointer" : "not-allowed",
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    boxShadow: showWeightPanel 
                      ? "0 4px 12px rgba(239, 68, 68, 0.3)"
                      : "0 4px 12px rgba(139, 92, 246, 0.3)",
                    transition: "all 0.25s ease",
                    opacity: selectedChat ? 1 : 0.5,
                  }}
                >
                  {showWeightPanel ? "✕" : "⚙️"} Weights
                </button>
              </div>

              {showWeightPanel && (
                <WeightPanel
                  showWeightPanel={showWeightPanel}
                  weights={weightManager.weights}
                  lockedIndicators={weightManager.lockedIndicators}
                  toggleLock={weightManager.toggleLock}
                  handleWeightChange={weightManager.handleWeightChange}
                  resetWeights={weightManager.resetWeights}
                  totalWeight={weightManager.totalWeight}
                  isWeightValid={weightManager.isWeightValid}
                  darkMode={darkMode}
                />
              )}
            </div>

            <InputArea
              selectedChat={selectedChat}
              input={input}
              handleInputChange={handleInputChange}
              handleSend={handleSend}
              loading={loading}
              isValidatingLocation={isValidatingLocation}
              locationError={locationError}
              showLocationDropdown={showLocationDropdown}
              locationSuggestions={locationSuggestions}
              handleLocationSelect={handleLocationSelect}
              setShowLocationDropdown={setShowLocationDropdown}
              darkMode={darkMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;