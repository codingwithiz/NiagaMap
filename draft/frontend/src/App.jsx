import { useState, useEffect } from "react";
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useToast } from "./context/ToastContext";
import Basemap from "./components/EsriMap";
import MapViewComponent from "./components/MapView";
import Chatbot from "./components/Chatbot";
import AuthPage from "./components/AuthPage";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import "./App.css";
import "./styles/theme.css";
import api from "./api/api";
import AnalysesPage from "./components/Analysis";
import Profile from "./components/Profile";
import FavoritesWidget from "./components/FavoritesWidget";
import axios from "axios";

// NiagaMap Logo Component
const NiagaMapLogo = () => (
  <svg width="32" height="32" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#A78BFA" />
      </linearGradient>
    </defs>
    <path d="M50 5C28 5 10 23 10 45C10 72 50 115 50 115S90 72 90 45C90 23 72 5 50 5Z" fill="url(#pinGradient)" />
    <circle cx="50" cy="42" r="28" fill="#0f0f1a" opacity="0.9"/>
    <path d="M35 35C35 35 40 30 50 30C60 30 65 35 65 35M35 45C35 45 40 50 50 50C60 50 65 45 65 45M38 38L42 42M58 38L62 42M45 32V38M55 32V38M40 48L44 52M56 48L60 52" stroke="url(#brainGradient)" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="50" cy="80" r="3" fill="white" opacity="0.9"/>
    <circle cx="42" cy="85" r="1.5" fill="white" opacity="0.6"/>
    <circle cx="58" cy="85" r="1.5" fill="white" opacity="0.6"/>
  </svg>
);


function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // while Firebase initializes, don't redirect (avoid flash)
  if (loading) return null; // or return a spinner component

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, loading } = useAuth();
  const [places, setPlaces] = useState([]);
  const [activeCategory, setActiveCategory] = useState("4d4b7105d754a06377d81259");
  const [recommendedPlace, setRecommendedPlace] = useState(null);
  
  // Dark mode with localStorage persistence
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('niagamap_darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  // Save dark mode preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('niagamap_darkMode', JSON.stringify(darkMode));
  }, [darkMode]);
  
  const [workflowResults, setWorkflowResults] = useState(null); // NEW: Add this state

  // New: Handler for recommendations from Chatbot
  const handleShowRecommendations = (locations, referencePoint, workflowData) => {
    console.log("handleShowRecommendations called with:", {
      locations,
      referencePoint,
      workflowData: workflowData?.length
    });

    // Set recommended place for markers
    if (locations && referencePoint) {
      setRecommendedPlace({ 
        recommended_locations: locations, 
        reference_point: referencePoint 
      });
    }
    
    // Set workflow results for hexagons
    if (workflowData && workflowData.length > 0) {
      console.log("Setting workflow results for hexagons:", workflowData);
      setWorkflowResults(workflowData);
    }
  };

  // Shared handler for viewing favorites - used by both Chatbot and FavoritesWidget
  const handleViewFavourite = async (analysisId, shouldCloseChatbot = false) => {
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
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
      handleShowRecommendations(locations, referencePoint, workflowData);
      showToast("Loaded saved analysis successfully!", "success");
      
      // Close chatbot if requested (when called from Chatbot itself)
      if (shouldCloseChatbot) {
        setChatbotOpen(false);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      showToast("Failed to load recommendations. Please try again.", "error");
    }
  };

  const [currentLocationCoordinate, setCurrentLocationCoordinate] =
      useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  
  // Auto-redirect to /map after successful login
  useEffect(() => {
    if (!loading && user && location.pathname === '/auth') {
      navigate('/map', { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisChatId, setAnalysisChatId] = useState(null);

  const apiKey = import.meta.env.VITE_ESRI_API_KEY;

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/auth");
  };

  const handlePlacesFound = (results) => {
    console.log("Places found:", results.length);
    setPlaces(results);
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  const handlePlaceSelect = (place) => {
    setPlaces([place]);
  };
  

  const handleChatbotResult = async ({ location, category, radius, nearbyMe, chatId, userId, conversationId }) => {
    console.log("Chatbot result received:", {
      location,
      category,
      radius,
      nearbyMe,
      chatId,
      userId,
    });
  
    let resolvedLocation = currentLocation;
  
    if (nearbyMe) {
      console.log("Fetching current location...");
  
      try {
        console.log("Requesting geolocation...");
        
        // Helper function to get location with specific options
        const getPosition = (options) => {
          return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error("Geolocation is not supported by your browser"));
              return;
            }
            
            navigator.geolocation.getCurrentPosition(
              (position) => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                address: position.coords.address || "Current Location",
              }),
              (error) => reject(error),
              options
            );
          });
        };

        let coord;
        
        // First try: High accuracy with 10s timeout
        try {
          console.log("Trying high accuracy GPS...");
          coord = await getPosition({ 
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0  // Force fresh location
          });
        } catch (firstError) {
          console.warn("High accuracy failed, trying low accuracy:", firstError);
          
          // Second try: Low accuracy (network-based) with 20s timeout
          try {
            coord = await getPosition({ 
              enableHighAccuracy: false,
              timeout: 20000,
              maximumAge: 0  // Force fresh location
            });
          } catch (secondError) {
            // Both attempts failed, provide helpful error message
            let errorMsg = "Unable to get your location";
            if (secondError.code === 1) {
              errorMsg = "Location permission denied. Please allow location access";
            } else if (secondError.code === 2) {
              errorMsg = "Location unavailable. Check your GPS/network";
            } else if (secondError.code === 3) {
              errorMsg = "Location timed out. Try again or enter a location name";
            }
            throw new Error(errorMsg);
          }
        }
        
        console.log("Geolocation received:", coord);
  
        if (
          typeof coord?.latitude === "number" &&
          typeof coord?.longitude === "number"
        ) {
          resolvedLocation = {
            lat: coord.latitude,
            lon: coord.longitude,
            address: coord.address
          };
          console.log("Resolved current location:", resolvedLocation);
  
          // These setters won't update state immediately, but we use resolvedLocation directly
          setCurrentLocationCoordinate(coord);
          setCurrentLocation(resolvedLocation);
  
          console.log("Using current location:", resolvedLocation);
        } else {
          console.warn("Invalid coordinates received:", coord);
          return;
        }
      } catch (error) {
        console.error("Geolocation error:", error.message);
        showToast("Failed to access your location.", "error");
        return;
      }
    }
  
    if (!resolvedLocation && nearbyMe) {
      console.warn("No valid location available after geolocation.");
      return;
    }
  
    try {
      console.log("Calling suitability API with:", {
        locationName: location,
        category,
        radius,
        currentLocation: resolvedLocation,
        nearbyMe,
      });
  
      const res = await api.post("/api/suitability", {
        locationName: location,
        category,
        radius,
        currentLocation: resolvedLocation,
        nearbyMe,
        chatId,
        userId,
        conversationId, // <-- Pass it here!
      });
  
      const results = res.data || [];
      console.log("Recommended places:", results);
      setRecommendedPlace(results);
    } catch (err) {
      console.error("Error calling suitability API:", err);
      showToast("Could not fetch recommended locations.", "error");
    }

  };
  

  // NEW: Handler to clear all results
  const handleClearResults = () => {
    setRecommendedPlace(null);
    setWorkflowResults(null);
  };

  // Helper function to check active route
  const isActive = (path) => location.pathname === path;

  return (
      <>
          <div className={darkMode ? "dark" : ""}>
              <nav style={{
                  background: darkMode 
                    ? 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)' 
                    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  borderBottom: `1px solid ${darkMode ? 'rgba(139, 92, 246, 0.2)' : '#e2e8f0'}`,
                  padding: '12px 32px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: darkMode ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 2px 10px rgba(0, 0, 0, 0.05)',
              }}>
                  {/* Left Side: Logo + Links */}
                  <div
                      style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "2.5rem",
                      }}
                  >
                      <Link 
                          to="/map" 
                          style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 10, 
                              textDecoration: 'none' 
                          }}
                      >
                          <NiagaMapLogo />
                          <span
                              style={{
                                  fontWeight: 700,
                                  fontSize: 22,
                                  background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  letterSpacing: -0.5,
                              }}
                          >
                              NiagaMap
                          </span>
                      </Link>

                      {user && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                              <Link
                                  to="/map"
                                  style={{
                                      color: isActive("/map") ? "#fff" : darkMode ? "#94a3b8" : "#64748b",
                                      background: isActive("/map")
                                          ? "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)"
                                          : "transparent",
                                      fontWeight: 500,
                                      textDecoration: "none",
                                      padding: "10px 20px",
                                      borderRadius: 10,
                                      transition: "all 0.25s ease",
                                      fontSize: 14,
                                      boxShadow: isActive("/map")
                                          ? "0 4px 15px rgba(139, 92, 246, 0.4)"
                                          : "none",
                                  }}
                                  onMouseOver={(e) => {
                                      if (!isActive("/map")) {
                                          e.currentTarget.style.background = darkMode 
                                            ? "rgba(139, 92, 246, 0.15)" 
                                            : "rgba(139, 92, 246, 0.1)";
                                          e.currentTarget.style.color = "#8B5CF6";
                                      }
                                  }}
                                  onMouseOut={(e) => {
                                      if (!isActive("/map")) {
                                          e.currentTarget.style.background = "transparent";
                                          e.currentTarget.style.color = darkMode ? "#94a3b8" : "#64748b";
                                      }
                                  }}
                              >
                                  Map
                              </Link>

                              <Link
                                  to="/analysis"
                                  style={{
                                      color: isActive("/analysis") ? "#fff" : darkMode ? "#94a3b8" : "#64748b",
                                      background: isActive("/analysis")
                                          ? "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)"
                                          : "transparent",
                                      fontWeight: 500,
                                      textDecoration: "none",
                                      padding: "10px 20px",
                                      borderRadius: 10,
                                      transition: "all 0.25s ease",
                                      fontSize: 14,
                                      boxShadow: isActive("/analysis")
                                          ? "0 4px 15px rgba(139, 92, 246, 0.4)"
                                          : "none",
                                  }}
                                  onMouseOver={(e) => {
                                      if (!isActive("/analysis")) {
                                          e.currentTarget.style.background = darkMode 
                                            ? "rgba(139, 92, 246, 0.15)" 
                                            : "rgba(139, 92, 246, 0.1)";
                                          e.currentTarget.style.color = "#8B5CF6";
                                      }
                                  }}
                                  onMouseOut={(e) => {
                                      if (!isActive("/analysis")) {
                                          e.currentTarget.style.background = "transparent";
                                          e.currentTarget.style.color = darkMode ? "#94a3b8" : "#64748b";
                                      }
                                  }}
                              >
                                  Analysis
                              </Link>
                          </div>
                      )}
                  </div>

                  <div
                      style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1.5rem",
                      }}
                  >
                      {/* Dark Mode Toggle - Refined */}
                      <div style={{ 
                          display: "flex", 
                          alignItems: "center",
                          background: darkMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                          borderRadius: 20,
                          padding: '4px 8px',
                      }}>
                          <span style={{ marginRight: 8, fontSize: 14 }}>☀️</span>
                          <div
                              onClick={() => setDarkMode(!darkMode)}
                              style={{
                                  width: 48,
                                  height: 24,
                                  background: darkMode 
                                    ? 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)' 
                                    : '#cbd5e1',
                                  borderRadius: 9999,
                                  position: "relative",
                                  cursor: "pointer",
                                  transition: "all 0.3s ease",
                              }}
                          >
                              <div
                                  style={{
                                      width: 18,
                                      height: 18,
                                      background: "#fff",
                                      borderRadius: "50%",
                                      position: "absolute",
                                      top: 3,
                                      left: darkMode ? 27 : 3,
                                      transition: "left 0.25s ease",
                                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                                  }}
                              />
                          </div>
                          <span style={{ marginLeft: 8, fontSize: 14 }}>🌙</span>
                      </div>

                      {user && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Link
                                  to="/profile"
                                  aria-label="Profile"
                                  style={{ textDecoration: "none" }}
                              >
                                  {user?.photoURL ? (
                                      <img
                                          src={user.photoURL}
                                          alt="Profile"
                                          style={{
                                              width: 38,
                                              height: 38,
                                              borderRadius: "50%",
                                              objectFit: "cover",
                                              border: "2px solid transparent",
                                              background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%) border-box',
                                              transition: 'transform 0.2s ease',
                                          }}
                                          onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
                                          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                                      />
                                  ) : (
                                      <div
                                          style={{
                                              width: 38,
                                              height: 38,
                                              borderRadius: "50%",
                                              background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
                                              color: "#fff",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              fontWeight: 600,
                                              fontSize: 14,
                                              textTransform: "uppercase",
                                              transition: 'transform 0.2s ease',
                                          }}
                                          onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
                                          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                                      >
                                          {user?.displayName
                                              ? user.displayName.charAt(0)
                                              : user?.email
                                              ? user.email.charAt(0)
                                              : "U"}
                                      </div>
                                  )}
                              </Link>

                              <button
                                  onClick={handleLogout}
                                  style={{
                                      padding: '8px 16px',
                                      borderRadius: 8,
                                      background: 'transparent',
                                      border: `1px solid ${darkMode ? 'rgba(239, 68, 68, 0.5)' : '#fecaca'}`,
                                      color: '#ef4444',
                                      fontWeight: 500,
                                      fontSize: 13,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                  }}
                                  onMouseOver={(e) => {
                                      e.currentTarget.style.background = '#ef4444';
                                      e.currentTarget.style.color = '#fff';
                                      e.currentTarget.style.borderColor = '#ef4444';
                                  }}
                                  onMouseOut={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.color = '#ef4444';
                                      e.currentTarget.style.borderColor = darkMode ? 'rgba(239, 68, 68, 0.5)' : '#fecaca';
                                  }}
                              >
                                  Logout
                              </button>
                          </div>
                      )}
                  </div>
              </nav>

              <Routes>
                  {/* Default route redirects to auth page */}
                  <Route path="/" element={<Navigate to="/auth" replace />} />

                  {/* Auth login/signup */}
                  <Route
                      path="/auth"
                      element={<AuthPage darkMode={darkMode} />}
                  />

                  {/* Protected routes */}
                  <Route
                      path="/map"
                      element={
                          <ProtectedRoute>
                              <div
                                  className="app-container"
                                  style={{
                                      height: "100vh",
                                      width: "100vw",
                                      position: "relative",
                                  }}
                              >
                                  <div
                                      className="map-container"
                                      style={{ flex: 1, height: "100vh" }}
                                  >
                                      <MapViewComponent
                                          activeCategory={activeCategory}
                                          onPlacesFound={handlePlacesFound}
                                          recommendedPlace={recommendedPlace}
                                          workflowResults={workflowResults}
                                          onPlaceSelect={handlePlaceSelect}
                                          onClearResults={handleClearResults} // NEW: Add this prop
                                          apiKey={apiKey}
                                          darkMode={darkMode}
                                      />
                                  </div>

                                  {/* Favorites Widget */}
                                  <FavoritesWidget 
                                      darkMode={darkMode}
                                      onViewFavourite={handleViewFavourite}
                                  />

                                  {/* Floating Chatbot Button - NiagaMap Theme */}
                                  {!chatbotOpen && (
                                      <button
                                          onClick={() => setChatbotOpen(true)}
                                          style={{
                                              position: "fixed",
                                              bottom: 32,
                                              right: 32,
                                              zIndex: 1001,
                                              borderRadius: "50%",
                                              width: 64,
                                              height: 64,
                                              background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                                              color: "#fff",
                                              fontSize: 28,
                                              border: "none",
                                              boxShadow: "0 8px 32px rgba(139, 92, 246, 0.4)",
                                              cursor: "pointer",
                                              transition: "all 0.3s ease",
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                          }}
                                          onMouseEnter={(e) => {
                                              e.target.style.transform = "scale(1.1) rotate(5deg)";
                                              e.target.style.boxShadow = "0 12px 40px rgba(139, 92, 246, 0.5)";
                                          }}
                                          onMouseLeave={(e) => {
                                              e.target.style.transform = "scale(1) rotate(0deg)";
                                              e.target.style.boxShadow = "0 8px 32px rgba(139, 92, 246, 0.4)";
                                          }}
                                          aria-label="Open AI Assistant"
                                      >
                                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                            <circle cx="9" cy="10" r="1" fill="currentColor"/>
                                            <circle cx="12" cy="10" r="1" fill="currentColor"/>
                                            <circle cx="15" cy="10" r="1" fill="currentColor"/>
                                          </svg>
                                      </button>
                                  )}

                                  {/* ✅ Chatbot renders its own full-screen overlay */}
                                  {chatbotOpen && (
                                      <Chatbot
                                          onExtracted={handleChatbotResult}
                                          onClose={() => setChatbotOpen(false)}
                                          onShowRecommendations={
                                              handleShowRecommendations
                                          }
                                          onViewFavourite={handleViewFavourite}
                                        analysisRunning={analysisRunning}
                                        activeChatId={analysisChatId}
                                        onAnalysisStart={(chatId) => {
                                          setAnalysisRunning(true);
                                          setAnalysisChatId(chatId || null);
                                        }}
                                        onAnalysisEnd={() => {
                                          setAnalysisRunning(false);
                                          setAnalysisChatId(null);
                                        }}
                                          darkMode={darkMode}
                                      />
                                  )}
                              </div>
                          </ProtectedRoute>
                      }
                  />

                  <Route
                      path="/analysis"
                      element={
                          <ProtectedRoute>
                              <AnalysesPage darkMode={darkMode} />
                          </ProtectedRoute>
                      }
                  />

                  <Route
                      path="/profile"
                      element={
                          <ProtectedRoute>
                              <Profile darkMode={darkMode} />
                          </ProtectedRoute>
                      }
                  />

                  {/* Root path - redirect based on auth state */}
                  <Route 
                      path="/" 
                      element={
                          loading ? null : user ? <Navigate to="/map" replace /> : <Navigate to="/auth" replace />
                      } 
                  />

                  <Route path="/auth" element={<AuthPage darkMode={darkMode} />} />

                  {/* Any other path redirects to auth */}
                  <Route path="*" element={<Navigate to="/auth" replace />} />
              </Routes>
          </div>
      </>
  );
}

export default App;
