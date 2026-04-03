-- ============================================
-- PriorityGuard - Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  hourly_rate DECIMAL(10,2) DEFAULT 50.00,
  work_start_hour INTEGER DEFAULT 9,
  work_end_hour INTEGER DEFAULT 18,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMPTZ,
  gmail_sync_enabled BOOLEAN DEFAULT FALSE,
  calendar_sync_enabled BOOLEAN DEFAULT FALSE,
  last_briefing_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'voice', 'gmail', 'calendar')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'deferred')),
  
  -- Economic fields
  estimated_value DECIMAL(10,2),        -- estimated $ value of this task
  estimated_duration_mins INTEGER,       -- how long it will take
  hourly_rate_at_creation DECIMAL(10,2), -- user's rate when task was created
  
  -- AI scoring fields
  ai_score INTEGER CHECK (ai_score BETWEEN 0 AND 100),
  ai_reasoning TEXT,
  ai_breakdown JSONB,
  ai_category TEXT,
  ai_urgency_score INTEGER CHECK (ai_urgency_score BETWEEN 0 AND 100),
  ai_impact_score INTEGER CHECK (ai_impact_score BETWEEN 0 AND 100),
  ai_effort_score INTEGER CHECK (ai_effort_score BETWEEN 0 AND 100),
  ai_scored_at TIMESTAMPTZ,
  
  -- Scheduling
  due_date TIMESTAMPTZ,
  scheduled_for DATE,
  completed_at TIMESTAMPTZ,
  
  -- External references
  gmail_message_id TEXT,
  calendar_event_id TEXT,
  delegation_brief TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOCUS SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_mins INTEGER,
  outcome TEXT CHECK (outcome IN ('completed', 'skipped', 'interrupted', 'in_progress')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DAILY SUMMARIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  tasks_skipped INTEGER DEFAULT 0,
  high_value_completed INTEGER DEFAULT 0,
  low_value_completed INTEGER DEFAULT 0,
  estimated_revenue_protected DECIMAL(10,2) DEFAULT 0,
  drift_score INTEGER DEFAULT 0, -- 0 = no drift, 100 = full procrastination
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Tasks: users can only CRUD their own tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
CREATE POLICY "Users can insert own tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Focus sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON public.focus_sessions;
CREATE POLICY "Users can view own sessions" ON public.focus_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.focus_sessions;
CREATE POLICY "Users can insert own sessions" ON public.focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.focus_sessions;
CREATE POLICY "Users can update own sessions" ON public.focus_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Daily summaries
DROP POLICY IF EXISTS "Users can view own summaries" ON public.daily_summaries;
CREATE POLICY "Users can view own summaries" ON public.daily_summaries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own summaries" ON public.daily_summaries;
CREATE POLICY "Users can insert own summaries" ON public.daily_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own summaries" ON public.daily_summaries;
CREATE POLICY "Users can update own summaries" ON public.daily_summaries
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks(status);
CREATE INDEX IF NOT EXISTS tasks_scheduled_for_idx ON public.tasks(scheduled_for);
CREATE INDEX IF NOT EXISTS tasks_ai_score_idx ON public.tasks(ai_score DESC);
CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx ON public.focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS daily_summaries_user_date_idx ON public.daily_summaries(user_id, date);
