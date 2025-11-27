export const extractCleanMessage = (userPrompt) => {
  if (!userPrompt) return "";
  const match = userPrompt.match(/User Message:\s*(.+)/i);
  return match ? match[1].trim() : userPrompt;
};

export const extractCategory = (userPrompt) => {
  if (!userPrompt) return null;
  const match = userPrompt.match(/Category:\s*(.+)/i);
  return match ? match[1].split('\n')[0].trim() : null;
};

export const extractWeights = (userPrompt) => {
  if (!userPrompt) return null;
  try {
    const demandMatch = userPrompt.match(/Demand:\s*(\d+)%/i);
    const competitionMatch = userPrompt.match(/Competition:\s*(\d+)%/i);
    const accessibilityMatch = userPrompt.match(/Accessibility:\s*(\d+)%/i);
    const zoningMatch = userPrompt.match(/Zoning\/Context:\s*(\d+)%/i);
    const riskMatch = userPrompt.match(/Risk\/Hazard:\s*(\d+)%/i);
    
    if (demandMatch && competitionMatch && accessibilityMatch && zoningMatch && riskMatch) {
      return {
        demand: parseInt(demandMatch[1]),
        competition: parseInt(competitionMatch[1]),
        accessibility: parseInt(accessibilityMatch[1]),
        zoning: parseInt(zoningMatch[1]),
        risk: parseInt(riskMatch[1]),
      };
    }
  } catch (e) {
    return null;
  }
  return null;
};

export const normalizeWeights = (weights) => {
  const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
  const normalizedWeights = { ...weights };
  
  if (total !== 100) {
    const scale = 100 / total;
    Object.keys(normalizedWeights).forEach(key => {
      normalizedWeights[key] = Math.round(normalizedWeights[key] * scale);
    });
    const newTotal = Object.values(normalizedWeights).reduce((sum, val) => sum + val, 0);
    if (newTotal !== 100) {
      const diff = 100 - newTotal;
      normalizedWeights.demand += diff;
    }
  }
  return normalizedWeights;
};

export const buildEnrichedMessage = (category, weights, userMessage) => {
  return `
Category: ${category}
Indicator Weights:
- Demand: ${weights.demand}%
- Competition: ${weights.competition}%
- Accessibility: ${weights.accessibility}%
- Zoning/Context: ${weights.zoning}%
- Risk/Hazard: ${weights.risk}%

User Message: ${userMessage}
  `.trim();
};