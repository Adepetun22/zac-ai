-- Create dashboard_widgets table
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  schema JSONB NOT NULL,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create collaboration_sessions table
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code VARCHAR(20) UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create session_participants table
CREATE TABLE IF NOT EXISTS session_participants (
  session_id UUID REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

-- Create ai_models table
CREATE TABLE IF NOT EXISTS ai_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  cost NUMERIC(10, 2) DEFAULT 0,
  latency NUMERIC(10, 2) DEFAULT 0,
  api_requests INTEGER DEFAULT 0,
  tokens_processed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics_data table
CREATE TABLE IF NOT EXISTS analytics_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  metric VARCHAR(255) NOT NULL,
  value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table (synced from auth.users on signup)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to auto-create a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to dashboard_widgets
DROP TRIGGER IF EXISTS update_dashboard_widgets_updated_at ON dashboard_widgets;
CREATE TRIGGER update_dashboard_widgets_updated_at 
    BEFORE UPDATE ON dashboard_widgets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable row level security
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop policies first so this migration is safe to re-run
DROP POLICY IF EXISTS "Users can view widgets in their sessions" ON dashboard_widgets;
DROP POLICY IF EXISTS "Users can insert widgets in their sessions" ON dashboard_widgets;
DROP POLICY IF EXISTS "Users can update widgets in their sessions" ON dashboard_widgets;
DROP POLICY IF EXISTS "Users can delete widgets in their sessions" ON dashboard_widgets;
DROP POLICY IF EXISTS "Users can view their own ai_models" ON ai_models;
DROP POLICY IF EXISTS "Users can insert their own ai_models" ON ai_models;
DROP POLICY IF EXISTS "Users can update their own ai_models" ON ai_models;
DROP POLICY IF EXISTS "Users can delete their own ai_models" ON ai_models;
DROP POLICY IF EXISTS "Users can view their own analytics_data" ON analytics_data;
DROP POLICY IF EXISTS "Users can insert their own analytics_data" ON analytics_data;
DROP POLICY IF EXISTS "Users can update their own analytics_data" ON analytics_data;
DROP POLICY IF EXISTS "Users can delete their own analytics_data" ON analytics_data;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Create policies for dashboard_widgets
-- Note: dashboard_widgets.session_id is VARCHAR while collaboration_sessions.id is UUID,
-- so we cast the UUID to text to avoid "operator does not exist: character varying = uuid"
CREATE POLICY "Users can view widgets in their sessions" ON dashboard_widgets
    FOR SELECT TO authenticated
    USING (
        session_id IN (
            SELECT s.id::text FROM collaboration_sessions s
            JOIN session_participants sp ON s.id = sp.session_id
            WHERE sp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert widgets in their sessions" ON dashboard_widgets
    FOR INSERT TO authenticated
    WITH CHECK (
        session_id IN (
            SELECT s.id::text FROM collaboration_sessions s
            JOIN session_participants sp ON s.id = sp.session_id
            WHERE sp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update widgets in their sessions" ON dashboard_widgets
    FOR UPDATE TO authenticated
    USING (
        session_id IN (
            SELECT s.id::text FROM collaboration_sessions s
            JOIN session_participants sp ON s.id = sp.session_id
            WHERE sp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete widgets in their sessions" ON dashboard_widgets
    FOR DELETE TO authenticated
    USING (
        session_id IN (
            SELECT s.id::text FROM collaboration_sessions s
            JOIN session_participants sp ON s.id = sp.session_id
            WHERE sp.user_id = auth.uid()
        )
    );

-- Create policies for ai_models
CREATE POLICY "Users can view their own ai_models" ON ai_models
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own ai_models" ON ai_models
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own ai_models" ON ai_models
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own ai_models" ON ai_models
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Create policies for analytics_data
CREATE POLICY "Users can view their own analytics_data" ON analytics_data
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own analytics_data" ON analytics_data
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own analytics_data" ON analytics_data
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own analytics_data" ON analytics_data
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());