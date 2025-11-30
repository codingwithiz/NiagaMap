const axios = require("axios");

exports.geocodeLocation = async (location) => {
    const url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates`;
    const params = {
        SingleLine: location,
        f: "json",
        outFields: "Match_addr,Addr_type",
        token: process.env.ARC_API_KEY,
    };

    try {
        const res = await axios.get(url, { params });
        const candidates = res.data.candidates;

        console.log("Geocode response:", candidates);

        if (!candidates || candidates.length === 0) return null;

        // Match address containing the location string (case-insensitive)
        const match = candidates.find((c) =>
            c.address.toLowerCase().includes(location.toLowerCase())
        );
        console.log("Matched location:", match ? match.address : "None");
        return match ? match : candidates[0];
    } catch (err) {
        console.error(
            "Error fetching geocode location:",
            err.response?.data || err.message
        );
        return null;
    }
};

exports.getCategories = async (category) => {
    console.log("Fetching categories for:", category);
    const url =
        "https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/categories";

    const params = {
        filter: category,
        f: "json",
        token: process.env.ARC_API_KEY, // Use your actual token or keep it in .env
    };

    try {
        const res = await axios.get(url, { params });
        console.log("Categories response:", res.data);
        let categoryIds = [];
        //get top 10 id
        if (res.data.categories.length === 0) {
            console.warn("No categories found for:", category);
            return [];
        }
        if (res.data.categories.length > 10) {
            res.data.categories = res.data.categories.slice(0, 10);
        }
        res.data.categories.forEach((cat) => {
            categoryIds.push(cat.categoryId);
        });
        console.log("Categories Ids:", categoryIds);
        return categoryIds;
    } catch (err) {
        console.error(
            "Error fetching categories:",
            err.response?.data || err.message
        );
        return [];
    }
};

exports.getNearbyPlaces = async (lat, lon, radius, searchText = "hospital", categoryIds) => {
    const url =
        "https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/places/near-point";

    const params = {
        x: lon.toString(), // longitude
        y: lat.toString(), // latitude
        searchText: searchText,
        radius: radius.toString(), // in meters
        categoryIds: categoryIds.join(","),
        pageSize: "20",
        f: "json",
        token: process.env.ARC_API_KEY, // Use your actual token or keep it in .env
    };
    console.log("nearby params: ", params)

    try {
        const res = await axios.get(url, { params });
        console.log("Nearby places response:", res.data);
        return res.data.results;
    } catch (err) {
        console.error(
            "Error fetching nearby places:",
            err.response?.data || err.message
        );
        return [];
    }
};
