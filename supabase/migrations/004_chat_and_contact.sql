-- =============================================================================
-- Migration 004: Real-time Chat & Contact Info Protection
-- =============================================================================

-- 1. Add phone_number to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;

-- 2. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  ride_id integer NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_ride_idx ON chat_messages(ride_id);
CREATE INDEX IF NOT EXISTS chat_messages_users_idx ON chat_messages(sender_id, receiver_id);

-- Enable RLS on chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for chat_messages

-- Helper function to check if a user is a confirmed participant of a ride
CREATE OR REPLACE FUNCTION is_confirmed_participant(p_ride_id integer, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is the driver
  IF EXISTS (SELECT 1 FROM rides WHERE id = p_ride_id AND driver_id = p_user_id) THEN
    RETURN true;
  END IF;

  -- Check if user is an accepted passenger
  IF EXISTS (SELECT 1 FROM ride_requests WHERE ride_id = p_ride_id AND passenger_id = p_user_id AND status IN ('accepted', 'completed')) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- SELECT policy: Users can read messages if they are sender or receiver AND confirmed participant
DROP POLICY IF EXISTS "Participants read chat messages" ON chat_messages;
CREATE POLICY "Participants read chat messages" ON chat_messages FOR SELECT USING (
  (auth.uid() = sender_id OR auth.uid() = receiver_id) AND
  is_confirmed_participant(ride_id, auth.uid())
);

-- INSERT policy: Users can insert messages if auth.uid() is sender AND confirmed participant
DROP POLICY IF EXISTS "Participants insert chat messages" ON chat_messages;
CREATE POLICY "Participants insert chat messages" ON chat_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  is_confirmed_participant(ride_id, sender_id) AND
  is_confirmed_participant(ride_id, receiver_id)
);

-- UPDATE policy: Receiver can mark messages as read
DROP POLICY IF EXISTS "Receiver update chat messages" ON chat_messages;
CREATE POLICY "Receiver update chat messages" ON chat_messages FOR UPDATE USING (
  auth.uid() = receiver_id
);

-- 4. Secure RPC function to fetch contact info of confirmed participants ONLY
CREATE OR REPLACE FUNCTION get_confirmed_contact_info(p_ride_id integer, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id uuid;
  v_target_profile profiles%ROWTYPE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Check caller is confirmed participant
  IF NOT is_confirmed_participant(p_ride_id, v_caller_id) THEN
    RAISE EXCEPTION 'NOT_A_CONFIRMED_PARTICIPANT';
  END IF;

  -- Check target is confirmed participant
  IF NOT is_confirmed_participant(p_ride_id, p_target_user_id) THEN
    RAISE EXCEPTION 'TARGET_NOT_A_CONFIRMED_PARTICIPANT';
  END IF;

  -- Fetch target profile
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'name', v_target_profile.name,
    'email', v_target_profile.email,
    'phone_number', v_target_profile.phone_number
  );
END;
$$;

-- 5. Add chat_messages to Supabase Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
