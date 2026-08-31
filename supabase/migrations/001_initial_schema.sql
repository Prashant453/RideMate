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
