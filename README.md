# NiagaMap 🗺️

**AI-Powered Location Intelligence Platform for Business Site Selection**

[![Production](https://img.shields.io/badge/Production-Live-brightgreen)](https://niagamap.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Render-blue)](https://niagamap.onrender.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🌐 Live Application

**Production URL:** [https://niagamap.vercel.app/](https://niagamap.vercel.app/)

## 📖 Overview

NiagaMap is an intelligent location analysis platform that helps businesses make data-driven decisions for site selection. Using AI-powered analysis, geospatial data, and multi-criteria evaluation, it identifies optimal locations for retail stores, F&B outlets, healthcare facilities, and more.

### Key Features

- **🤖 AI-Powered Chatbot**: Natural language interface for location analysis requests
- **📊 Multi-Criteria Analysis**: Evaluates locations based on demand, competition, accessibility, zoning, and risk
- **🗺️ Interactive Maps**: ArcGIS-powered visualization with hexagonal grid analysis
- **📍 Smart Recommendations**: AI-generated location suggestions with reasoning
- **💾 Analysis Management**: Save, organize, and share your analyses
- **🔐 Secure Authentication**: Firebase-based user authentication with Google Sign-In
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **🌙 Dark Mode Support**: Eye-friendly dark theme option

## 🏗️ Architecture

### Frontend (React + Vite)

- **Framework**: React 19 with Vite
- **UI Libraries**: Tailwind CSS, Calcite Components
- **Mapping**: ArcGIS Maps SDK for JavaScript 4.32
- **State Management**: React Context API
- **Authentication**: Firebase Authentication
- **Routing**: React Router v6
- **HTTP Client**: Axios

### Backend (Node.js + Express)

- **Runtime**: Node.js with Express 5
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Firebase Admin SDK
- **AI Services**: OpenAI GPT-4o
- **Geospatial**: ArcGIS REST API, Turf.js
- **APIs**: Google Places, ArcGIS Location Services

## 🚀 Core Features

### 1. **Intelligent Location Analysis**

- Multi-factor evaluation (demand, competition, accessibility, zoning, risk)
- Customizable category presets (Retail, F&B, Health, Automotive, Sports)
- Dynamic weight adjustment for each criterion
- Hexagonal grid-based spatial analysis

### 2. **AI Chatbot Assistant**

- Natural language processing for location queries
- Context-aware conversation management
- Location extraction and validation
- Automated workflow execution
- Real-time progress tracking

### 3. **Interactive Map Visualization**

- ArcGIS-powered basemap with multiple styles
- Hexagonal heatmap overlays showing suitability scores
- POI (Points of Interest) visualization
- Reference point and recommended location markers
- Click-to-view detailed analysis popups

### 4. **Analysis Management**

- Save and retrieve past analyses
- Star favorites for quick access
- Add custom notes and tags
- Export analysis results
- Share analysis via public links (coming soon)

### 5. **User Dashboard**

- Personal profile management
- Analysis history with search and filters
- Quick access to recent and favorite analyses
- Usage statistics and insights

## 🛠️ Technology Stack

### Frontend Technologies

```json
{
  "react": "^19.1.0",
  "@arcgis/core": "^4.32.10",
  "firebase": "^11.9.1",
  "axios": "^1.9.0",
  "tailwindcss": "^4.1.8",
  "@turf/turf": "^7.3.1",
  "html2canvas": "^1.4.1",
  "jspdf": "^3.0.4"
}
```

### Backend Technologies

```json
{
  "express": "^5.1.0",
  "@supabase/supabase-js": "^2.86.2",
  "firebase-admin": "^13.4.0",
  "openai": "^5.2.0",
  "axios": "^1.9.0",
  "cors": "^2.8.5"
}
```

## 📦 Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase account
- Supabase account
- ArcGIS Developer account
- OpenAI API key

### Local Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/codingwithiz/NiagaMap.git
cd NiagaMap
```

2. **Backend Setup**

```bash
cd draft/backend
npm install

# Create .env file
cat > .env << EOF
ARC_API_KEY=your_arcgis_api_key
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
EOF

# Run development server
npm run dev
```

3. **Frontend Setup**

```bash
cd draft/frontend
npm install

# Create .env file
cat > .env << EOF
VITE_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_ARCGIS_API_KEY=your_arcgis_api_key
EOF

# Run development server
npm run dev
```

4. **Access the application**

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## 🗄️ Database Schema

### Key Tables

- **users**: User profiles and preferences
- **chats**: Chat sessions
- **conversations**: Chat messages and AI responses
- **analysis**: Location analysis results
- **reference_points**: Search locations
- **recommended_locations**: AI-recommended sites
- **hexagon_scores**: Spatial analysis grid data
- **favourites**: User-saved analyses (coming soon)
- **shared_analyses**: Shareable analysis links (coming soon)

## 🔐 Environment Variables

### Backend Required Variables

```
ARC_API_KEY                    # ArcGIS API key
OPENAI_API_KEY                 # OpenAI API key
SUPABASE_URL                   # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY      # Supabase service role key
FIREBASE_SERVICE_ACCOUNT_KEY   # Firebase admin SDK credentials (JSON string)
PORT                           # Server port (default: 3001)
```

### Frontend Required Variables

```
VITE_API_URL                   # Backend API URL
VITE_FIREBASE_API_KEY          # Firebase web API key
VITE_FIREBASE_AUTH_DOMAIN      # Firebase auth domain
VITE_FIREBASE_PROJECT_ID       # Firebase project ID
VITE_FIREBASE_STORAGE_BUCKET   # Firebase storage bucket
VITE_FIREBASE_MESSAGING_SENDER_ID  # Firebase messaging sender ID
VITE_FIREBASE_APP_ID           # Firebase app ID
VITE_ARCGIS_API_KEY            # ArcGIS API key
```

## 🚀 Deployment

### Frontend (Vercel)

```bash
cd draft/frontend
vercel --prod
```

### Backend (Render)

- Connected to GitHub repository
- Auto-deploys on push to main branch
- Root directory: `draft/backend`
- Build command: `npm install`
- Start command: `npm start`

## 🎯 Use Cases

1. **Retail Site Selection**: Find optimal locations for new retail stores based on foot traffic, demographics, and competition
2. **F&B Expansion**: Identify high-potential areas for restaurants considering accessibility and market demand
3. **Healthcare Facilities**: Locate underserved areas for clinics and pharmacies
4. **Service Centers**: Determine strategic locations for automotive service centers or gyms
5. **Market Research**: Analyze competitive landscape and market gaps

## 📊 Analysis Factors

| Factor            | Description                                     | Data Sources                       |
| ----------------- | ----------------------------------------------- | ---------------------------------- |
| **Demand**        | Population density, demographics, income levels | Census data, ArcGIS GeoEnrichment  |
| **Competition**   | Existing businesses in the same category        | Google Places API, ArcGIS POI data |
| **Accessibility** | Public transit, road networks, walkability      | ArcGIS Routing, OpenStreetMap      |
| **Zoning**        | Land use regulations, commercial zones          | ArcGIS Zoning layers               |
| **Risk**          | Crime rates, natural hazards                    | Local government data              |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Ing Zhen** - _Initial work_ - [@codingwithiz](https://github.com/codingwithiz)
- **Weng Hong** - _Contributor_ - [@AsynchronousNotAvailable](https://github.com/AsynchronousNotAvailable)

## 🙏 Acknowledgments

- Kleos Technologies (Mr. Raja Khuzairie)
- Dr. Chiam Yin Kia (Supervisor)

## 📞 Support

For support, email ingzhen2003@gmail.com / wenghong03.work@gmail.com or open an issue in the GitHub repository.

---

**Built with ❤️ for smarter business decisions**
