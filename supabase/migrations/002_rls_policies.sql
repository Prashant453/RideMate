-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- colleges, campuses, locations: public read
DROP POLICY IF EXISTS "Public read colleges" ON colleges;
CREATE POLICY "Public read colleges" ON colleges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read campuses" ON campuses;
CREATE POLICY "Public read campuses" ON campuses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read locations" ON locations;
CREATE POLICY "Public read locations" ON locations FOR SELECT USING (true);

-- profiles: anyone can read, users update own
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- vehicles: public read (shown on ride cards), users manage own
DROP POLICY IF EXISTS "Public read vehicles" ON vehicles;
CREATE POLICY "Public read vehicles" ON vehicles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own vehicles" ON vehicles;
CREATE POLICY "Users insert own vehicles" ON vehicles FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users update own vehicles" ON vehicles;
CREATE POLICY "Users update own vehicles" ON vehicles FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users delete own vehicles" ON vehicles;
CREATE POLICY "Users delete own vehicles" ON vehicles FOR DELETE USING (auth.uid() = owner_id);

-- rides: public read, drivers manage own
DROP POLICY IF EXISTS "Public read rides" ON rides;
CREATE POLICY "Public read rides" ON rides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers insert own rides" ON rides;
CREATE POLICY "Drivers insert own rides" ON rides FOR INSERT WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Drivers update own rides" ON rides;
CREATE POLICY "Drivers update own rides" ON rides FOR UPDATE USING (auth.uid() = driver_id);

-- ride_requests: passengers see own + drivers see requests on their rides
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

-- ratings: public read, participants insert own
DROP POLICY IF EXISTS "Public read ratings" ON ratings;
CREATE POLICY "Public read ratings" ON ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own ratings" ON ratings;
CREATE POLICY "Users insert own ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- notifications: users see/update own only
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
