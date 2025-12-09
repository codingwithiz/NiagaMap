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
  const [selectedFile, setSelectedFile] = useState(null);

  // Category and weights
  const [selectedCategory, setSelectedCategory] = useState("retail");
  const [showWeightPanel, setShowWeightPanel] = useState(false);
  const weightManager = useWeightManager(selectedCategory);

  // Location validation
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [isValidatingLocation, setIsValidatingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");

  const messagesEndRef = useRef(null);
  const debounceTimeout = useRef(null);
  const conversationRef = useRef(null);

  useEffect(() => {
    if (userId) fetchChats();
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
    const res = await axios.get(`${API}/chats/${chatId}/conversations`);
    setConversation(res.data);
    setSelectedChat(chatId);
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
    if ((!input.trim() && !selectedFile) || !selectedChat) return;
    
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

      // Step 3: Call analysis workflow instead of suitability
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
          maxCount: 10,
          userId: userId,
          chatId: selectedChat,
          weights: normalizedWeights
        };

        console.log("Calling workflow with:", workflowPayload);

        const workflowRes = await axios.post(`${API}/analysis/workflow`, workflowPayload);
        const analysisResults = workflowRes.data.results;

        console.log("Workflow results:", analysisResults);

        // Step 4: Update conversation with analysis_id (but don't save reasoning as message)
        if (analysisResults && analysisResults.length > 0) {
          const analysisId = analysisResults[0].hexagon.analysis_id;
          
          console.log("Updating conversation", conversationId, "with analysis_id", analysisId);

          await axios.patch(`${API}/conversations/${conversationId}`, {
            analysis_id: analysisId
          });

          console.log("Successfully linked conversation to analysis");

          // Helper function to safely find score
          const findScore = (scoreObj, lat) => {
            if (!scoreObj || !scoreObj.scores || !Array.isArray(scoreObj.scores)) {
              return 0;
            }
            const found = scoreObj.scores.find(s => 
              s.centroid && s.centroid.lat === lat
            );
            return found?.score || 0;
          };

          // Trigger map update with recommended locations
          if (onShowRecommendations) {
            const topLocations = analysisResults
              .sort((a, b) => b.finalScore - a.finalScore)
              .slice(0, 3)
              .map(r => ({
                lat: r.centroid.lat,
                lon: r.centroid.lon,
                score: r.finalScore,
                breakdown: {
                  demand: findScore(r.demandScore, r.centroid.lat),
                  poi: findScore(r.poiScore, r.centroid.lat),
                  risk: findScore(r.riskScore, r.centroid.lat),
                  accessibility: findScore(r.accessibilityScore, r.centroid.lat),
                  zoning: findScore(r.zoningScore, r.centroid.lat)
                }
              }));

            const referencePoint = {
              lat: currentLocation?.lat || 0,
              lon: currentLocation?.lon || 0,
              name: locationName || "Reference Point"
            };

            onShowRecommendations(topLocations, referencePoint);
          }
        }

        fetchConversation(selectedChat);
      }

      setSelectedFile(null);
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
    if (!analysisId) return;
    try {
      const res = await api.get(`/analysis/${analysisId}/recommendations`);
      const locations = res.data.locations || [];
      const referencePoint = res.data.referencePoint || null;
      if (onShowRecommendations) {
        onShowRecommendations(locations, referencePoint);
      }
    } catch (err) {
      alert("Failed to fetch recommendations.");
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
        background: darkMode ? "#1e1e1e" : "#fff",
        color: darkMode ? "#e0e0e0" : "#000",
        borderRadius: 16,
        boxShadow: "0 12px 48px rgba(0,0,0,0.4)",
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
          darkMode={darkMode}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <ConversationArea
            ref={conversationRef}
            conversation={conversation}
            handleShowRecommendations={handleShowRecommendations}
            darkMode={darkMode}
            messagesEndRef={messagesEndRef}
          />

          <div
            style={{
              borderTop: `1px solid ${darkMode ? "#444" : "#e0e0e0"}`,
              background: darkMode ? "#252525" : "#fafafa",
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
                    borderRadius: 8,
                    background: showWeightPanel 
                      ? (darkMode ? "#d32f2f" : "#f44336") 
                      : darkMode ? "#3d3d3d" : "#1976d2",
                    color: "#fff",
                    border: "none",
                    cursor: selectedChat ? "pointer" : "not-allowed",
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
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
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              input={input}
              handleInputChange={handleInputChange}
              handleSend={handleSend}
              loading={loading}
              isValidatingLocation={isValidatingLocation}
              locationError={locationError}
              showLocationDropdown={showLocationDropdown}
              locationSuggestions={locationSuggestions}
              handleLocationSelect={handleLocationSelect}
              darkMode={darkMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;