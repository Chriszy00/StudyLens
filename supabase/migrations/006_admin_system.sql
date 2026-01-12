-- Admin System Tables
-- This migration creates the admin user table and app settings
-- Run this in the Supabase SQL Editor

-- ============================================
-- APP SETTINGS TABLE
-- Global application settings (single row table)
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_enabled BOOLEAN DEFAULT true,
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT DEFAULT 'The system is currently under maintenance. Please try again later.',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings row
INSERT INTO app_settings (summary_enabled, maintenance_mode) 
VALUES (true, false)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (needed to check if summary is enabled)
CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- ADMIN USERS TABLE
-- Tracks which users have admin privileges
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Users can check if THEY are an admin (read their own row)
-- This is essential - without this, the admin check creates a circular dependency!
CREATE POLICY "Users can check own admin status"
  ON admin_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only admins can update app settings
CREATE POLICY "Only admins can update app settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Get app settings
-- ============================================
CREATE OR REPLACE FUNCTION public.get_app_settings()
RETURNS TABLE (
  id UUID,
  summary_enabled BOOLEAN,
  maintenance_mode BOOLEAN,
  maintenance_message TEXT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY SELECT 
    s.id,
    s.summary_enabled,
    s.maintenance_mode,
    s.maintenance_message,
    s.updated_at
  FROM app_settings s
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- IMPORTANT: Create your first admin user
-- Replace 'YOUR_USER_ID_HERE' with an actual user UUID
-- You can find user IDs in Supabase Dashboard > Authentication > Users
-- ============================================
-- Example (uncomment and modify):
-- INSERT INTO admin_users (user_id) VALUES ('your-user-uuid-here');

