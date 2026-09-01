-- Ensure announcements table exists
CREATE TABLE IF NOT EXISTS announcements (
  id serial PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  message text NOT NULL,
  target_college_id integer REFERENCES colleges(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "Public read announcements" ON announcements;
DROP POLICY IF EXISTS "Users read intended announcements" ON announcements;
DROP POLICY IF EXISTS "Admins manage announcements" ON announcements;

-- Users can only read announcements intended for them (either no target college, or matches their college)
CREATE POLICY "Users read intended announcements" ON announcements
FOR SELECT
TO authenticated
USING (
  target_college_id IS NULL OR
  target_college_id = (SELECT college_id FROM profiles WHERE id = auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Admins can create announcements
CREATE POLICY "Admins manage announcements" ON announcements
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Force PostgREST to reload the schema cache so the table is immediately recognized
NOTIFY pgrst, 'reload schema';
