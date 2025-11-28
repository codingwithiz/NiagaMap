import { useState, useEffect } from "react";
import { CATEGORY_PRESETS } from "../constants/chatbotConstants";

export const useWeightManager = (selectedCategory) => {
  const [weights, setWeights] = useState(CATEGORY_PRESETS.retail.weights);
  const [lockedIndicators, setLockedIndicators] = useState({
    demand: false,
    competition: false,
    accessibility: false,
    zoning: false,
    risk: false,
  });

  useEffect(() => {
    setWeights(CATEGORY_PRESETS[selectedCategory].weights);
    // Reset locks when category changes
    setLockedIndicators({
      demand: false,
      competition: false,
      accessibility: false,
      zoning: false,
      risk: false,
    });
  }, [selectedCategory]);

  const toggleLock = (indicator) => {
    setLockedIndicators((prev) => ({
      ...prev,
      [indicator]: !prev[indicator],
    }));
  };

  const handleWeightChange = (indicator, newValue) => {
    const oldValue = weights[indicator];
    const delta = newValue - oldValue;

    if (delta === 0) return;

    // Get unlocked indicators (excluding the one being changed)
    const unlockedIndicators = Object.keys(weights).filter(
      (k) => k !== indicator && !lockedIndicators[k]
    );

    // If all other indicators are locked, don't allow change
    if (unlockedIndicators.length === 0) {
      return;
    }

    const newWeights = { ...weights, [indicator]: newValue };

    // Calculate total of locked indicators (excluding current)
    const lockedTotal = Object.keys(weights)
      .filter((k) => k !== indicator && lockedIndicators[k])
      .reduce((sum, k) => sum + weights[k], 0);

    // Calculate how much weight needs to be distributed among unlocked indicators
    const targetUnlockedTotal = 100 - newValue - lockedTotal;

    if (targetUnlockedTotal < 0) {
      // Can't adjust if locked indicators already exceed available weight
      return;
    }

    // Get current total of unlocked indicators
    const currentUnlockedTotal = unlockedIndicators.reduce(
      (sum, k) => sum + weights[k],
      0
    );

    if (currentUnlockedTotal === 0) {
      // Distribute evenly if all unlocked are zero
      const perIndicator = Math.floor(
        targetUnlockedTotal / unlockedIndicators.length
      );
      let remaining = targetUnlockedTotal;

      unlockedIndicators.forEach((k, idx) => {
        if (idx === unlockedIndicators.length - 1) {
          newWeights[k] = remaining;
        } else {
          newWeights[k] = perIndicator;
          remaining -= perIndicator;
        }
      });
    } else {
      // Distribute proportionally among unlocked indicators
      const scale = targetUnlockedTotal / currentUnlockedTotal;
      let adjustedTotal = 0;

      unlockedIndicators.forEach((k, idx) => {
        if (idx === unlockedIndicators.length - 1) {
          newWeights[k] = targetUnlockedTotal - adjustedTotal;
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
    setLockedIndicators({
      demand: false,
      competition: false,
      accessibility: false,
      zoning: false,
      risk: false,
    });
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const isWeightValid = totalWeight === 100;

  return {
    weights,
    setWeights,
    lockedIndicators,
    toggleLock,
    handleWeightChange,
    resetWeights,
    totalWeight,
    isWeightValid,
  };
};