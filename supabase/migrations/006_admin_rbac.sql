-- =============================================================================
-- Migration 006: Secure Admin RBAC (USER, ADMIN, SUPER_ADMIN) & Audit Tables
-- =============================================================================

-- 1. Ensure profiles role constraint supports 'user', 'admin', 'super_admin'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'super_admin'));

-- 2. Ensure profiles verification_status constraint supports 'pending', 'verified', 'rejected', 'suspended'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_verification_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_verification_status_check CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended'));

-- 3. Reports table for reported rides and users
CREATE TABLE IF NOT EXISTS reports (
  id serial PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reported_ride_id integer REFERENCES rides(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);

-- 4. Announcements table for platform broadcasts
CREATE TABLE IF NOT EXISTS announcements (
  id serial PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  message text NOT NULL,
  target_college_id integer REFERENCES colleges(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. RLS for reports & announcements
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read announcements" ON announcements;
CREATE POLICY "Public read announcements" ON announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users create reports" ON reports;
CREATE POLICY "Users create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users read own reports" ON reports;
CREATE POLICY "Users read own reports" ON reports FOR SELECT USING (
  auth.uid() = reporter_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 6. Helper functions for RBAC checks
CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Seed super admin user
UPDATE profiles 
SET role = 'super_admin', verification_status = 'verified' 
WHERE email = 'prashant65001@gmail.com';
