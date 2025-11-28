import axios from "axios";
import { LOCATION_KEYWORDS, NEAR_ME_PATTERNS } from "../constants/chatbotConstants";

const ARCGIS_GEOCODE_URL = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";
const ARCGIS_API_KEY = import.meta.env.VITE_ARCGIS_API_KEY; // For Vite

export const fetchLocationSuggestions = async (query) => {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    // Use findAddressCandidates directly for autocomplete with more details
    const response = await axios.get(`${ARCGIS_GEOCODE_URL}/findAddressCandidates`, {
      params: {
        SingleLine: query,
        category: "Address,Populated Place",
        countryCode: "MYS", // Malaysia
        maxLocations: 5,
        outFields: "PlaceName,Place_addr,City,Region",
        f: "json",
        token: ARCGIS_API_KEY,
      },
    });
    
    const candidates = response.data.candidates || [];
    
    // Transform to match expected format
    return candidates.map(candidate => ({
      text: candidate.address,
      magicKey: null, // Not needed since we have full data
      location: candidate.location,
      score: candidate.score,
      attributes: candidate.attributes,
    }));
  } catch (error) {
    console.error("ArcGIS location search error:", error);
    return [];
  }
};

export const validateLocation = async (message) => {
  const isNearMe = NEAR_ME_PATTERNS.some(pattern => 
    message.toLowerCase().includes(pattern)
  );
  
  if (isNearMe) {
    return { valid: true, isNearMe: true };
  }
  
  const words = message.split(' ');
  const keywordIndex = words.findIndex(word => 
    LOCATION_KEYWORDS.includes(word.toLowerCase())
  );
  
  if (keywordIndex === -1) {
    return { 
      valid: false, 
      error: "Please specify a location (e.g., 'near Bangsar' or 'near me')" 
    };
  }
  
  const locationPart = words.slice(keywordIndex + 1).join(' ');
  
  if (!locationPart.trim()) {
    return { 
      valid: false, 
      error: "Please specify a location name" 
    };
  }
  
  try {
    const response = await axios.get(`${ARCGIS_GEOCODE_URL}/findAddressCandidates`, {
      params: {
        SingleLine: locationPart,
        category: "Address,Populated Place",
        countryCode: "MYS",
        maxLocations: 1,
        f: "json",
        token: ARCGIS_API_KEY,
      },
    });
    
    const candidates = response.data.candidates || [];
    
    if (candidates.length === 0) {
      return { 
        valid: false, 
        error: `Location "${locationPart}" not found in Malaysia. Please select from suggestions.` 
      };
    }
    
    return { valid: true, isNearMe: false, locationData: candidates[0] };
  } catch (error) {
    console.error("ArcGIS location validation error:", error);
    return { 
      valid: false, 
      error: "Unable to validate location. Please try again." 
    };
  }
};

export const extractPotentialLocation = (input) => {
  const words = input.split(' ');
  const keywordIndex = words.findIndex(word => 
    LOCATION_KEYWORDS.includes(word.toLowerCase())
  );
  
  if (keywordIndex !== -1 && words[keywordIndex + 1]) {
    return words.slice(keywordIndex + 1).join(' ');
  }
  return null;
};

export const replaceLocationInInput = (input, locationName) => {
  const words = input.split(' ');
  const keywordIndex = words.findIndex(word => 
    LOCATION_KEYWORDS.includes(word.toLowerCase())
  );
  
  if (keywordIndex !== -1) {
    const beforeLocation = words.slice(0, keywordIndex + 1).join(' ');
    return `${beforeLocation} ${locationName}`;
  }
  return input;
};