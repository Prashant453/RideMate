-- =============================================================================
-- Migration 005: Supabase Realtime Publication for Rides & Notifications
-- =============================================================================

-- Ensure notifications table RLS policies are clean
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Ensure rides table has search indexes
CREATE INDEX IF NOT EXISTS rides_status_departure_idx ON rides(status, departure_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);

-- Enable Supabase Realtime publications for rides and notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rides;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Database function to trigger notification for relevant college students on new ride creation
CREATE OR REPLACE FUNCTION notify_college_students_on_new_ride()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_profile profiles%ROWTYPE;
  v_origin_name text;
  v_dest_name text;
BEGIN
  -- Get driver profile to find college_id
  SELECT * INTO v_driver_profile FROM profiles WHERE id = NEW.driver_id;
  SELECT name INTO v_origin_name FROM locations WHERE id = NEW.origin_location_id;
  SELECT name INTO v_dest_name FROM locations WHERE id = NEW.destination_location_id;

  IF v_driver_profile.college_id IS NOT NULL THEN
    -- Insert notification for students in the same college (excluding driver)
    INSERT INTO notifications (user_id, type, title, message, reference_id)
    SELECT 
      id, 
      'new_ride', 
      'New ride on your route', 
      coalesce(v_driver_profile.name, 'A student') || ' offered a ride: ' || coalesce(v_origin_name, 'Origin') || ' → ' || coalesce(v_dest_name, 'Destination'),
      NEW.id
    FROM profiles
    WHERE college_id = v_driver_profile.college_id AND id != NEW.driver_id
    LIMIT 50; -- Cap at 50 students per new ride to keep lightweight
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_ride_created ON rides;
CREATE TRIGGER on_new_ride_created
  AFTER INSERT ON rides
  FOR EACH ROW
  WHEN (NEW.status = 'open')
  EXECUTE FUNCTION notify_college_students_on_new_ride();
