import { useState, useEffect } from "react";
import { CATEGORY_PRESETS } from "../constants/chatbotConstants";

export const useWeightManager = (selectedCategory) => {
  const [weights, setWeights] = useState(CATEGORY_PRESETS.retail.weights);

  useEffect(() => {
    setWeights(CATEGORY_PRESETS[selectedCategory].weights);
  }, [selectedCategory]);

  const handleWeightChange = (indicator, newValue) => {
    const oldValue = weights[indicator];
    const delta = newValue - oldValue;
    
    if (delta === 0) return;

    const otherIndicators = Object.keys(weights).filter(k => k !== indicator);
    const otherTotal = otherIndicators.reduce((sum, k) => sum + weights[k], 0);

    if (newValue === 100) {
      const newWeights = { ...weights };
      otherIndicators.forEach(k => newWeights[k] = 0);
      newWeights[indicator] = 100;
      setWeights(newWeights);
      return;
    }

    const newWeights = { ...weights, [indicator]: newValue };
    
    if (otherTotal === 0) {
      const perIndicator = Math.floor((100 - newValue) / otherIndicators.length);
      let remaining = 100 - newValue;
      otherIndicators.forEach((k, idx) => {
        if (idx === otherIndicators.length - 1) {
          newWeights[k] = remaining;
        } else {
          newWeights[k] = perIndicator;
          remaining -= perIndicator;
        }
      });
    } else {
      const targetOtherTotal = 100 - newValue;
      const scale = targetOtherTotal / otherTotal;
      
      let adjustedTotal = 0;
      otherIndicators.forEach((k, idx) => {
        if (idx === otherIndicators.length - 1) {
          newWeights[k] = targetOtherTotal - adjustedTotal;
        } else {
          const adjusted = Math.round(weights[k] * scale);
          newWeights[k] = adjusted;
          adjustedTotal += adjusted;
        }
      });
    }

    setWeights(newWeights);
  };

  const resetWeights = () => {
    setWeights(CATEGORY_PRESETS[selectedCategory].weights);
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const isWeightValid = totalWeight === 100;

  return {
    weights,
    setWeights,
    handleWeightChange,
    resetWeights,
    totalWeight,
    isWeightValid
  };
};