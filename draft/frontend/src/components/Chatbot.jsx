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
    const res = await axios.get(`${API}/chats/${userId}`);
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
    const locationName = suggestion.display_name.split(',')[0];
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

      let botResult;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("message", enrichedMessage);
        const res = await axios.post(`${API}/api/chatbot/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        botResult = res.data;
      } else {
        const res = await axios.post(`${API}/api/chatbot`, { message: enrichedMessage });
        botResult = res.data;
      }

      const saveRes = await axios.put(`${API}/chats/${selectedChat}/messages`, {
        user_prompt: enrichedMessage,
        bot_answer: JSON.stringify(botResult),
      });
      const conversationId = saveRes.data.conversationId;

      if (onExtracted && (botResult.location || botResult.nearbyMe) && botResult.category) {
        onExtracted({
          location: botResult.location,
          category: selectedCategory,
          radius: botResult.radius || 1000,
          nearbyMe: botResult.nearbyMe || false,
          weights: normalizedWeights,
          chatId: selectedChat,
          userId: userId,
          conversationId,
        });
      }

      fetchConversation(selectedChat);
      setSelectedFile(null);
      setInput("");
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
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