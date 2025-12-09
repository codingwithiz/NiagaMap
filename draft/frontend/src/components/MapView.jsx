import React, { useEffect, useRef, useState } from "react";
import "@esri/calcite-components/dist/calcite/calcite.css";
import { defineCustomElements } from "@esri/calcite-components/dist/loader";
import Locate from "@arcgis/core/widgets/Locate";
import MapView from "@arcgis/core/views/MapView";
import Map from "@arcgis/core/Map";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import { loadModules } from "esri-loader";
import axios from "axios";

const MapViewComponent = ({
    activeCategory = "4d4b7105d754a06377d81259",
    onPlacesFound,
    recommendedPlace,
    onPlaceSelect,
    apiKey,
    darkMode = false,
}) => {
    const mapRef = useRef(null);
    const bufferLayerRef = useRef(null);
    const placesLayerRef = useRef(null);

    const [view, setView] = useState(null);
    const [esriModules, setEsriModules] = useState(null);
    const [initialized, setInitialized] = useState(false);
    const [lastClickPoint, setLastClickPoint] = useState(null);
    const [selectedPlaceId, setSelectedPlaceId] = useState(null);

    useEffect(() => {
        defineCustomElements(window);

        let mapView = null;

        loadModules(
            [
                "esri/config",
                "esri/Map",
                "esri/views/MapView",
                "esri/rest/places",
                "esri/rest/support/FetchPlaceParameters",
                "esri/rest/support/PlacesQueryParameters",
                "esri/geometry/Circle",
                "esri/geometry/Point",
                "esri/Graphic",
                "esri/layers/GraphicsLayer",
                "esri/widgets/BasemapGallery",
                "esri/widgets/Expand",
                "esri/widgets/Search",
                "esri/widgets/Legend",
            ],
            { version: "4.32", css: true }
        )
            .then(
                ([
                    esriConfig,
                    Map,
                    MapView,
                    places,
                    FetchPlaceParameters,
                    PlacesQueryParameters,
                    Circle,
                    Point,
                    Graphic,
                    GraphicsLayer,
                    BasemapGallery,
                    Expand,
                    Search,
                    Legend,
                ]) => {
                    esriConfig.apiKey = apiKey;

                    setEsriModules({
                        Map,
                        MapView,
                        places,
                        FetchPlaceParameters,
                        PlacesQueryParameters,
                        Circle,
                        Point,
                        Graphic,
                        GraphicsLayer,
                        BasemapGallery,
                        Expand,
                        Search,
                        esriConfig,
                        Legend,
                    });

                    const bufferLayer = new GraphicsLayer({
                        id: "bufferLayer",
                    });
                    const placesLayer = new GraphicsLayer({
                        id: "placesLayer",
                    });

                    bufferLayerRef.current = bufferLayer;
                    placesLayerRef.current = placesLayer;

                    const map = new Map({
                        basemap: darkMode
                            ? "dark-gray-vector"
                            : "streets-vector", // default basemap
                        layers: [bufferLayer, placesLayer],
                    });

                    mapView = new MapView({
                        container: mapRef.current,
                        map: map,
                        center: [-118.46651, 33.98621],
                        zoom: 13,
                    });

                    mapView.when(() => {
                        setView(mapView);

                        const searchWidget = new Search({
                            view: mapView,
                            resultGraphicEnabled: true,
                            popupEnabled: true,
                        });

                        const basemapGallery = new BasemapGallery({
                            view: mapView,
                            source: {
                                portal: {
                                    url: "https://www.arcgis.com",
                                    useVectorBasemaps: true,
                                },
                            },
                        });

                        const expandGallery = new Expand({
                            view: mapView,
                            content: basemapGallery,
                        });

                        const legend = new Legend({
                            view: mapView,
                            layerInfos: [
                                {
                                    layer: placesLayer,
                                    title: "Locations",
                                },
                            ],
                        });

                        // const locateWidget = new Locate({
                        //     viewModel: {
                        //         // autocasts as new LocateViewModel()
                        //         view: view, // assigns the locate widget to a view
                        //         graphic: new Graphic({
                        //             symbol: { type: "simple-marker" }, // overwrites the default symbol used for the
                        //             // graphic placed at the location of the user when found
                        //         }),
                        //     },
                        // });

                        // locateWidget.on("locate-error", (err) => {
                        //     console.log("Locate error:", err);
                        //     alert(
                        //         "Could not determine your location. Try again later."
                        //     );
                        // });

                        mapView.ui.add(searchWidget, "top-left");
                        // mapView.ui.add(locateWidget, "top-left");
                        mapView.ui.add(expandGallery, "top-right");
                        // mapView.ui.add(legend, "bottom-left");

                        mapView.on("click", (event) => {
                            setLastClickPoint(event.mapPoint);
                            clearGraphics();
                            showPlaces(event.mapPoint);
                        });

                        mapView.on("pointer-move", (event) => {
                            mapView.hitTest(event).then((response) => {
                                const graphic = response.results.find(
                                    (r) => r.graphic.layer === placesLayer
                                )?.graphic;

                                if (graphic && graphic.popupTemplate) {
                                    mapView.openPopup({
                                        location: graphic.geometry,
                                        title: graphic.popupTemplate.title,
                                        content: graphic.popupTemplate.content,
                                    });
                                }
                            });
                        });
                    });
                }
            )
            .catch((err) => {
                console.error("Error loading ArcGIS modules:", err);
            });

        return () => {
            if (mapView) {
                mapView.destroy();
            }
        };
    }, [apiKey, darkMode]);

    useEffect(() => {
        if (view && initialized && lastClickPoint) {
            clearGraphics();
            showPlaces(lastClickPoint);
        }
    }, [activeCategory, initialized, lastClickPoint]);

    const clearGraphics = () => {
        if (!bufferLayerRef.current || !placesLayerRef.current) return;

        bufferLayerRef.current.removeAll();
        placesLayerRef.current.removeAll();
    };

    const normalizeLongitude = (point) => {
        if (!esriModules || !esriModules.Point) {
            console.warn("esriModules.Point is not loaded yet");
            return point;
        }

        const normalizedX =
            ((((point.longitude + 180) % 360) + 360) % 360) - 180;

        return new esriModules.Point({
            latitude: point.latitude,
            longitude: normalizedX,
            spatialReference: point.spatialReference,
        });
    };

    const showPlaces = async (placePoint) => {
        const normalizedPoint = normalizeLongitude(placePoint);
        console.log("normalizedPoint: ", normalizedPoint);
        if (!esriModules || !bufferLayerRef.current || !placesLayerRef.current)
            return;

        const { Circle, Graphic, places, PlacesQueryParameters } = esriModules;

        try {
            const circleGeometry = new Circle({
                center: normalizedPoint,
                geodesic: true,
                numberOfPoints: 100,
                radius: 500,
                radiusUnit: "meters",
            });

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

            const queryParams = new PlacesQueryParameters({
                categoryIds: [activeCategory],
                radius: 500,
                point: normalizedPoint,
                icon: "png",
            });

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
        if (!esriModules || !placesLayerRef.current) return;

        const { Graphic } = esriModules;

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

        // Add click event listener on placesLayer only once
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
        if (!esriModules || !view) return;

        const { FetchPlaceParameters, places } = esriModules;

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

                view.goTo(placeGraphic);
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
                    location: "Universiti Malaya", // or lastClickPoint if geocoded
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

    const addSuitabilityMarkers = (locations) => {
        if (!esriModules || !placesLayerRef.current) return;

        const { Graphic, Point } = esriModules;
        placesLayerRef.current.removeAll();

        // Handle both array and object structures
        const locationsArray = Array.isArray(locations)
            ? locations
            : locations.recommended_locations || [];

        locationsArray.forEach(({ lat, lon, score, breakdown }) => {
            const point = new Point({ latitude: lat, longitude: lon });

            // Build content string without nested template literals
            let content = `<b>Score:</b> ${score.toFixed(2)}<br>`;
            
            if (breakdown) {
                content += `<b>Breakdown:</b><br>`;
                content += `- Risk: ${breakdown.risk.toFixed(2)}<br>`;
                content += `- Accessibility: ${breakdown.accessibility.toFixed(2)}<br>`;
                content += `- Zoning: ${breakdown.zoning.toFixed(2)}<br>`;
            }
            
            content += `<div style="display: flex; gap: 10px; margin-top: 6px;">`;
            content += `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: #1976d2;">🌍 Google Maps</a>`;
            content += `<a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=19/${lat}/${lon}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: #1976d2;">🗺️ OSM</a>`;
            content += `</div>`;

            const marker = new Graphic({
                geometry: point,
                symbol: {
                    type: "picture-marker",
                    url: "/recommended-location.svg",
                    width: "48px",
                    height: "48px",
                },
                attributes: { score },
                popupTemplate: {
                    title: "Recommended Location",
                    content: content,
                },
            });

            placesLayerRef.current.add(marker);
        });

        // Add reference point marker
        const referencePoint = locations.reference_point || locations.referencePoint;
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
                    size: 14,
                    outline: { color: [0, 80, 200], width: 4 },
                },
                popupTemplate: {
                    title: "Reference Point",
                    content: `Address: ${referencePoint.name || "Reference Location"}`,
                },
            });

            placesLayerRef.current.add(refMarker);
        }

        // Zoom to show all markers
        if (locationsArray.length > 0 && view) {
            const targetPoints = locationsArray.map(
                ({ lat, lon }) => new Point({ latitude: lat, longitude: lon })
            );
            view.goTo(targetPoints, { zoom: 15 }).catch(console.error);
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

                view.goTo(placeGraphic);
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
