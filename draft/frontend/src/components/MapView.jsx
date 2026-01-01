import React, { useEffect, useRef, useState } from "react";
import "@esri/calcite-components/dist/calcite/calcite.css";
import { defineCustomElements } from "@esri/calcite-components/dist/loader";
import esriConfig from "@arcgis/core/config";
import Locate from "@arcgis/core/widgets/Locate";
import MapView from "@arcgis/core/views/MapView";
import Map from "@arcgis/core/Map";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import Circle from "@arcgis/core/geometry/Circle";
import * as places from "@arcgis/core/rest/places";
import PlacesQueryParameters from "@arcgis/core/rest/support/PlacesQueryParameters";
import FetchPlaceParameters from "@arcgis/core/rest/support/FetchPlaceParameters";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import Expand from "@arcgis/core/widgets/Expand";
import Search from "@arcgis/core/widgets/Search";
import Legend from "@arcgis/core/widgets/Legend";
import axios from "axios";

const MapViewComponent = ({
    activeCategory = "4d4b7105d754a06377d81259",
    onPlacesFound,
    recommendedPlace,
    workflowResults,
    onPlaceSelect,
    onClearResults,  // NEW: Add this prop
    apiKey,
    darkMode = false,
}) => {
    const mapRef = useRef(null);
    const bufferLayerRef = useRef(null);
    const placesLayerRef = useRef(null);
    const hexagonLayerRef = useRef(null); // NEW: Layer for hexagons
    const highlightLayerRef = useRef(null); // NEW: Layer for highlighted hexagons

    const [view, setView] = useState(null);
    const [initialized, setInitialized] = useState(false);
    const [lastClickPoint, setLastClickPoint] = useState(null);
    const [selectedPlaceId, setSelectedPlaceId] = useState(null);
    const [hoveredHexId, setHoveredHexId] = useState(null); // NEW: Track hovered hexagon
    const [recommendedLocationsData, setRecommendedLocationsData] = useState(null); // Store AI reasoning data

    useEffect(() => {
        defineCustomElements(window);

        let mapView = null;

        esriConfig.apiKey = apiKey;

        const bufferLayer = new GraphicsLayer({ id: "bufferLayer" });
        const placesLayer = new GraphicsLayer({ id: "placesLayer" });
        const hexagonLayer = new GraphicsLayer({ id: "hexagonLayer" });
        const highlightLayer = new GraphicsLayer({ id: "highlightLayer" });

        bufferLayerRef.current = bufferLayer;
        placesLayerRef.current = placesLayer;
        hexagonLayerRef.current = hexagonLayer;
        highlightLayerRef.current = highlightLayer;

        const map = new Map({
            basemap: darkMode ? "dark-gray-vector" : "streets-vector",
            layers: [bufferLayer, hexagonLayer, highlightLayer, placesLayer],
        });

        mapView = new MapView({
            container: mapRef.current,
            map: map,
            center: [-118.46651, 33.98621],
            zoom: 13,
        });

        mapView.when(() => {
            setView(mapView);
            setInitialized(true);

            const searchWidget = new Search({ view: mapView, resultGraphicEnabled: true, popupEnabled: true });

            const basemapGallery = new BasemapGallery({ view: mapView, source: { portal: { url: "https://www.arcgis.com", useVectorBasemaps: true } } });

            const expandGallery = new Expand({ view: mapView, content: basemapGallery });

            const legend = new Legend({ view: mapView, layerInfos: [ { layer: placesLayer, title: "Locations" }, { layer: hexagonLayer, title: "Analysis Hexagons" } ] });

            mapView.ui.add(searchWidget, "top-left");
            mapView.ui.add(expandGallery, "top-right");
            mapView.ui.add(legend, "bottom-left");

            // Disabled: Places search on map click - focusing on hexagon analysis only
            // mapView.on("click", (event) => {
            //     mapView.hitTest(event).then((response) => {
            //         const hexGraphic = response.results.find((r) => r.graphic.layer === hexagonLayerRef.current)?.graphic;
            //         if (hexGraphic) return;

            //         setLastClickPoint(event.mapPoint);
            //         clearGraphics();
            //         showPlaces(event.mapPoint);
            //     });
            // });

            // Enhanced pointer-move for hexagon hover
            mapView.on("pointer-move", (event) => {
                mapView.hitTest(event).then((response) => {
                    const hexGraphic = response.results.find((r) => r.graphic.layer === hexagonLayerRef.current)?.graphic;

                    if (hexGraphic && hexGraphic.attributes?.hexId) {
                        if (!hexGraphic.attributes?.isRecommended) {
                            handleHexagonHover(hexGraphic);
                        } else {
                            handleRecommendedHexagonHover(hexGraphic);
                        }
                    } else {
                        clearHexagonHighlight();
                        if (hoveredHexId) {
                            mapView.closePopup();
                        }
                    }

                    if (!hexGraphic) {
                        const placeGraphic = response.results.find((r) => r.graphic.layer === placesLayerRef.current)?.graphic;
                        if (placeGraphic && placeGraphic.popupTemplate) {
                            mapView.openPopup({ location: placeGraphic.geometry, title: placeGraphic.popupTemplate.title, content: placeGraphic.popupTemplate.content });
                        }
                    }
                });
            });
        });

        return () => {
            if (mapView) mapView.destroy();
        };
    }, [apiKey, darkMode]);

    useEffect(() => {
        if (view && initialized && lastClickPoint) {
            clearGraphics();
            showPlaces(lastClickPoint);
        }
    }, [activeCategory, initialized, lastClickPoint]);

    // Store recommended locations data for popup content
    useEffect(() => {
        const locations =
            recommendedPlace?.locations ||
            recommendedPlace?.recommended_locations ||
            (Array.isArray(recommendedPlace) ? recommendedPlace : null);

        if (locations) {
            setRecommendedLocationsData(locations);
        } else {
            setRecommendedLocationsData(null);
        }
    }, [recommendedPlace]);

    // NEW: Combined effect to render workflow hexagons with recommended locations
    useEffect(() => {
        console.log("Workflow effect triggered:", {
            hasResults: workflowResults?.length > 0,
            hasView: !!view,
            hexagonLayer: !!hexagonLayerRef.current,
            hasRecommendedPlace: !!recommendedPlace,
        });

        if (workflowResults && workflowResults.length > 0 && view) {
            console.log("Rendering hexagons:", workflowResults);
            
            // Extract locations directly from recommendedPlace prop
            const locations =
                recommendedPlace?.locations ||
                recommendedPlace?.recommended_locations ||
                (Array.isArray(recommendedPlace) ? recommendedPlace : null);
            
            console.log("Passing locations to render:", locations);
            renderWorkflowHexagons(workflowResults, locations);
        }
    }, [workflowResults, view, recommendedPlace]);

    const clearGraphics = () => {
        if (!bufferLayerRef.current || !placesLayerRef.current) return;

        bufferLayerRef.current.removeAll();
        placesLayerRef.current.removeAll();
        
        // Clear hexagon layers
        clearHexagonLayers();
        
        // Notify parent to clear workflow results state
        if (onClearResults) {
            onClearResults();
        }
    };

    // Helper: safe wrapper around view.goTo to ignore interrupted navigation errors
    const safeGoTo = async (target, options) => {
        if (!view) return;
        try {
            await view.goTo(target, options);
        } catch (err) {
            // ArcGIS may throw an interruption error when another navigation occurs
            if (
                err &&
                (err.name === "view:goto-interrupted" ||
                    (err.message && err.message.includes("Goto was interrupted")))
            ) {
                // Ignore expected interruption
                console.debug("view.goTo interrupted and ignored");
                return;
            }
            console.error("view.goTo error:", err);
        }
    };

    // NEW: Clear hexagon layers
    const clearHexagonLayers = () => {
        if (hexagonLayerRef.current) {
            hexagonLayerRef.current.removeAll();
        }
        if (highlightLayerRef.current) {
            highlightLayerRef.current.removeAll();
        }
    };

    // NEW: Handle hexagon hover (for non-recommended hexagons - show popup)
    const handleHexagonHover = (graphic) => {
        if (!highlightLayerRef.current || !view) return;

        const hexId = graphic.attributes?.hexId;
        if (hexId === hoveredHexId) return; // Already hovering this hexagon

        setHoveredHexId(hexId);
        highlightLayerRef.current.removeAll();

        // Enhanced highlight for non-recommended hexagons
        const highlight = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [100, 149, 237, 0.4], // Brighter cornflower blue
                outline: {
                    color: [70, 120, 220, 1],
                    width: 3.5,
                },
            },
        });
        highlightLayerRef.current.add(highlight);

        // Show popup with hexagon info
        view.openPopup({
            location: graphic.geometry.centroid,
            title: graphic.attributes?.title || "Hexagon",
            content: graphic.attributes?.content || "",
        });
    };

    // NEW: Handle recommended hexagon hover (highlight only, no popup)
    const handleRecommendedHexagonHover = (graphic) => {
        if (!highlightLayerRef.current || !view) return;

        const hexId = graphic.attributes?.hexId;
        if (hexId === hoveredHexId) return;

        setHoveredHexId(hexId);
        highlightLayerRef.current.removeAll();

        // Enhanced glow effect for recommended hexagons on hover
        const outerGlow = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [65, 165, 255, 0.15],
                outline: { color: [65, 165, 255, 0.85], width: 8 },
            },
        });

        const middleGlow = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [30, 144, 255, 0.3],
                outline: { color: [30, 144, 255, 1], width: 5 },
            },
        });

        const innerHighlight = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [255, 255, 255, 0.25],
                outline: { color: [255, 255, 255, 0.95], width: 2.5 },
            },
        });

        highlightLayerRef.current.addMany([outerGlow, middleGlow, innerHighlight]);
    };

    // NEW: Clear hexagon highlight
    const clearHexagonHighlight = () => {
        if (hoveredHexId) {
            setHoveredHexId(null);
            if (highlightLayerRef.current) {
                highlightLayerRef.current.removeAll();
            }
        }
    };

    // NEW: Render workflow hexagons on map
    const renderWorkflowHexagons = (results, locationsData) => {
        console.log("renderWorkflowHexagons called with:", results);
        console.log("Locations data received:", locationsData);
        
        if (!hexagonLayerRef.current) {
            console.error("Missing hexagonLayer:", { hexagonLayer: !!hexagonLayerRef.current });
            return;
        }

        // Clear existing hexagons
        clearHexagonLayers();

        // Sort results to identify top 3 recommended locations
        const sortedResults = [...results].sort((a, b) => b.finalScore - a.finalScore);
        const top3HexIds = sortedResults.slice(0, 3).map(r => r.hexagon.hex_id);

        // Get score range for color scaling
        const scores = results.map(r => r.finalScore);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const scoreRange = maxScore - minScore || 1;

        console.log("Score range:", { minScore, maxScore, scoreRange });
        console.log("Top 3 hex IDs:", top3HexIds);
        console.log("Recommended locations data available:", locationsData);

        // Helper function to find matching location data by coordinates
        const findMatchingLocation = (hexagonCentroid) => {
            if (!locationsData || !hexagonCentroid) {
                console.log("Missing data - locationsData:", !!locationsData, "centroid:", !!hexagonCentroid);
                return null;
            }
            
            // Find location with closest matching coordinates (within ~50m tolerance)
            const tolerance = 0.0005; // roughly 50 meters
            
            const match = locationsData.find(loc => {
                const latDiff = Math.abs(loc.lat - hexagonCentroid.lat);
                const lonDiff = Math.abs(loc.lon - hexagonCentroid.lon);
                return latDiff < tolerance && lonDiff < tolerance;
            });
            
            if (match) {
                console.log("✅ Match found for centroid", hexagonCentroid, ":", match.location_id);
            } else {
                console.log("❌ No match for centroid", hexagonCentroid);
            }
            return match;
        };

        // First pass: render all non-recommended hexagons
        results.forEach((result, index) => {
            const hexagon = result.hexagon;
            const isRecommended = top3HexIds.includes(hexagon.hex_id);
            
            // Skip recommended hexagons in first pass (render them on top later)
            if (isRecommended) return;
            
            if (!hexagon.coordinates || !Array.isArray(hexagon.coordinates)) {
                console.error(`Hexagon ${index} has invalid coordinates:`, hexagon.coordinates);
                return;
            }

            try {
                const polygon = new Polygon({
                    rings: [hexagon.coordinates],
                    spatialReference: { wkid: 4326 },
                });

                const normalizedScore = (result.finalScore - minScore) / scoreRange;
                const color = getScoreColor(normalizedScore, false);
                const content = buildHexagonPopupContent(result, 0);

                const hexGraphic = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: color,
                        outline: {
                            color: [60, 60, 60, 0.85],
                            width: 1.5,
                        },
                        style: "solid",
                    },
                    attributes: {
                        hexId: hexagon.hex_id,
                        hexIndex: hexagon.hex_index,
                        analysisId: hexagon.analysis_id,
                        isRecommended: false,
                        rank: 0,
                        score: result.finalScore,
                        title: `Hexagon #${hexagon.hex_index + 1}`,
                        content: content,
                    },
                    popupTemplate: {
                        title: `Hexagon #${hexagon.hex_index + 1}`,
                        content: content,
                    },
                });

                hexagonLayerRef.current.add(hexGraphic);
            } catch (err) {
                console.error(`Error creating polygon for hexagon ${index}:`, err);
            }
        });

        // Second pass: render recommended hexagons on top with glow effect
        sortedResults.slice(0, 3).forEach((result, rankIndex) => {
            const hexagon = result.hexagon;
            const rank = rankIndex + 1;
            
            if (!hexagon.coordinates || !Array.isArray(hexagon.coordinates)) {
                return;
            }

            try {
                const polygon = new Polygon({
                    rings: [hexagon.coordinates],
                    spatialReference: { wkid: 4326 },
                });

                // Enhanced glow effect with smoother gradient
                // Outer glow layer - Soft blue aura
                const outerGlow = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: [65, 165, 255, 0.12],  // Light blue
                        outline: {
                            color: [65, 165, 255, 0.35],
                            width: 10,
                        },
                    },
                });
                hexagonLayerRef.current.add(outerGlow);

                // Middle glow layer - Medium intensity
                const middleGlow = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: [30, 144, 255, 0.3],
                        outline: {
                            color: [30, 144, 255, 0.75],
                            width: 6,
                        },
                    },
                });
                hexagonLayerRef.current.add(middleGlow);

                // Main hexagon - Vibrant blue with crisp border
                // Build enhanced popup content with AI reasoning for recommended hexagons
                // Match location data by coordinates instead of array index
                const matchedLocation = findMatchingLocation(result.centroid);
                const popupContent = buildRecommendedHexagonPopup(result, rank, matchedLocation);
                
                const hexGraphic = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: [30, 144, 255, 0.7],  // More opaque for better visibility
                        outline: {
                            color: [0, 90, 180, 1],  // Rich dark blue outline
                            width: 2.5,
                        },
                    },
                    attributes: {
                        hexId: hexagon.hex_id,
                        hexIndex: hexagon.hex_index,
                        analysisId: hexagon.analysis_id,
                        isRecommended: true,
                        rank: rank,
                        score: result.finalScore,
                        title: `🏆 Recommended Location #${rank}`,
                    },
                    popupTemplate: {
                        title: `🏆 Recommended Location #${rank}`,
                        content: popupContent,
                    },
                });
                hexagonLayerRef.current.add(hexGraphic);

                // Add rank label with enhanced styling
                if (result.centroid) {
                    const labelPoint = new Point({ longitude: result.centroid.lon, latitude: result.centroid.lat, spatialReference: { wkid: 4326 } });

                    // Shadow/glow effect for badge
                    const shadowCircle = new Graphic({
                        geometry: labelPoint,
                        symbol: {
                            type: "simple-marker",
                            color: [0, 0, 0, 0.3],
                            size: 36,
                            outline: { color: [0, 0, 0, 0], width: 0 },
                        },
                    });
                    hexagonLayerRef.current.add(shadowCircle);

                    // Background circle for label - Gradient effect via outline
                    const labelBg = new Graphic({
                        geometry: labelPoint,
                        symbol: {
                            type: "simple-marker",
                            color: [20, 120, 220, 1],  // Rich blue
                            size: 32,
                            outline: {
                                color: [255, 255, 255, 1],
                                width: 3,
                            },
                        },
                    });
                    hexagonLayerRef.current.add(labelBg);

                    const labelGraphic = new Graphic({
                        geometry: labelPoint,
                        symbol: {
                            type: "text",
                            text: `#${rank}`,
                            color: [255, 255, 255, 1],
                            haloColor: [0, 50, 100, 0.9],
                            haloSize: 1.5,
                            font: {
                                size: 14,
                                weight: "bold",
                                family: "'Segoe-UI', Arial, sans-serif",
                            },
                        },
                    });
                    hexagonLayerRef.current.add(labelGraphic);
                }
            } catch (err) {
                console.error(`Error creating recommended hexagon:`, err);
            }
        });

        console.log("Total graphics in hexagon layer:", hexagonLayerRef.current.graphics.length);

        // Zoom to hexagons
        if (results.length > 0 && view) {
            const allPoints = results
                .filter(r => r.centroid)
                .map(r => new Point({
                    longitude: r.centroid.lon,
                    latitude: r.centroid.lat,
                    spatialReference: { wkid: 4326 },
                }));

            if (allPoints.length > 0) {
                safeGoTo(allPoints, {
                    duration: 1000,
                    easing: "ease-in-out",
                }).then(() => {
                    console.log("Zoomed to hexagons successfully");
                });
            }
        }
    };

    // NEW: Get color based on score (gradient from red to green)
    const getScoreColor = (normalizedScore, isRecommended) => {
        if (isRecommended) {
            return [30, 144, 255, 0.65]; // Vibrant dodger blue for recommended
        }

        // Enhanced gradient: red (low) → orange → yellow → lime → green (high)
        let r, g, b;
        
        if (normalizedScore < 0.33) {
            // Red to Orange (0 to 0.33)
            const t = normalizedScore * 3; // 0 to 1
            r = 255;
            g = Math.round(100 + 100 * t); // 100 to 200
            b = 30;
        } else if (normalizedScore < 0.67) {
            // Orange to Yellow-Green (0.33 to 0.67)
            const t = (normalizedScore - 0.33) * 3; // 0 to 1
            r = Math.round(255 - 100 * t); // 255 to 155
            g = Math.round(200 + 30 * t); // 200 to 230
            b = 30;
        } else {
            // Yellow-Green to Vibrant Green (0.67 to 1)
            const t = (normalizedScore - 0.67) * 3; // 0 to 1
            r = Math.round(155 - 115 * t); // 155 to 40
            g = Math.round(230 + 25 * t); // 230 to 255
            b = Math.round(30 + 50 * t); // 30 to 80
        }

        const opacity = 0.45 + normalizedScore * 0.3; // 0.45 to 0.75 (better visibility)

        return [r, g, b, opacity];
    };

    // NEW: Build enhanced popup content for recommended hexagons with AI reasoning
    const buildRecommendedHexagonPopup = (result, rank, locationData) => {
        let content = `<div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 12px; max-width: 400px;">`;
        
        // Rank badge
        content += `<div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); padding: 12px; border-radius: 10px; margin-bottom: 16px; text-align: center; box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);">`;
        content += `<span style="font-size: 28px;">🏆</span>`;
        content += `<p style="margin: 6px 0 0 0; font-weight: bold; color: #fff; font-size: 16px;">Recommended Location #${rank}</p>`;
        content += `</div>`;

        // Total Score
        content += `<div style="background: linear-gradient(135deg, #e3f2fd 0%, #f5f5f5 100%); padding: 12px; border-radius: 8px; margin-bottom: 12px;">`;
        content += `<p style="margin: 0; text-align: center;"><b style="color: #555;">📊 Total Score:</b></p>`;
        content += `<p style="margin: 6px 0 0 0; text-align: center; font-size: 32px; color: #1976d2; font-weight: bold;">${result.finalScore.toFixed(2)}</p>`;
        content += `</div>`;

        // AI Reasoning (if available)
        const reasoning =
            (locationData && (locationData.ai_reason || locationData.reason)) ||
            result?.ai_reason ||
            result?.reason;

        if (reasoning) {
            content += `<div style="background-color: #e8f5e9; padding: 14px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #4caf50; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
            content += `<p style="margin: 0 0 6px 0; font-weight: bold; color: #2e7d32; font-size: 13px;">💡 AI Analysis</p>`;
            content += `<p style="margin: 0; color: #1b5e20; line-height: 1.6; font-size: 13px; font-style: italic;">${reasoning}</p>`;
            content += `</div>`;
        }

        console.log("reasoning:", reasoning, { locationData, result });

        // Detailed Score Breakdown
        content += `<div style="background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0; margin-bottom: 12px;">`;
        content += `<p style="margin: 0 0 12px 0; font-weight: bold; font-size: 14px; color: #333; border-bottom: 2px solid #1976d2; padding-bottom: 6px;">📈 Score Breakdown</p>`;
        
        // Demand
        const demandScore = result.demandScore || 0;
        const population = result.demandRaw || 0;
        content += `<div style="margin-bottom: 10px; padding: 8px; background: #fafafa; border-radius: 6px;">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #333;">🛒 Demand</span>`;
        content += `<span style="font-weight: bold; color: ${demandScore >= 20 ? '#4caf50' : demandScore >= 10 ? '#ff9800' : '#f44336'}; font-size: 16px;">${demandScore.toFixed(2)}</span>`;
        content += `</div>`;
        content += `<div style="font-size: 11px; color: #666; margin-top: 4px;">Population: ${population.toLocaleString()} residents</div>`;
        content += `</div>`;
        
        // POI/Competition
        const poiScore = result.poiScore || 0;
        const poiCount = result.poiRaw || 0;
        content += `<div style="margin-bottom: 10px; padding: 8px; background: #fafafa; border-radius: 6px;">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #333;">📍 Competition</span>`;
        content += `<span style="font-weight: bold; color: ${poiScore >= 20 ? '#2196f3' : poiScore >= 10 ? '#ff9800' : '#f44336'}; font-size: 16px;">${poiScore.toFixed(2)}</span>`;
        content += `</div>`;
        content += `<div style="font-size: 11px; color: #666; margin-top: 4px;">${poiCount} nearby businesses</div>`;
        content += `</div>`;
        
        // Risk
        const riskScore = result.riskScore || 0;
        const riskRaw = result.riskRaw || {};
        const floodAreaHa = riskRaw.floodAreaHa || 0;
        const landslideCount = riskRaw.landslideCount || 0;
        content += `<div style="margin-bottom: 10px; padding: 8px; background: #fafafa; border-radius: 6px;">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #333;">⚠️ Risk</span>`;
        content += `<span style="font-weight: bold; color: ${riskScore >= 20 ? '#4caf50' : riskScore >= 10 ? '#ff9800' : '#f44336'}; font-size: 16px;">${riskScore.toFixed(2)}</span>`;
        content += `</div>`;
        if (floodAreaHa === 0 && landslideCount === 0) {
            content += `<div style="font-size: 11px; color: #4caf50; margin-top: 4px;">✅ No hazards detected</div>`;
        } else {
            content += `<div style="font-size: 11px; color: #ff9800; margin-top: 4px;">`;
            if (floodAreaHa > 0) content += `⚠️ Flood zone: ${floodAreaHa.toFixed(2)}ha `;
            if (landslideCount > 0) content += `⚠️ ${landslideCount} landslide area(s)`;
            content += `</div>`;
        }
        content += `</div>`;
        
        // Accessibility
        const accessScore = result.accessibilityScore || 0;
        const accessRaw = result.accessibilityRaw || {};
        const distance = accessRaw.distanceMeters || 0;
        content += `<div style="margin-bottom: 10px; padding: 8px; background: #fafafa; border-radius: 6px;">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #333;">🚗 Accessibility</span>`;
        content += `<span style="font-weight: bold; color: ${accessScore >= 20 ? '#9c27b0' : accessScore >= 10 ? '#ff9800' : '#f44336'}; font-size: 16px;">${accessScore.toFixed(2)}</span>`;
        content += `</div>`;
        content += `<div style="font-size: 11px; color: #666; margin-top: 4px;">${distance.toFixed(0)}m from main road</div>`;
        content += `</div>`;
        
        // Zoning
        const zoningScore = result.zoningScore || 0;
        const zoningRaw = result.zoningRaw || {};
        const landuse = zoningRaw.landuse || 'N/A';
        content += `<div style="margin-bottom: 0; padding: 8px; background: #fafafa; border-radius: 6px;">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #333;">🏗️ Zoning</span>`;
        content += `<span style="font-weight: bold; color: ${zoningScore >= 20 ? '#795548' : zoningScore >= 10 ? '#ff9800' : '#f44336'}; font-size: 16px;">${zoningScore.toFixed(2)}</span>`;
        content += `</div>`;
        content += `<div style="font-size: 11px; color: #666; margin-top: 4px;">Land use: ${landuse}</div>`;
        content += `</div>`;
        
        content += `</div>`;

        // Map links
        if (result.centroid) {
            content += `<div style="display: flex; gap: 8px; margin-top: 12px;">`;
            content += `<a href="https://www.google.com/maps/search/?api=1&query=${result.centroid.lat},${result.centroid.lon}" target="_blank" style="flex: 1; text-decoration: none; padding: 10px; background: linear-gradient(135deg, #1976d2, #1565c0); color: white; border-radius: 6px; font-size: 12px; font-weight: 600; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🌍 Google Maps</a>`;
            content += `<a href="https://www.openstreetmap.org/?mlat=${result.centroid.lat}&mlon=${result.centroid.lon}#map=19/${result.centroid.lat}/${result.centroid.lon}" target="_blank" style="flex: 1; text-decoration: none; padding: 10px; background: linear-gradient(135deg, #4caf50, #45a049); color: white; border-radius: 6px; font-size: 12px; font-weight: 600; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🗺️ OpenStreetMap</a>`;
            content += `</div>`;
        }

        content += `</div>`;
        return content;
    };

    // NEW: Build popup content for hexagon
    const buildHexagonPopupContent = (result, rank) => {
        let content = `<div style="font-family: Arial, sans-serif; padding: 8px;">`;

        if (rank > 0) {
            content += `<div style="background: linear-gradient(135deg, #ffd700, #ffec8b); padding: 8px; border-radius: 8px; margin-bottom: 12px; text-align: center;">`;
            content += `<span style="font-size: 24px;">🏆</span>`;
            content += `<p style="margin: 4px 0 0 0; font-weight: bold; color: #333;">Recommended Location #${rank}</p>`;
            content += `</div>`;
        }

        content += `<p style="margin: 8px 0;"><b>📊 Total Score:</b> <span style="font-size: 18px; color: #1976d2; font-weight: bold;">${result.finalScore.toFixed(2)}</span></p>`;

        content += `<hr style="margin: 12px 0; border: none; border-top: 1px solid #ddd;">`;
        content += `<p style="margin: 8px 0 8px 0; font-weight: bold; font-size: 14px;">📈 Score Breakdown:</p>`;
        content += `<div style="margin-left: 8px; line-height: 1.8;">`;

        // Demand
        content += `<div style="margin-bottom: 6px;">`;
        content += `<span style="font-weight: bold;">🛒 Demand:</span> ${result.demandScore.toFixed(2)}`;
        content += `<span style="color: #666; font-size: 11px;"> (Pop: ${result.demandRaw || 0})</span>`;
        content += `</div>`;

        // POI
        content += `<div style="margin-bottom: 6px;">`;
        content += `<span style="font-weight: bold;">📍 POI:</span> ${result.poiScore.toFixed(2)}`;
        content += `<span style="color: #666; font-size: 11px;"> (${result.poiRaw || 0} nearby)</span>`;
        content += `</div>`;

        // Risk
        const riskRaw = result.riskRaw || {};
        content += `<div style="margin-bottom: 6px;">`;
        content += `<span style="font-weight: bold;">⚠️ Risk:</span> ${result.riskScore.toFixed(2)}`;
        if (riskRaw.floodAreaHa === 0 && riskRaw.landslideCount === 0) {
            content += `<span style="color: #4caf50; font-size: 11px;"> ✅ Safe</span>`;
        } else {
            content += `<span style="color: #ff9800; font-size: 11px;">`;
            if (riskRaw.floodAreaHa > 0) content += ` Flood: ${riskRaw.floodAreaHa.toFixed(2)}ha`;
            if (riskRaw.landslideCount > 0) content += ` Landslide: ${riskRaw.landslideCount}`;
            content += `</span>`;
        }
        content += `</div>`;

        // Accessibility
        const accessRaw = result.accessibilityRaw || {};
        content += `<div style="margin-bottom: 6px;">`;
        content += `<span style="font-weight: bold;">🚗 Accessibility:</span> ${result.accessibilityScore.toFixed(2)}`;
        content += `<span style="color: #666; font-size: 11px;"> (${(accessRaw.distanceMeters || 0).toFixed(0)}m to road)</span>`;
        content += `</div>`;

        // Zoning
        const zoningRaw = result.zoningRaw || {};
        content += `<div style="margin-bottom: 6px;">`;
        content += `<span style="font-weight: bold;">🏗️ Zoning:</span> ${result.zoningScore.toFixed(2)}`;
        if (zoningRaw.landuse) {
            content += `<span style="color: #666; font-size: 11px;"> (${zoningRaw.landuse})</span>`;
        }
        content += `</div>`;

        content += `</div>`;

        // Map links
        if (result.centroid) {
            content += `<hr style="margin: 12px 0; border: none; border-top: 1px solid #ddd;">`;
            content += `<div style="display: flex; gap: 10px; margin-top: 6px;">`;
            content += `<a href="https://www.google.com/maps/search/?api=1&query=${result.centroid.lat},${result.centroid.lon}" target="_blank" style="text-decoration: none; padding: 6px 12px; background-color: #1976d2; color: white; border-radius: 4px; font-size: 12px;">🌍 Google</a>`;
            content += `<a href="https://www.openstreetmap.org/?mlat=${result.centroid.lat}&mlon=${result.centroid.lon}#map=19/${result.centroid.lat}/${result.centroid.lon}" target="_blank" style="text-decoration: none; padding: 6px 12px; background-color: #4caf50; color: white; border-radius: 4px; font-size: 12px;">🗺️ OSM</a>`;
            content += `</div>`;
        }

        content += `</div>`;
        return content;
    };

    const normalizeLongitude = (point) => {
        const normalizedX = ((((point.longitude + 180) % 360) + 360) % 360) - 180;
        return new Point({ latitude: point.latitude, longitude: normalizedX, spatialReference: point.spatialReference });
    };

    const showPlaces = async (placePoint) => {
        const normalizedPoint = normalizeLongitude(placePoint);
        console.log("normalizedPoint: ", normalizedPoint);
        if (!bufferLayerRef.current || !placesLayerRef.current) return;

        try {
            const circleGeometry = new Circle({ center: normalizedPoint, geodesic: true, numberOfPoints: 100, radius: 500, radiusUnit: "meters" });

            const circleGraphic = new Graphic({
                geometry: circleGeometry,
                symbol: {
                    type: "simple-fill",
                    style: "solid",
                    color: [3, 140, 255, 0.1],
                    outline: { width: 1, color: [3, 140, 255] },
                },
            });

            bufferLayerRef.current.add(circleGraphic);

            const pointGraphic = new Graphic({
                geometry: normalizedPoint,
                symbol: {
                    type: "simple-marker",
                    color: [255, 0, 0],
                    size: 8,
                },
            });
            bufferLayerRef.current.add(pointGraphic);

            const queryParams = new PlacesQueryParameters({ categoryIds: [activeCategory], radius: 500, point: normalizedPoint, icon: "png" });
            const results = await places.queryPlacesNearPoint(queryParams);

            if (results.results && results.results.length > 0) {
                results.results.forEach(addResult);
                onPlacesFound && onPlacesFound(results.results);
            } else {
                onPlacesFound && onPlacesFound([]);
            }
        } catch (error) {
            console.error("Error in showPlaces:", error);
            onPlacesFound && onPlacesFound([]);
        }
    };

    const addResult = (place) => {
        if (!placesLayerRef.current) return;

        const symbol =
            place.icon && place.icon.url
                ? {
                      type: "picture-marker",
                      url: place.icon.url,
                      width: 20,
                      height: 20,
                  }
                : {
                      type: "simple-marker",
                      color: [0, 120, 255],
                      size: 10,
                  };

        const placeGraphic = new Graphic({
            geometry: place.location,
            symbol: symbol,
            attributes: {
                name: place.name,
                address:
                    place.addresses && place.addresses[0]
                        ? place.addresses[0].address
                        : "No address",
                category:
                    place.categories && place.categories[0]
                        ? place.categories[0].label
                        : "No category",
                distance: `${Number((place.distance / 1000).toFixed(1))} km`,
                placeId: place.placeId,
            },
            popupTemplate: {
                title: "{name}",
                content: "{category} - {distance}<br>{address}",
            },
        });

        placeGraphic.placeId = place.placeId;
        placesLayerRef.current.add(placeGraphic);

        if (view && !placesLayerRef.current._clickListenerAdded) {
            placesLayerRef.current._clickListenerAdded = true;
            view.on("click", placesLayerRef.current, (event) => {
                if (event.graphic && event.graphic.placeId) {
                    selectPlace(event.graphic.placeId);
                }
            });
        }
    };

    const selectPlace = async (placeId) => {
        if (!view) return;

        try {
            const placeGraphic = placesLayerRef.current.graphics.find(
                (g) => g.placeId === placeId
            );

            if (placeGraphic) {
                view.openPopup({
                    location: placeGraphic.geometry,
                    title: placeGraphic.attributes.name,
                    content: placeGraphic.attributes.address,
                });

                safeGoTo(placeGraphic);
                setSelectedPlaceId(placeId);

                const fetchParams = new FetchPlaceParameters({
                    placeId: placeId,
                    requestedFields: ["all"],
                });

                const result = await places.fetchPlace(fetchParams);

                if (onPlaceSelect && result.placeDetails) {
                    onPlaceSelect(result.placeDetails);
                }
            }
        } catch (error) {
            console.error("Error selecting place:", error);
        }
    };

    const handleSuitabilityRequest = async () => {
        try {
            const response = await axios.post(
                "http://localhost:3001/api/suitability",
                {
                    location: "Universiti Malaya",
                    category: "hospitals",
                    radius: 1000,
                }
            );

            const results = response.data;

            addSuitabilityMarkers(results);
        } catch (error) {
            console.error("Suitability API call failed:", error);
        }
    };

    const addSuitabilityMarkers = (data) => {
        if (!placesLayerRef.current) return;

        // Clear any existing markers
        placesLayerRef.current.removeAll();

        const referencePoint = data.referencePoint || data.reference_point;

        // Only add reference point marker (hexagons now handle recommended locations)
        if (referencePoint) {
            const refPoint = new Point({
                latitude: referencePoint.lat,
                longitude: referencePoint.lon,
            });

            const refMarker = new Graphic({
                geometry: refPoint,
                symbol: {
                    type: "simple-marker",
                    style: "cross",
                    color: [0, 120, 255],
                    size: 16,
                    outline: { color: [0, 80, 200], width: 4 },
                },
                popupTemplate: {
                    title: "📌 Reference Point",
                    content: `<div style="font-family: Arial, sans-serif;">
                        <p style="margin: 8px 0;"><b>Location:</b> ${referencePoint.name || "Reference Location"}</p>
                        <p style="margin: 8px 0;"><b>Coordinates:</b> ${referencePoint.lat.toFixed(6)}, ${referencePoint.lon.toFixed(6)}</p>
                    </div>`,
                },
            });

            placesLayerRef.current.add(refMarker);
        }

        // Hexagons will handle zooming, no need to zoom to markers
    };

    useEffect(() => {
        if (recommendedPlace) {
            addSuitabilityMarkers(recommendedPlace);
        }
        if (selectedPlaceId && view && placesLayerRef.current) {
            const placeGraphic = placesLayerRef.current.graphics.find(
                (g) => g.placeId === selectedPlaceId
            );

            console.log("placeGraphic: ", placeGraphic);

            if (placeGraphic) {
                view.openPopup({
                    location: placeGraphic.geometry,
                    title: placeGraphic.attributes.name,
                    content: placeGraphic.attributes.address,
                });

                safeGoTo(placeGraphic);
            }
        }
    }, [selectedPlaceId, view, recommendedPlace]);

    return (
        <>
            <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
        </>
    );
};

export default MapViewComponent;
