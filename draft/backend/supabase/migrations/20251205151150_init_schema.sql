-- ================================
-- Users Preferences
-- ================================

CREATE TABLE public.preferences (
    preference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    default_prompt text,
    theme text
);

-- ================================
-- ReferencePoint
-- ================================

CREATE TABLE public.reference_point (
    point_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    lat double precision,
    lon double precision
);

-- ================================
-- Users
-- ================================

CREATE TABLE public.users (
    user_id text PRIMARY KEY, -- changed from uuid
    name text,
    preference_id uuid,
    CONSTRAINT fk_users_preference FOREIGN KEY (preference_id)
      REFERENCES public.preferences(preference_id) ON DELETE SET NULL
);

-- ================================
-- Analysis
-- ================================

CREATE TABLE public.analysis (
    analysis_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text, -- changed from uuid
    reference_point_id uuid,
    chat_id uuid,
    created_at timestamptz DEFAULT now(),

    CONSTRAINT fk_analysis_user FOREIGN KEY (user_id)
      REFERENCES public.users(user_id) ON DELETE SET NULL,

    CONSTRAINT fk_analysis_reference FOREIGN KEY (reference_point_id)
      REFERENCES public.reference_point(point_id) ON DELETE SET NULL
);

-- ================================
-- Chat
-- ================================

CREATE TABLE public.chat (
    chat_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text,
    thread_id text,
    user_id text, -- changed from uuid
    analysis_id uuid,
    created_at timestamptz DEFAULT now(),

    CONSTRAINT fk_chat_analysis FOREIGN KEY (analysis_id)
      REFERENCES public.analysis(analysis_id) ON DELETE SET NULL,

    CONSTRAINT fk_chat_user FOREIGN KEY (user_id)
      REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- ================================
-- Conversation
-- ================================

CREATE TABLE public.conversation (
    conversation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id uuid,
    user_prompt text,
    bot_answer text,
    created_at timestamptz DEFAULT now(),
    analysis_id uuid,

    CONSTRAINT fk_conversation_chat FOREIGN KEY (chat_id)
      REFERENCES public.chat(chat_id) ON DELETE CASCADE,

    CONSTRAINT fk_conversation_analysis FOREIGN KEY (analysis_id)
      REFERENCES public.analysis(analysis_id) ON DELETE SET NULL
);

-- ================================
-- Recommended Location
-- ================================

CREATE TABLE public.recommended_location (
    location_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id uuid,
    lat double precision,
    lon double precision,
    score double precision,
    reason text,

    CONSTRAINT fk_recommended_analysis FOREIGN KEY (analysis_id)
      REFERENCES public.analysis(analysis_id) ON DELETE CASCADE
);

-- ================================
-- HEXAGON + ANALYSIS EXTENSION
-- ================================

CREATE TABLE public.hexagon (
    hex_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id uuid NOT NULL,
    hex_index integer NOT NULL,
    coordinates jsonb,

    CONSTRAINT fk_hex_analysis FOREIGN KEY (analysis_id)
      REFERENCES public.analysis(analysis_id) ON DELETE CASCADE
);

-- ================================
-- DEMAND TABLE
-- ================================

CREATE TABLE public.demand (
    demand_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hex_id uuid NOT NULL,
    demand_score double precision,
    population double precision,

    CONSTRAINT fk_demand_hex FOREIGN KEY (hex_id)
      REFERENCES public.hexagon(hex_id) ON DELETE CASCADE
);

-- ================================
-- POINTS OF INTEREST TABLE
-- ================================

CREATE TABLE public.poi (
    poi_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hex_id uuid NOT NULL,
    poi_score double precision,
    poi_count integer,

    CONSTRAINT fk_poi_hex FOREIGN KEY (hex_id)
      REFERENCES public.hexagon(hex_id) ON DELETE CASCADE
);

-- ================================
-- ACCESSIBILITY TABLE
-- ================================

CREATE TABLE public.accessibility (
    accessibility_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hex_id uuid NOT NULL,
    accessibility_score double precision,
    nearest_distance double precision,

    CONSTRAINT fk_accessibility_hex FOREIGN KEY (hex_id)
      REFERENCES public.hexagon(hex_id) ON DELETE CASCADE
);

-- ================================
-- ZONING TABLE
-- ================================

CREATE TABLE public.zoning (
    zoning_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hex_id uuid NOT NULL,
    zoning_type text,

    CONSTRAINT fk_zoning_hex FOREIGN KEY (hex_id)
      REFERENCES public.hexagon(hex_id) ON DELETE CASCADE
);

-- ================================
-- RISK TABLE
-- ================================

CREATE TABLE public.risk (
    risk_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hex_id uuid NOT NULL,
    risk_ratio double precision,
    flood_score double precision,
    landslide_score double precision,
    total_score double precision,

    CONSTRAINT fk_risk_hex FOREIGN KEY (hex_id)
      REFERENCES public.hexagon(hex_id) ON DELETE CASCADE
);

-- ================================
-- FAVOURITE TABLE
-- ================================

CREATE TABLE public.favourites (
    favourite_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL, -- changed from uuid
    analysis_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),

    CONSTRAINT fk_fav_user FOREIGN KEY (user_id)
      REFERENCES public.users(user_id) ON DELETE CASCADE,

    CONSTRAINT fk_fav_analysis FOREIGN KEY (analysis_id)
      REFERENCES public.analysis(analysis_id) ON DELETE CASCADE
);
