import axios from "axios";
import { LOCATION_KEYWORDS, NEAR_ME_PATTERNS } from "../constants/chatbotConstants";

export const fetchLocationSuggestions = async (query) => {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: `${query}, Malaysia`,
        format: 'json',
        limit: 5,
        countrycodes: 'my',
      },
    });
    return response.data;
  } catch (error) {
    console.error("Location search error:", error);
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
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: `${locationPart}, Malaysia`,
        format: 'json',
        limit: 1,
        countrycodes: 'my',
      },
    });
    
    if (response.data.length === 0) {
      return { 
        valid: false, 
        error: `Location "${locationPart}" not found in Malaysia. Please select from suggestions.` 
      };
    }
    
    return { valid: true, isNearMe: false };
  } catch (error) {
    console.error("Location validation error:", error);
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