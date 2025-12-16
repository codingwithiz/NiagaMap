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

            mapView.on("click", (event) => {
                // Check if clicking on a hexagon - if so, don't clear graphics
                mapView.hitTest(event).then((response) => {
                    const hexGraphic = response.results.find((r) => r.graphic.layer === hexagonLayerRef.current)?.graphic;
                    if (hexGraphic) return;

                    setLastClickPoint(event.mapPoint);
                    clearGraphics();
                    showPlaces(event.mapPoint);
                });
            });

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

    // NEW: Effect to render workflow hexagons
    useEffect(() => {
        console.log("Workflow effect triggered:", {
            hasResults: workflowResults?.length > 0,
            hasView: !!view,
            hexagonLayer: !!hexagonLayerRef.current,
        });

        if (workflowResults && workflowResults.length > 0 && view) {
            console.log("Rendering hexagons:", workflowResults);
            renderWorkflowHexagons(workflowResults);
        }
    }, [workflowResults, view]);

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

        // Simple highlight for non-recommended hexagons
        const highlight = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [100, 149, 237, 0.3], // Cornflower blue
                outline: {
                    color: [100, 149, 237, 1],
                    width: 3,
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

        // Enhanced glow effect for recommended hexagons - Blue
        const outerGlow = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [30, 144, 255, 0.1],
                outline: { color: [30, 144, 255, 0.8], width: 6 },
            },
        });

        const middleGlow = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [30, 144, 255, 0.2],
                outline: { color: [30, 144, 255, 1], width: 4 },
            },
        });

        const innerHighlight = new Graphic({
            geometry: graphic.geometry.clone(),
            symbol: {
                type: "simple-fill",
                color: [30, 144, 255, 0.4],
                outline: { color: [255, 255, 255, 1], width: 2 },
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
    const renderWorkflowHexagons = (results) => {
        console.log("renderWorkflowHexagons called with:", results);
        
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
                            color: [80, 80, 80, 0.6],
                            width: 1,
                        },
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

                // Outer glow layer - Blue
                const outerGlow = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: [30, 144, 255, 0.15],  // Dodger blue
                        outline: {
                            color: [30, 144, 255, 0.4],
                            width: 8,
                        },
                    },
                });
                hexagonLayerRef.current.add(outerGlow);

                // Middle glow layer - Blue
                const middleGlow = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: [30, 144, 255, 0.25],
                        outline: {
                            color: [30, 144, 255, 0.7],
                            width: 5,
                        },
                    },
                });
                hexagonLayerRef.current.add(middleGlow);

                // Main hexagon - Blue
                const hexGraphic = new Graphic({
                    geometry: polygon,
                    symbol: {
                        type: "simple-fill",
                        color: [30, 144, 255, 0.5],  // Dodger blue with transparency
                        outline: {
                            color: [0, 100, 200, 1],  // Darker blue outline
                            width: 3,
                        },
                    },
                    attributes: {
                        hexId: hexagon.hex_id,
                        hexIndex: hexagon.hex_index,
                        analysisId: hexagon.analysis_id,
                        isRecommended: true,
                        rank: rank,
                        score: result.finalScore,
                        title: `🏆 Rank #${rank} Location`,
                    },
                });
                hexagonLayerRef.current.add(hexGraphic);

                // Add rank label
                if (result.centroid) {
                            const labelPoint = new Point({ longitude: result.centroid.lon, latitude: result.centroid.lat, spatialReference: { wkid: 4326 } });

                    // Background circle for label - Blue
                    const labelBg = new Graphic({
                        geometry: labelPoint,
                        symbol: {
                            type: "simple-marker",
                            color: [30, 144, 255, 1],  // Dodger blue
                            size: 28,
                            outline: {
                                color: [255, 255, 255, 1],
                                width: 2,
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
                            haloColor: [0, 0, 0, 0.8],
                            haloSize: 1,
                            font: {
                                size: 12,
                                weight: "bold",
                                family: "Arial",
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
            return [30, 144, 255, 0.5]; // Dodger blue for recommended
        }

        // Gradient from red (low score) to yellow (medium) to green (high score)
        let r, g, b;
        
        if (normalizedScore < 0.5) {
            // Red to Yellow (0 to 0.5)
            const t = normalizedScore * 2; // 0 to 1
            r = 255;
            g = Math.round(200 * t);
            b = 50;
        } else {
            // Yellow to Green (0.5 to 1)
            const t = (normalizedScore - 0.5) * 2; // 0 to 1
            r = Math.round(255 * (1 - t));
            g = Math.round(200 + 55 * t);
            b = 50;
        }

        const opacity = 0.35 + normalizedScore * 0.25; // 0.35 to 0.6

        return [r, g, b, opacity];
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

        placesLayerRef.current.removeAll();

        const locations = Array.isArray(data)
            ? data
            : (data.locations || data.recommended_locations || []);

        const referencePoint = data.referencePoint || data.reference_point;

        console.log("Adding suitability markers:", { locations, referencePoint });

        locations.forEach((location, index) => {
            const point = new Point({
                latitude: location.lat,
                longitude: location.lon,
            });

            let breakdown = location.breakdown;
            if (typeof breakdown === 'string') {
                try {
                    breakdown = JSON.parse(breakdown);
                } catch (e) {
                    console.error("Failed to parse breakdown:", e);
                    breakdown = null;
                }
            }

            console.log(`Location ${index + 1} breakdown:`, breakdown);
            console.log(`Location ${index + 1} reasoning:`, location.reason);

            let content = `<div style="font-family: Arial, sans-serif; padding: 8px;">`;
            content += `<p style="margin: 8px 0;"><b>📊 Total Score:</b> <span style="font-size: 18px; color: #1976d2; font-weight: bold;">${location.score.toFixed(2)}</span></p>`;

            if (location.reason) {
                content += `<div style="background-color: #e3f2fd; padding: 12px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #1976d2;">`;
                content += `<p style="margin: 0; color: #333; line-height: 1.6; font-size: 13px; font-style: italic;">${location.reason}</p>`;
                content += `</div>`;
            }

            if (breakdown) {
                content += `<hr style="margin: 12px 0; border: none; border-top: 1px solid #ddd;">`;
                content += `<p style="margin: 8px 0 8px 0; font-weight: bold; font-size: 14px;">📈 Detailed Score Breakdown:</p>`;
                content += `<div style="margin-left: 8px; line-height: 2;">`;
                
                const demandScore = breakdown.demand?.score || 0;
                const population = breakdown.demand?.population || 0;
                content += `<div style="margin-bottom: 8px;">`;
                content += `<div style="font-weight: bold;">🛒 Demand: <span style="color: ${demandScore >= 15 ? '#4caf50' : '#ff9800'};">${demandScore.toFixed(2)}</span></div>`;
                content += `<div style="font-size: 11px; color: #666; margin-left: 20px;">Population: ${population} residents</div>`;
                content += `</div>`;
                
                const poiScore = breakdown.poi?.score || 0;
                const poiCount = breakdown.poi?.count || 0;
                content += `<div style="margin-bottom: 8px;">`;
                content += `<div style="font-weight: bold;">📍 POI: <span style="color: ${poiScore >= 15 ? '#2196f3' : '#ff9800'};">${poiScore.toFixed(2)}</span></div>`;
                content += `<div style="font-size: 11px; color: #666; margin-left: 20px;">${poiCount} nearby businesses</div>`;
                content += `</div>`;
                
                const riskScore = breakdown.risk?.score || 0;
                const floodAreaHa = breakdown.risk?.floodAreaHa || 0;
                const landslideCount = breakdown.risk?.landslideCount || 0;
                
                content += `<div style="margin-bottom: 8px;">`;
                content += `<div style="font-weight: bold;">⚠️ Risk: <span style="color: ${riskScore >= 15 ? '#4caf50' : '#ff9800'};">${riskScore.toFixed(2)}</span></div>`;
                content += `<div style="font-size: 11px; color: #666; margin-left: 20px;">`;
                
                if (floodAreaHa === 0 && landslideCount === 0) {
                    content += `✅ Excellent safety - No hazards detected`;
                } else {
                    if (floodAreaHa > 0) {
                        content += `• Flood zone: ${floodAreaHa.toFixed(2)} hectares<br>`;
                    }
                    if (landslideCount > 0) {
                        content += `• Landslide areas: ${landslideCount}`;
                    }
                }
                
                content += `</div>`;
                content += `</div>`;
                
                const accessScore = breakdown.accessibility?.score || 0;
                const distance = breakdown.accessibility?.distanceMeters || 0;
                content += `<div style="margin-bottom: 8px;">`;
                content += `<div style="font-weight: bold;">🚗 Accessibility: <span style="color: ${accessScore >= 15 ? '#9c27b0' : '#ff9800'};">${accessScore.toFixed(2)}</span></div>`;
                content += `<div style="font-size: 11px; color: #666; margin-left: 20px;">${distance.toFixed(0)}m from main road</div>`;
                content += `</div>`;
                
                const zoningScore = breakdown.zoning?.score || 0;
                const landuse = breakdown.zoning?.landuse || 'N/A';
                content += `<div style="margin-bottom: 8px;">`;
                content += `<div style="font-weight: bold;">🏗️ Zoning: <span style="color: ${zoningScore >= 15 ? '#795548' : '#ff9800'};">${zoningScore.toFixed(2)}</span></div>`;
                content += `<div style="font-size: 11px; color: #666; margin-left: 20px;">Land use: ${landuse}</div>`;
                content += `</div>`;
                
                content += `</div>`;
            }

            content += `<hr style="margin: 12px 0; border: none; border-top: 1px solid #ddd;">`;
            content += `<p style="margin: 8px 0 4px 0; font-weight: bold;">🗺️ View on Map:</p>`;
            content += `<div style="display: flex; gap: 10px; margin-top: 6px;">`;
            content += `<a href="https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lon}" target="_blank" style="text-decoration: none; padding: 6px 12px; background-color: #1976d2; color: white; border-radius: 4px; font-size: 12px;">🌍 Google</a>`;
            content += `<a href="https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lon}#map=19/${location.lat}/${location.lon}" target="_blank" style="text-decoration: none; padding: 6px 12px; background-color: #4caf50; color: white; border-radius: 4px; font-size: 12px;">🗺️ OSM</a>`;
            content += `</div>`;
            content += `</div>`;

            const marker = new Graphic({
                geometry: point,
                symbol: {
                    type: "picture-marker",
                    url: "/recommended-location.svg",
                    width: "48px",
                    height: "48px",
                },
                popupTemplate: {
                    title: `📍 Location #${index + 1}`,
                    content: content,
                },
            });

            placesLayerRef.current.add(marker);
        });

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

        if (locations.length > 0 && view) {
            const targetPoints = locations.map(
                (loc) => new Point({ latitude: loc.lat, longitude: loc.lon })
            );
            
            if (referencePoint) {
                targetPoints.push(new Point({ 
                    latitude: referencePoint.lat, 
                    longitude: referencePoint.lon 
                }));
            }
            
            safeGoTo(targetPoints, { 
                duration: 1000,
                easing: "ease-in-out"
            });
        }
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
