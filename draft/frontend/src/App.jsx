import { useState } from "react";
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Basemap from "./components/Esrimap";
import MapViewComponent from "./components/MapView";
import Chatbot from "./components/Chatbot";
import AuthPage from "./components/AuthPage";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import "./App.css";
import api from "./api/api";
import AnalysesPage from "./components/Analysis";


function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/auth" replace />;
}

function App() {
  const location = useLocation(); // ✅ Get current route
  const [places, setPlaces] = useState([]);
  const [activeCategory, setActiveCategory] = useState("4d4b7105d754a06377d81259");
    const [recommendedPlace, setRecommendedPlace] = useState(null);
    const [darkMode, setDarkMode] = useState(false);


  // New: Handler for recommendations from Chatbot
  const handleShowRecommendations = (locations, referencePoint) => {
    setRecommendedPlace({ recommended_locations: locations, reference_point: referencePoint });
  };

  const [currentLocationCoordinate, setCurrentLocationCoordinate] =
      useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chatbotOpen, setChatbotOpen] = useState(false);

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
        const coord = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) =>
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        address: position.coords.address || "Current Location",
                    }),
                (error) => reject(error),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
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
        alert("Failed to access your location.");
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
      alert("Could not fetch recommended locations.");
    }

  };
  

  // Helper function to check active route
  const isActive = (path) => location.pathname === path;

  return (
    <>
      <div className={darkMode ? "dark" : ""}>
        <nav className="bg-white dark:bg-neutral-900 text-black dark:text-white shadow-md px-8 py-4 flex justify-between items-center">
          {/* Left Side: Logo + Links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2rem",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 22,
                color: "#1976d2",
                letterSpacing: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg
                width="28"
                height="28"
                fill="#1976d2"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
              </svg>
              NiagaMap
            </span>

            {user && (
              <>
                <Link
                  to="/map"
                  style={{
                    color: isActive("/map") ? "#fff" : "#1976d2", // ✅ White when active
                    background: isActive("/map") ? "#1976d2" : "transparent", // ✅ Blue bg when active
                    fontWeight: 600,
                    textDecoration: "none",
                    padding: "10px 18px",
                    borderRadius: 8,
                    transition: "all 0.2s",
                    boxShadow: isActive("/map") ? "0 2px 8px rgba(25, 118, 210, 0.3)" : "none",
                  }}
                  onMouseOver={(e) => {
                    if (!isActive("/map")) {
                      e.currentTarget.style.background = "#f0f7ff";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive("/map")) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  Places Services
                </Link>

                <Link
                  to="/basemap"
                  style={{
                    color: isActive("/basemap") ? "#fff" : "#1976d2",
                    background: isActive("/basemap") ? "#1976d2" : "transparent",
                    fontWeight: 600,
                    textDecoration: "none",
                    padding: "10px 18px",
                    borderRadius: 8,
                    transition: "all 0.2s",
                    boxShadow: isActive("/basemap") ? "0 2px 8px rgba(25, 118, 210, 0.3)" : "none",
                  }}
                  onMouseOver={(e) => {
                    if (!isActive("/basemap")) {
                      e.currentTarget.style.background = "#f0f7ff";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive("/basemap")) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  Basemap
                </Link>

                <Link
                  to="/analysis"
                  style={{
                    color: isActive("/analysis") ? "#fff" : "#1976d2",
                    background: isActive("/analysis") ? "#1976d2" : "transparent",
                    fontWeight: 600,
                    textDecoration: "none",
                    padding: "10px 18px",
                    borderRadius: 8,
                    transition: "all 0.2s",
                    boxShadow: isActive("/analysis") ? "0 2px 8px rgba(25, 118, 210, 0.3)" : "none",
                  }}
                  onMouseOver={(e) => {
                    if (!isActive("/analysis")) {
                      e.currentTarget.style.background = "#f0f7ff";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive("/analysis")) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  Analysis
                </Link>
              </>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2rem",
            }}
          >
            {/* Right Side: Dark Mode Toggle */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ marginRight: 8, fontSize: 18 }}>
                ☀️
              </span>
              <div
                onClick={() => setDarkMode(!darkMode)}
                style={{
                  width: 60,
                  height: 30,
                  background: darkMode ? "#444" : "#ccc",
                  borderRadius: 9999,
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.3s",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    background: darkMode ? "#fff" : "#000",
                    borderRadius: "50%",
                    position: "absolute",
                    top: 2,
                    left: darkMode ? 32 : 2,
                    transition: "left 0.25s",
                  }}
                />
              </div>
              <span style={{ marginLeft: 8, fontSize: 18 }}>
                🌙
              </span>
            </div>
            {user && (
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 dark:text-white"
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "#d32f2f")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "#f44336")
                }
              >
                Logout
              </button>
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
                      onPlaceSelect={handlePlaceSelect}
                      recommendedPlace={recommendedPlace}
                      currentLocationCoordinate={currentLocationCoordinate}
                      apiKey={apiKey}
                      darkMode={darkMode}
                    />
                  </div>

                  {/* Floating Chatbot Button */}
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
                        background: "#1976d2",
                        color: "#fff",
                        fontSize: 32,
                        border: "none",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                        cursor: "pointer",
                        transition: "transform 0.2s",
                      }}
                      onMouseEnter={(e) => (e.target.style.transform = "scale(1.1)")}
                      onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
                      aria-label="Open Chatbot"
                    >
                      💬
                    </button>
                  )}

                  {/* ✅ Chatbot renders its own full-screen overlay */}
                  {chatbotOpen && (
                    <Chatbot
                      onExtracted={handleChatbotResult}
                      onClose={() => setChatbotOpen(false)}
                      onShowRecommendations={handleShowRecommendations}
                      darkMode={darkMode}
                    />
                  )}
                </div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/basemap"
            element={
              <ProtectedRoute>
                <Basemap />
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

          {/* Any other path redirects to auth */}
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
