import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
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

function Chatbot({ onExtracted, onClose, onShowRecommendations, darkMode = false }) {
  const { user } = useAuth();
  const userId = user?.uid;

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

  const messagesEndRef = useRef(null);
  const debounceTimeout = useRef(null);
  const conversationRef = useRef(null);

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
          
          try {
            const position = await new Promise((resolve, reject) => {
              if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser"));
              }
              
              navigator.geolocation.getCurrentPosition(
                (pos) => resolve(pos),
                (err) => reject(err),
                { 
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0
                }
              );
            });

            currentLocation = {
              lat: position.coords.latitude,
              lon: position.coords.longitude
            };

            console.log("Got current location:", currentLocation);
          } catch (geoError) {
            console.error("Geolocation error:", geoError);
            throw new Error(`Unable to get your location: ${geoError.message}. Please enable location services or specify a location name.`);
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
              // Auto-close chatbot after showing recommendations
              if (onClose) onClose();
            }
          } catch (recError) {
            console.error("Error fetching recommendations:", recError);
            if (onShowRecommendations) {
              onShowRecommendations(null, null, analysisResults);
            }
            alert("Analysis completed but failed to load recommendations. Please click 'View Locations on Map' button.");
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
      alert(`Error: ${err.response?.data?.error || err.message}`);
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
        // Auto-close chatbot after navigating to the map
        if (onClose) onClose();
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      alert("Failed to load recommendations. Please try again.");
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
      } else {
        // Add to favourites with user's question
        await api.post(`/favourites`, {
          user_id: userId,
          analysis_id: analysisId,
          name: userPrompt || `Analysis ${new Date().toLocaleDateString()}`
        });
      }
      fetchFavourites();
    } catch (err) {
      console.error("Error toggling favourite:", err);
      alert(err.response?.data?.error || "Failed to update favourites");
    }
  };

  const handleViewFavourite = async (analysisId) => {
    await handleShowRecommendations(analysisId);
    // handleShowRecommendations already closes on success
  };

  const handleRemoveFavourite = async (analysisId) => {
    if (!analysisId || !userId) return;
    try {
      await api.delete(`/favourites`, {
        data: { user_id: userId, analysis_id: analysisId }
      });
      fetchFavourites();
    } catch (err) {
      console.error("Error removing favourite:", err);
      alert("Failed to remove favourite");
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
          handleViewFavourite={handleViewFavourite}
          handleRemoveFavourite={handleRemoveFavourite}
          darkMode={darkMode}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <ConversationArea
            ref={conversationRef}
            conversation={conversation}
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