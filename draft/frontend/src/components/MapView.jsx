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

        // Enhanced highlight with NiagaMap purple theme
        const highlight = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [139, 92, 246, 0.35], // Purple highlight
                outline: {
                    color: [139, 92, 246, 1],
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
            alignment: "top-center",
        });
    };

    // NEW: Handle recommended hexagon hover (highlight only, no popup)
    const handleRecommendedHexagonHover = (graphic) => {
        if (!highlightLayerRef.current || !view) return;

        const hexId = graphic.attributes?.hexId;
        if (hexId === hoveredHexId) return;

        setHoveredHexId(hexId);
        highlightLayerRef.current.removeAll();

        // Enhanced glow effect with NiagaMap purple-blue theme
        const outerGlow = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [139, 92, 246, 0.15],
                outline: { color: [139, 92, 246, 0.85], width: 8 },
            },
        });

        const middleGlow = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [99, 102, 241, 0.3],
                outline: { color: [99, 102, 241, 1], width: 5 },
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

                // Enhanced glow effect with NiagaMap purple-blue gradient
                // Outer glow layer - Soft purple aura
                const outerGlow = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: [139, 92, 246, 0.12],  // Light purple
                        outline: {
                            color: [139, 92, 246, 0.35],
                            width: 10,
                        },
                    },
                });
                hexagonLayerRef.current.add(outerGlow);

                // Middle glow layer - Medium intensity purple-blue
                const middleGlow = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: [99, 102, 241, 0.3],
                        outline: {
                            color: [99, 102, 241, 0.75],
                            width: 6,
                        },
                    },
                });
                hexagonLayerRef.current.add(middleGlow);

                // Main hexagon - Vibrant gradient purple-blue with crisp border
                // Build enhanced popup content with AI reasoning for recommended hexagons
                // Match location data by coordinates instead of array index
                const matchedLocation = findMatchingLocation(result.centroid);
                const popupContent = buildRecommendedHexagonPopup(result, rank, matchedLocation);
                
                const hexGraphic = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: [99, 102, 241, 0.7],  // Indigo for better visibility
                        outline: {
                            color: [79, 70, 229, 1],  // Rich indigo outline
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

                // Add rank label with NiagaMap styled badge
                if (result.centroid) {
                    const labelPoint = new Point({ longitude: result.centroid.lon, latitude: result.centroid.lat, spatialReference: { wkid: 4326 } });

                    // Shadow/glow effect for badge
                    const shadowCircle = new Graphic({
                        geometry: labelPoint,
                        symbol: {
                            type: "simple-marker",
                            color: [139, 92, 246, 0.3],
                            size: 36,
                            outline: { color: [0, 0, 0, 0], width: 0 },
                        },
                    });
                    hexagonLayerRef.current.add(shadowCircle);

                    // Background circle for label - Purple gradient effect
                    const labelBg = new Graphic({
                        geometry: labelPoint,
                        symbol: {
                            type: "simple-marker",
                            color: [99, 102, 241, 1],  // Rich indigo
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
                            haloColor: [79, 70, 229, 0.9],
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

    // NEW: Get color based on score (NiagaMap gradient: purple to blue)
    const getScoreColor = (normalizedScore, isRecommended) => {
        if (isRecommended) {
            return [139, 92, 246, 0.75]; // Vibrant purple for recommended
        }

        // NiagaMap gradient: low scores → muted lavender, high scores → vibrant blue
        let r, g, b;
        
        if (normalizedScore < 0.33) {
            // Soft pink-lavender (low scores)
            const t = normalizedScore * 3; // 0 to 1
            r = Math.round(200 - 40 * t); // 200 to 160
            g = Math.round(150 + 20 * t); // 150 to 170
            b = Math.round(220 + 20 * t); // 220 to 240
        } else if (normalizedScore < 0.67) {
            // Lavender to purple (mid scores)
            const t = (normalizedScore - 0.33) * 3; // 0 to 1
            r = Math.round(160 - 21 * t); // 160 to 139
            g = Math.round(170 - 78 * t); // 170 to 92
            b = Math.round(240 + 6 * t); // 240 to 246
        } else {
            // Purple to bright blue (high scores)
            const t = (normalizedScore - 0.67) * 3; // 0 to 1
            r = Math.round(139 - 80 * t); // 139 to 59
            g = Math.round(92 + 38 * t); // 92 to 130
            b = Math.round(246 + 0 * t); // stays at 246
        }

        const opacity = 0.4 + normalizedScore * 0.35; // 0.4 to 0.75 (better visibility)

        return [r, g, b, opacity];
    };

    // NEW: Build enhanced popup content for recommended hexagons with AI reasoning
    const buildRecommendedHexagonPopup = (result, rank, locationData) => {
        let content = `<div style="font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif; padding: 20px; max-width: 520px; background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%); border-radius: 16px; box-shadow: 0 8px 32px rgba(139, 92, 246, 0.2);">`;
        
        // Rank badge with NiagaMap gradient
        content += `<div style="background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%); padding: 14px; border-radius: 14px; margin-bottom: 18px; text-align: center; box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4); border: 2px solid rgba(255, 255, 255, 0.2);">`;
        content += `<span style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">🏆</span>`;
        content += `<p style="margin: 8px 0 0 0; font-weight: 700; color: #fff; font-size: 17px; letter-spacing: 0.3px;">Recommended Location #${rank}</p>`;
        content += `</div>`;

        // Total Score with gradient
        content += `<div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%); padding: 16px; border-radius: 12px; margin-bottom: 14px; border: 2px solid rgba(139, 92, 246, 0.2);">`;
        content += `<p style="margin: 0; text-align: center;"><b style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">📊 Total Score</b></p>`;
        content += `<p style="margin: 8px 0 0 0; text-align: center; font-size: 36px; background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 800;">${result.finalScore.toFixed(2)}</p>`;
        content += `</div>`;

        // AI Reasoning (if available)
        const reasoning =
            (locationData && (locationData.ai_reason || locationData.reason)) ||
            result?.ai_reason ||
            result?.reason;

        if (reasoning) {
            content += `<div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%); padding: 16px; border-radius: 12px; margin-bottom: 18px; border-left: 4px solid #8B5CF6; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.15);">`;
            content += `<p style="margin: 0 0 8px 0; font-weight: 700; color: #8B5CF6; font-size: 14px; display: flex; align-items: center; gap: 6px;"><span>💡</span><span>AI Analysis</span></p>`;
            content += `<p style="margin: 0; color: #475569; line-height: 1.7; font-size: 13px; font-style: italic;">${reasoning}</p>`;
            content += `</div>`;
        }

        console.log("reasoning:", reasoning, { locationData, result });

        // Detailed Score Breakdown with glassmorphism
        content += `<div style="background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(10px); padding: 14px; border-radius: 12px; border: 2px solid rgba(139, 92, 246, 0.15); margin-bottom: 14px; box-shadow: 0 2px 12px rgba(139, 92, 246, 0.1);">`;
        content += `<p style="margin: 0 0 14px 0; font-weight: 700; font-size: 15px; color: #1e293b; background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; padding-bottom: 8px; border-bottom: 2px solid rgba(139, 92, 246, 0.2);">📈 Score Breakdown</p>`;
        
        // Demand with modern styling
        const demandScore = result.demandScore || 0;
        const population = result.demandRaw || 0;
        content += `<div style="margin-bottom: 10px; padding: 10px; background: rgba(249, 250, 251, 0.8); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.1); transition: all 0.2s;">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #1e293b; font-size: 13px;">🛒 Demand</span>`;
        content += `<span style="font-weight: 700; color: ${demandScore >= 20 ? '#10b981' : demandScore >= 10 ? '#f59e0b' : '#ef4444'}; font-size: 17px;">${demandScore.toFixed(2)}</span>`;
        content += `</div>`;
        content += `<div style="font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 500;">Population: ${population.toLocaleString()} residents</div>`;
        content += `</div>`;
        
        // POI/Competition
        const poiScore = result.poiScore || 0;
        const poiCount = result.poiRaw || 0;
        content += `<div style="margin-bottom: 10px; padding: 10px; background: rgba(249, 250, 251, 0.8); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.1);">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #1e293b; font-size: 13px;">📍 Competition</span>`;
        content += `<span style="font-weight: 700; color: ${poiScore >= 20 ? '#3B82F6' : poiScore >= 10 ? '#f59e0b' : '#ef4444'}; font-size: 17px;">${poiScore.toFixed(2)}</span>`;
        content += `</div>`;
        content += `<div style="font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 500;">${poiCount} nearby businesses</div>`;
        content += `</div>`;
        
        // Risk
        const riskScore = result.riskScore || 0;
        const riskRaw = result.riskRaw || {};
        const floodAreaHa = riskRaw.floodAreaHa || 0;
        const landslideCount = riskRaw.landslideCount || 0;
        content += `<div style="margin-bottom: 10px; padding: 10px; background: rgba(249, 250, 251, 0.8); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.1);">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #1e293b; font-size: 13px;">⚠️ Risk</span>`;
        content += `<span style="font-weight: 700; color: ${riskScore >= 20 ? '#10b981' : riskScore >= 10 ? '#f59e0b' : '#ef4444'}; font-size: 17px;">${riskScore.toFixed(2)}</span>`;
        content += `</div>`;
        if (floodAreaHa === 0 && landslideCount === 0) {
            content += `<div style="font-size: 11px; color: #10b981; margin-top: 5px; font-weight: 600;">✅ No hazards detected</div>`;
        } else {
            content += `<div style="font-size: 11px; color: #f59e0b; margin-top: 5px; font-weight: 500;">`;
            if (floodAreaHa > 0) content += `⚠️ Flood zone: ${floodAreaHa.toFixed(2)}ha `;
            if (landslideCount > 0) content += `⚠️ ${landslideCount} landslide area(s)`;
            content += `</div>`;
        }
        content += `</div>`;
        
        // Accessibility
        const accessScore = result.accessibilityScore || 0;
        const accessRaw = result.accessibilityRaw || {};
        const distance = accessRaw.distanceMeters || 0;
        content += `<div style="margin-bottom: 10px; padding: 10px; background: rgba(249, 250, 251, 0.8); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.1);">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #1e293b; font-size: 13px;">🚗 Accessibility</span>`;
        content += `<span style="font-weight: 700; color: ${accessScore >= 20 ? '#8B5CF6' : accessScore >= 10 ? '#f59e0b' : '#ef4444'}; font-size: 17px;">${accessScore.toFixed(2)}</span>`;
        content += `</div>`;
        content += `<div style="font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 500;">${distance.toFixed(0)}m from main road</div>`;
        content += `</div>`;
        
        // Zoning
        const zoningScore = result.zoningScore || 0;
        const zoningRaw = result.zoningRaw || {};
        const landuse = zoningRaw.landuse || 'N/A';
        content += `<div style="margin-bottom: 0; padding: 10px; background: rgba(249, 250, 251, 0.8); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.1);">`;
        content += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; color: #1e293b; font-size: 13px;">🏗️ Zoning</span>`;
        content += `<span style="font-weight: 700; color: ${zoningScore >= 20 ? '#6366f1' : zoningScore >= 10 ? '#f59e0b' : '#ef4444'}; font-size: 17px;">${zoningScore.toFixed(2)}</span>`;
        content += `</div>`;
        content += `<div style="font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 500;">Land use: ${landuse}</div>`;
        content += `</div>`;
        
        content += `</div>`;

        // Map links with NiagaMap gradient
        if (result.centroid) {
            content += `<div style="display: flex; gap: 10px; margin-top: 16px;">`;
            content += `<a href="https://www.google.com/maps/search/?api=1&query=${result.centroid.lat},${result.centroid.lon}" target="_blank" style="flex: 1; text-decoration: none; padding: 11px 14px; background: linear-gradient(135deg, #8B5CF6 0%, #6366f1 100%); color: white; border-radius: 10px; font-size: 13px; font-weight: 600; text-align: center; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); transition: all 0.2s;">🌍 Google Maps</a>`;
            content += `<a href="https://www.openstreetmap.org/?mlat=${result.centroid.lat}&mlon=${result.centroid.lon}#map=19/${result.centroid.lat}/${result.centroid.lon}" target="_blank" style="flex: 1; text-decoration: none; padding: 11px 14px; background: linear-gradient(135deg, #3B82F6 0%, #2563eb 100%); color: white; border-radius: 10px; font-size: 13px; font-weight: 600; text-align: center; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.2s;">🗺️ OpenStreetMap</a>`;
            content += `</div>`;
        }

        content += `</div>`;
        return content;
    };

    // NEW: Build popup content for hexagon (non-recommended with NiagaMap theme)
    const buildHexagonPopupContent = (result, rank) => {
        let content = `<div style="font-family: 'Segoe UI', 'Inter', system-ui, sans-serif; padding: 18px; background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.92) 100%); border-radius: 14px; box-shadow: 0 4px 24px rgba(139, 92, 246, 0.15); max-width: 480px;">`;

        if (rank > 0) {
            content += `<div style="background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 10px; border-radius: 10px; margin-bottom: 14px; text-align: center; box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);">`;
            content += `<span style="font-size: 26px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));">🏆</span>`;
            content += `<p style="margin: 5px 0 0 0; font-weight: 700; color: #fff; font-size: 15px;">Recommended Location #${rank}</p>`;
            content += `</div>`;
        }

        content += `<div style="text-align: center; margin: 12px 0; padding: 10px; background: rgba(139, 92, 246, 0.06); border-radius: 10px; border: 1px solid rgba(139, 92, 246, 0.15);">`;
        content += `<p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📊 Total Score</p>`;
        content += `<p style="margin: 0; font-size: 28px; background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 800;">${result.finalScore.toFixed(2)}</p>`;
        content += `</div>`;

        content += `<div style="height: 2px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent); margin: 14px 0;">`;
        content += `<p style="margin: 12px 0 10px 0; font-weight: 700; font-size: 14px; color: #1e293b;">📈 Score Breakdown</p>`;
        content += `<div style="display: flex; flex-direction: column; gap: 8px;">`;

        // Demand
        content += `<div style="padding: 8px 10px; background: rgba(249, 250, 251, 0.7); border-radius: 8px; border-left: 3px solid #8B5CF6; display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; font-size: 12px; color: #1e293b;">🛒 Demand <span style="color: #94a3b8; font-size: 10px; font-weight: 500;">(Pop: ${result.demandRaw || 0})</span></span>`;
        content += `<span style="font-weight: 700; font-size: 15px; color: ${result.demandScore >= 20 ? '#10b981' : result.demandScore >= 10 ? '#f59e0b' : '#ef4444'};">${result.demandScore.toFixed(2)}</span>`;
        content += `</div>`;

        // POI
        content += `<div style="padding: 8px 10px; background: rgba(249, 250, 251, 0.7); border-radius: 8px; border-left: 3px solid #3B82F6; display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; font-size: 12px; color: #1e293b;">📍 Competition <span style="color: #94a3b8; font-size: 10px; font-weight: 500;">(${result.poiRaw || 0} nearby)</span></span>`;
        content += `<span style="font-weight: 700; font-size: 15px; color: ${result.poiScore >= 20 ? '#3B82F6' : result.poiScore >= 10 ? '#f59e0b' : '#ef4444'};">${result.poiScore.toFixed(2)}</span>`;
        content += `</div>`;

        // Risk
        const riskRaw = result.riskRaw || {};
        content += `<div style="padding: 8px 10px; background: rgba(249, 250, 251, 0.7); border-radius: 8px; border-left: 3px solid ${riskRaw.floodAreaHa === 0 && riskRaw.landslideCount === 0 ? '#10b981' : '#f59e0b'}; display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; font-size: 12px; color: #1e293b;">⚠️ Risk`;
        if (riskRaw.floodAreaHa === 0 && riskRaw.landslideCount === 0) {
            content += ` <span style="color: #10b981; font-size: 10px; font-weight: 600;">✅ Safe</span>`;
        } else {
            content += ` <span style="color: #f59e0b; font-size: 10px; font-weight: 500;">`;
            if (riskRaw.floodAreaHa > 0) content += `Flood: ${riskRaw.floodAreaHa.toFixed(1)}ha `;
            if (riskRaw.landslideCount > 0) content += `Landslide: ${riskRaw.landslideCount}`;
            content += `</span>`;
        }
        content += `</span>`;
        content += `<span style="font-weight: 700; font-size: 15px; color: ${result.riskScore >= 20 ? '#10b981' : result.riskScore >= 10 ? '#f59e0b' : '#ef4444'};">${result.riskScore.toFixed(2)}</span>`;
        content += `</div>`;

        // Accessibility
        const accessRaw = result.accessibilityRaw || {};
        content += `<div style="padding: 8px 10px; background: rgba(249, 250, 251, 0.7); border-radius: 8px; border-left: 3px solid #6366f1; display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; font-size: 12px; color: #1e293b;">🚗 Access <span style="color: #94a3b8; font-size: 10px; font-weight: 500;">(${(accessRaw.distanceMeters || 0).toFixed(0)}m)</span></span>`;
        content += `<span style="font-weight: 700; font-size: 15px; color: ${result.accessibilityScore >= 20 ? '#8B5CF6' : result.accessibilityScore >= 10 ? '#f59e0b' : '#ef4444'};">${result.accessibilityScore.toFixed(2)}</span>`;
        content += `</div>`;

        // Zoning
        const zoningRaw = result.zoningRaw || {};
        content += `<div style="padding: 8px 10px; background: rgba(249, 250, 251, 0.7); border-radius: 8px; border-left: 3px solid #a855f7; display: flex; justify-content: space-between; align-items: center;">`;
        content += `<span style="font-weight: 600; font-size: 12px; color: #1e293b;">🏗️ Zoning`;
        if (zoningRaw.landuse) {
            content += ` <span style="color: #94a3b8; font-size: 10px; font-weight: 500;">(${zoningRaw.landuse})</span>`;
        }
        content += `</span>`;
        content += `<span style="font-weight: 700; font-size: 15px; color: ${result.zoningScore >= 20 ? '#6366f1' : result.zoningScore >= 10 ? '#f59e0b' : '#ef4444'};">${result.zoningScore.toFixed(2)}</span>`;
        content += `</div>`;

        content += `</div>`;

        // Map links with gradient
        if (result.centroid) {
            content += `<div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.2), transparent); margin: 14px 0;">`;
            content += `<div style="display: flex; gap: 8px; margin-top: 12px;">`;
            content += `<a href="https://www.google.com/maps/search/?api=1&query=${result.centroid.lat},${result.centroid.lon}" target="_blank" style="flex: 1; text-decoration: none; padding: 9px 12px; background: linear-gradient(135deg, #8B5CF6, #6366f1); color: white; border-radius: 8px; font-size: 12px; font-weight: 600; text-align: center; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);">🌍 Google</a>`;
            content += `<a href="https://www.openstreetmap.org/?mlat=${result.centroid.lat}&mlon=${result.centroid.lon}#map=19/${result.centroid.lat}/${result.centroid.lon}" target="_blank" style="flex: 1; text-decoration: none; padding: 9px 12px; background: linear-gradient(135deg, #3B82F6, #2563eb); color: white; border-radius: 8px; font-size: 12px; font-weight: 600; text-align: center; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);">🗺️ OSM</a>`;
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
