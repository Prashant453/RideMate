-- =============================================================================
-- RideMate Master Supabase Database Migration
-- Project: RideMate (Student Ride-Sharing)
-- Direct SQL Editor Script
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: TABLES, INDEXES & SEED DATA
-- -----------------------------------------------------------------------------

-- 1. colleges
CREATE TABLE IF NOT EXISTS colleges (
  id serial PRIMARY KEY,
  name text NOT NULL,
  domain text,
  city text,
  state text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. campuses
CREATE TABLE IF NOT EXISTS campuses (
  id serial PRIMARY KEY,
  college_id integer NOT NULL REFERENCES colleges(id),
  name text NOT NULL,
  latitude text,
  longitude text,
  is_active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS campuses_college_idx ON campuses(college_id);

-- 3. locations
CREATE TABLE IF NOT EXISTS locations (
  id serial PRIMARY KEY,
  name text NOT NULL,
  latitude text,
  longitude text,
  type text NOT NULL DEFAULT 'area',
  parent_location_id integer REFERENCES locations(id),
  is_active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS locations_parent_idx ON locations(parent_location_id);

-- 4. profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  college_id integer REFERENCES colleges(id),
  course text,
  year text,
  profile_image text,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  rating numeric(3,2) NOT NULL DEFAULT 0,
  total_rides integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_college_idx ON profiles(college_id);

-- 5. vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id serial PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bike', 'scooter', 'car')),
  model text NOT NULL,
  registration_last4 varchar(4),
  seat_capacity integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicles_owner_idx ON vehicles(owner_id);

-- 6. rides
CREATE TABLE IF NOT EXISTS rides (
  id serial PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES profiles(id),
  vehicle_id integer REFERENCES vehicles(id),
  origin_location_id integer NOT NULL REFERENCES locations(id),
  destination_location_id integer NOT NULL REFERENCES locations(id),
  departure_at timestamptz NOT NULL,
  total_seats integer NOT NULL,
  available_seats integer NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'in_progress', 'completed', 'cancelled', 'expired')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT available_seats_non_negative CHECK (available_seats >= 0),
  CONSTRAINT available_seats_le_total CHECK (available_seats <= total_seats)
);
CREATE INDEX IF NOT EXISTS rides_search_idx ON rides(origin_location_id, destination_location_id, departure_at, status);
CREATE INDEX IF NOT EXISTS rides_driver_idx ON rides(driver_id);
CREATE INDEX IF NOT EXISTS rides_departure_idx ON rides(departure_at);
CREATE INDEX IF NOT EXISTS rides_status_idx ON rides(status) WHERE status IN ('open', 'full');

-- 7. ride_requests
CREATE TABLE IF NOT EXISTS ride_requests (
  id serial PRIMARY KEY,
  ride_id integer NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_ride_passenger UNIQUE (ride_id, passenger_id)
);
CREATE INDEX IF NOT EXISTS ride_requests_ride_idx ON ride_requests(ride_id);
CREATE INDEX IF NOT EXISTS ride_requests_passenger_idx ON ride_requests(passenger_id);
CREATE INDEX IF NOT EXISTS ride_requests_status_idx ON ride_requests(status);

-- 8. ratings
CREATE TABLE IF NOT EXISTS ratings (
  id serial PRIMARY KEY,
  ride_id integer NOT NULL REFERENCES rides(id),
  from_user_id uuid NOT NULL REFERENCES profiles(id),
  to_user_id uuid NOT NULL REFERENCES profiles(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_rating_per_pair UNIQUE (ride_id, from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS ratings_ride_idx ON ratings(ride_id);
CREATE INDEX IF NOT EXISTS ratings_to_user_idx ON ratings(to_user_id);

-- 9. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  reference_id integer,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(user_id, is_read) WHERE is_read = false;

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS vehicles_updated_at ON vehicles;
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS rides_updated_at ON rides;
CREATE TRIGGER rides_updated_at BEFORE UPDATE ON rides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS ride_requests_updated_at ON ride_requests;
CREATE TRIGGER ride_requests_updated_at BEFORE UPDATE ON ride_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Seed data: college
INSERT INTO colleges (name, domain, city, state, is_active)
SELECT 'Dev Bhoomi Uttarakhand University', 'dbuu.ac.in', 'Dehradun', 'Uttarakhand', true
WHERE NOT EXISTS (SELECT 1 FROM colleges WHERE domain = 'dbuu.ac.in');

-- Seed data: locations
INSERT INTO locations (name, type, is_active)
SELECT 'DBUU', 'campus', true
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'DBUU');

INSERT INTO locations (name, type, is_active)
SELECT 'Manduwala', 'area', true
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Manduwala');

INSERT INTO locations (name, type, is_active)
SELECT 'Naugaon', 'area', true
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Naugaon');

INSERT INTO locations (name, type, is_active)
SELECT 'Bhauwala', 'area', true
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Bhauwala');

-- Seed data: campus
INSERT INTO campuses (college_id, name, is_active)
SELECT id, 'DBUU Main Campus', true FROM colleges WHERE domain = 'dbuu.ac.in'
AND NOT EXISTS (
  SELECT 1 FROM campuses 
  WHERE college_id = (SELECT id FROM colleges WHERE domain = 'dbuu.ac.in') 
  AND name = 'DBUU Main Campus'
) LIMIT 1;

-- -----------------------------------------------------------------------------
-- SECTION 2: ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read colleges" ON colleges;
CREATE POLICY "Public read colleges" ON colleges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read campuses" ON campuses;
CREATE POLICY "Public read campuses" ON campuses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read locations" ON locations;
CREATE POLICY "Public read locations" ON locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public read vehicles" ON vehicles;
CREATE POLICY "Public read vehicles" ON vehicles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own vehicles" ON vehicles;
CREATE POLICY "Users insert own vehicles" ON vehicles FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users update own vehicles" ON vehicles;
CREATE POLICY "Users update own vehicles" ON vehicles FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users delete own vehicles" ON vehicles;
CREATE POLICY "Users delete own vehicles" ON vehicles FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Public read rides" ON rides;
CREATE POLICY "Public read rides" ON rides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers insert own rides" ON rides;
CREATE POLICY "Drivers insert own rides" ON rides FOR INSERT WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Drivers update own rides" ON rides;
CREATE POLICY "Drivers update own rides" ON rides FOR UPDATE USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Passengers read own requests" ON ride_requests;
CREATE POLICY "Passengers read own requests" ON ride_requests FOR SELECT USING (
  auth.uid() = passenger_id OR
  auth.uid() = (SELECT driver_id FROM rides WHERE rides.id = ride_requests.ride_id)
);

DROP POLICY IF EXISTS "Passengers insert requests" ON ride_requests;
CREATE POLICY "Passengers insert requests" ON ride_requests FOR INSERT WITH CHECK (auth.uid() = passenger_id);

DROP POLICY IF EXISTS "Passengers update own requests" ON ride_requests;
CREATE POLICY "Passengers update own requests" ON ride_requests FOR UPDATE USING (
  auth.uid() = passenger_id OR
  auth.uid() = (SELECT driver_id FROM rides WHERE rides.id = ride_requests.ride_id)
);

DROP POLICY IF EXISTS "Public read ratings" ON ratings;
CREATE POLICY "Public read ratings" ON ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own ratings" ON ratings;
CREATE POLICY "Users insert own ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- SECTION 3: ATOMIC RPC FUNCTIONS
-- -----------------------------------------------------------------------------

-- 1. request_ride_seat
CREATE OR REPLACE FUNCTION request_ride_seat(p_ride_id integer, p_passenger_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ride rides%ROWTYPE;
    v_existing_request ride_requests%ROWTYPE;
    v_new_request ride_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'RIDE_NOT_FOUND'; END IF;
    IF v_ride.status != 'open' THEN RAISE EXCEPTION 'RIDE_NOT_OPEN'; END IF;
    IF v_ride.driver_id = p_passenger_id THEN RAISE EXCEPTION 'PASSENGER_IS_DRIVER'; END IF;

    SELECT * INTO v_existing_request FROM ride_requests 
    WHERE ride_id = p_ride_id AND passenger_id = p_passenger_id AND status IN ('pending', 'accepted');
    
    IF FOUND THEN
        RETURN jsonb_build_object('already_requested', true, 'request', row_to_json(v_existing_request));
    END IF;

    INSERT INTO ride_requests (ride_id, passenger_id, status)
    VALUES (p_ride_id, p_passenger_id, 'pending')
    RETURNING * INTO v_new_request;

    INSERT INTO notifications (user_id, type, title, message, reference_id)
    VALUES (v_ride.driver_id, 'ride_request', 'New seat request', 'A student has requested a seat on your ride.', p_ride_id);

    RETURN jsonb_build_object('already_requested', false, 'request', row_to_json(v_new_request));
END;
$$;

-- 2. accept_ride_request
CREATE OR REPLACE FUNCTION accept_ride_request(p_request_id integer, p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request ride_requests%ROWTYPE;
    v_ride rides%ROWTYPE;
    v_updated_request ride_requests%ROWTYPE;
    v_updated_seats integer;
BEGIN
    SELECT * INTO v_request FROM ride_requests WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
    IF v_request.status != 'pending' THEN RAISE EXCEPTION 'REQUEST_NOT_PENDING'; END IF;

    SELECT * INTO v_ride FROM rides WHERE id = v_request.ride_id;
    IF v_ride.driver_id != p_driver_id THEN RAISE EXCEPTION 'UNAUTHORIZED_DRIVER'; END IF;

    UPDATE rides SET available_seats = available_seats - 1 
    WHERE id = v_request.ride_id AND available_seats > 0
    RETURNING available_seats INTO v_updated_seats;

    IF v_updated_seats IS NULL THEN RAISE EXCEPTION 'RIDE_FULL'; END IF;
    IF v_updated_seats = 0 THEN UPDATE rides SET status = 'full' WHERE id = v_request.ride_id; END IF;

    UPDATE ride_requests SET status = 'accepted' WHERE id = p_request_id
    RETURNING * INTO v_updated_request;

    INSERT INTO notifications (user_id, type, title, message, reference_id)
    VALUES (v_request.passenger_id, 'request_accepted', 'Seat confirmed!', 'The driver has accepted your seat request.', v_request.ride_id);

    RETURN row_to_json(v_updated_request)::jsonb;
END;
$$;

-- 3. reject_ride_request
CREATE OR REPLACE FUNCTION reject_ride_request(p_request_id integer, p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request ride_requests%ROWTYPE;
    v_ride rides%ROWTYPE;
    v_updated_request ride_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_request FROM ride_requests WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
    IF v_request.status != 'pending' THEN RAISE EXCEPTION 'REQUEST_NOT_PENDING'; END IF;

    SELECT * INTO v_ride FROM rides WHERE id = v_request.ride_id;
    IF v_ride.driver_id != p_driver_id THEN RAISE EXCEPTION 'UNAUTHORIZED_DRIVER'; END IF;

    UPDATE ride_requests SET status = 'rejected' WHERE id = p_request_id
    RETURNING * INTO v_updated_request;

    INSERT INTO notifications (user_id, type, title, message, reference_id)
    VALUES (v_request.passenger_id, 'request_rejected', 'Seat request declined', 'The driver has declined your seat request.', v_request.ride_id);

    RETURN row_to_json(v_updated_request)::jsonb;
END;
$$;

-- 4. cancel_ride_request
CREATE OR REPLACE FUNCTION cancel_ride_request(p_request_id integer, p_passenger_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request ride_requests%ROWTYPE;
    v_ride rides%ROWTYPE;
    v_updated_request ride_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_request FROM ride_requests WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
    IF v_request.passenger_id != p_passenger_id THEN RAISE EXCEPTION 'UNAUTHORIZED_PASSENGER'; END IF;
    IF v_request.status NOT IN ('pending', 'accepted') THEN RAISE EXCEPTION 'REQUEST_CANNOT_BE_CANCELLED'; END IF;

    IF v_request.status = 'accepted' THEN
        UPDATE rides 
        SET available_seats = available_seats + 1, 
            status = CASE WHEN status = 'full' THEN 'open' ELSE status END
        WHERE id = v_request.ride_id;
    END IF;

    UPDATE ride_requests SET status = 'cancelled' WHERE id = p_request_id
    RETURNING * INTO v_updated_request;

    SELECT * INTO v_ride FROM rides WHERE id = v_request.ride_id;
    INSERT INTO notifications (user_id, type, title, message, reference_id)
    VALUES (v_ride.driver_id, 'request_cancelled', 'Seat request cancelled', 'A passenger has cancelled their seat request.', v_request.ride_id);

    RETURN row_to_json(v_updated_request)::jsonb;
END;
$$;

-- 5. cancel_ride
CREATE OR REPLACE FUNCTION cancel_ride(p_ride_id integer, p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ride rides%ROWTYPE;
    v_req ride_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'RIDE_NOT_FOUND'; END IF;
    IF v_ride.driver_id != p_driver_id THEN RAISE EXCEPTION 'UNAUTHORIZED_DRIVER'; END IF;
    IF v_ride.status NOT IN ('open', 'full') THEN RAISE EXCEPTION 'RIDE_CANNOT_BE_CANCELLED'; END IF;

    UPDATE rides SET status = 'cancelled' WHERE id = p_ride_id;

    FOR v_req IN SELECT * FROM ride_requests WHERE ride_id = p_ride_id AND status IN ('pending', 'accepted') LOOP
        UPDATE ride_requests SET status = 'cancelled' WHERE id = v_req.id;
        INSERT INTO notifications (user_id, type, title, message, reference_id)
        VALUES (v_req.passenger_id, 'ride_cancelled', 'Ride cancelled', 'The driver has cancelled the ride.', p_ride_id);
    END LOOP;
END;
$$;

-- 6. complete_ride
CREATE OR REPLACE FUNCTION complete_ride(p_ride_id integer, p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ride rides%ROWTYPE;
    v_req ride_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'RIDE_NOT_FOUND'; END IF;
    IF v_ride.driver_id != p_driver_id THEN RAISE EXCEPTION 'UNAUTHORIZED_DRIVER'; END IF;
    IF v_ride.status NOT IN ('open', 'full', 'in_progress') THEN RAISE EXCEPTION 'RIDE_CANNOT_BE_COMPLETED'; END IF;

    UPDATE rides SET status = 'completed' WHERE id = p_ride_id;

    UPDATE ride_requests SET status = 'completed' WHERE ride_id = p_ride_id AND status = 'accepted';
    UPDATE ride_requests SET status = 'expired' WHERE ride_id = p_ride_id AND status = 'pending';

    FOR v_req IN SELECT * FROM ride_requests WHERE ride_id = p_ride_id AND status = 'completed' LOOP
        INSERT INTO notifications (user_id, type, title, message, reference_id)
        VALUES (v_req.passenger_id, 'ride_completed', 'Ride completed', 'The ride has been completed.', p_ride_id);
        UPDATE profiles SET total_rides = total_rides + 1 WHERE id = v_req.passenger_id;
    END LOOP;

    INSERT INTO notifications (user_id, type, title, message, reference_id)
    VALUES (v_ride.driver_id, 'ride_completed', 'Ride completed', 'Your ride has been completed.', p_ride_id);
    UPDATE profiles SET total_rides = total_rides + 1 WHERE id = v_ride.driver_id;
END;
$$;

-- 7. submit_rating
CREATE OR REPLACE FUNCTION submit_rating(p_ride_id integer, p_from_user uuid, p_to_user uuid, p_rating integer, p_review text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ride rides%ROWTYPE;
    v_is_from_participant boolean := false;
    v_is_to_participant boolean := false;
    v_rating ratings%ROWTYPE;
BEGIN
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'RIDE_NOT_FOUND'; END IF;
    IF v_ride.status != 'completed' THEN RAISE EXCEPTION 'RIDE_NOT_COMPLETED'; END IF;

    IF v_ride.driver_id = p_from_user THEN v_is_from_participant := true; END IF;
    IF v_ride.driver_id = p_to_user THEN v_is_to_participant := true; END IF;

    IF NOT v_is_from_participant THEN
        SELECT EXISTS (
            SELECT 1 FROM ride_requests 
            WHERE ride_id = p_ride_id AND passenger_id = p_from_user AND status = 'completed'
        ) INTO v_is_from_participant;
    END IF;

    IF NOT v_is_to_participant THEN
        SELECT EXISTS (
            SELECT 1 FROM ride_requests 
            WHERE ride_id = p_ride_id AND passenger_id = p_to_user AND status = 'completed'
        ) INTO v_is_to_participant;
    END IF;

    IF NOT v_is_from_participant OR NOT v_is_to_participant THEN
        RAISE EXCEPTION 'NOT_A_PARTICIPANT';
    END IF;

    IF EXISTS (SELECT 1 FROM ratings WHERE ride_id = p_ride_id AND from_user_id = p_from_user AND to_user_id = p_to_user) THEN
        RAISE EXCEPTION 'RATING_ALREADY_SUBMITTED';
    END IF;

    INSERT INTO ratings (ride_id, from_user_id, to_user_id, rating, review)
    VALUES (p_ride_id, p_from_user, p_to_user, p_rating, p_review)
    RETURNING * INTO v_rating;

    UPDATE profiles 
    SET rating = (SELECT COALESCE(AVG(rating)::numeric(3,2), 0) FROM ratings WHERE to_user_id = p_to_user)
    WHERE id = p_to_user;

    RETURN row_to_json(v_rating)::jsonb;
END;
$$;

-- 8. expire_old_rides
CREATE OR REPLACE FUNCTION expire_old_rides()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_affected_ids integer[];
    v_count integer;
BEGIN
    WITH updated_rides AS (
        UPDATE rides 
        SET status = 'expired' 
        WHERE status IN ('open', 'full') AND departure_at < now() - interval '2 hours'
        RETURNING id
    )
    SELECT array_agg(id) INTO v_affected_ids FROM updated_rides;

    IF v_affected_ids IS NULL THEN RETURN 0; END IF;

    UPDATE ride_requests 
    SET status = 'expired' 
    WHERE ride_id = ANY(v_affected_ids) AND status = 'pending';

    v_count := array_length(v_affected_ids, 1);
    RETURN COALESCE(v_count, 0);
END;
$$;

-- -----------------------------------------------------------------------------
-- SECTION 4: REAL-TIME CHAT & SECURE CONTACT INFO
-- -----------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;

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

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_confirmed_participant(p_ride_id integer, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM rides WHERE id = p_ride_id AND driver_id = p_user_id) THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM ride_requests WHERE ride_id = p_ride_id AND passenger_id = p_user_id AND status IN ('accepted', 'completed')) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Participants read chat messages" ON chat_messages;
CREATE POLICY "Participants read chat messages" ON chat_messages FOR SELECT USING (
  (auth.uid() = sender_id OR auth.uid() = receiver_id) AND
  is_confirmed_participant(ride_id, auth.uid())
);

DROP POLICY IF EXISTS "Participants insert chat messages" ON chat_messages;
CREATE POLICY "Participants insert chat messages" ON chat_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  is_confirmed_participant(ride_id, sender_id) AND
  is_confirmed_participant(ride_id, receiver_id)
);

DROP POLICY IF EXISTS "Receiver update chat messages" ON chat_messages;
CREATE POLICY "Receiver update chat messages" ON chat_messages FOR UPDATE USING (
  auth.uid() = receiver_id
);

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

  IF NOT is_confirmed_participant(p_ride_id, v_caller_id) THEN
    RAISE EXCEPTION 'NOT_A_CONFIRMED_PARTICIPANT';
  END IF;

  IF NOT is_confirmed_participant(p_ride_id, p_target_user_id) THEN
    RAISE EXCEPTION 'TARGET_NOT_A_CONFIRMED_PARTICIPANT';
  END IF;

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

-- -----------------------------------------------------------------------------
-- SECTION 5: REALTIME RIDES & NOTIFICATIONS
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS rides_status_departure_idx ON rides(status, departure_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);

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

CREATE OR REPLACE FUNCTION notify_college_students_on_new_ride()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_profile profiles%ROWTYPE;
  v_origin_name text;
  v_dest_name text;
BEGIN
  SELECT * INTO v_driver_profile FROM profiles WHERE id = NEW.driver_id;
  SELECT name INTO v_origin_name FROM locations WHERE id = NEW.origin_location_id;
  SELECT name INTO v_dest_name FROM locations WHERE id = NEW.destination_location_id;

  IF v_driver_profile.college_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, reference_id)
    SELECT 
      id, 
      'new_ride', 
      'New ride on your route', 
      coalesce(v_driver_profile.name, 'A student') || ' offered a ride: ' || coalesce(v_origin_name, 'Origin') || ' → ' || coalesce(v_dest_name, 'Destination'),
      NEW.id
    FROM profiles
    WHERE college_id = v_driver_profile.college_id AND id != NEW.driver_id
    LIMIT 50;
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

-- -----------------------------------------------------------------------------
-- SECTION 6: ADMIN RBAC & ANNOUNCEMENTS
-- -----------------------------------------------------------------------------

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'super_admin'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_verification_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_verification_status_check CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended'));

CREATE TABLE IF NOT EXISTS reports (
  id serial PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reported_ride_id integer REFERENCES rides(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id serial PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  message text NOT NULL,
  target_college_id integer REFERENCES colleges(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

UPDATE profiles 
SET role = 'super_admin', verification_status = 'verified' 
WHERE email = 'prashant65001@gmail.com';



