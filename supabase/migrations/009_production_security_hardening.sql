-- =============================================================================
-- Migration 009: Production Security Hardening & Concurrency Protection
-- =============================================================================

-- 1. Database-level Profile Field Protection Trigger
-- Prevents users from tampering with verification_status, role, rating, or total_rides
CREATE OR REPLACE FUNCTION protect_profile_fields()
RETURNS trigger AS $$
BEGIN
  -- If invoked by an authenticated client (not service_role / postgres superuser)
  IF current_user IN ('authenticated', 'anon') OR (auth.role() = 'authenticated') THEN
    -- A regular user can NEVER modify their own role, verification_status, rating, or total_rides
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ) THEN
      NEW.role := OLD.role;
      NEW.verification_status := OLD.verification_status;
      NEW.rating := OLD.rating;
      NEW.total_rides := OLD.total_rides;
    END IF;

    -- An admin cannot make themselves or anyone else super_admin (only super_admin can)
    IF NEW.role = 'super_admin' AND OLD.role != 'super_admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
      ) THEN
        NEW.role := OLD.role;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_profile_fields();

-- 2. Revoke Direct SELECT on Private Contact Info (phone_number)
-- Phone numbers must be fetched via get_confirmed_contact_info RPC or service_role
REVOKE SELECT (phone_number) ON profiles FROM anon, authenticated;

-- 3. Lock Down ride_requests from Client-Side Tampering
-- Prevent regular users from updating request status directly via Supabase client
DROP POLICY IF EXISTS "Passengers update own requests" ON ride_requests;

-- 4. Atomic Ride Request Creation with Duplicate / Re-request Protection
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
    -- Verify ride exists
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RIDE_NOT_FOUND';
    END IF;

    -- Status must be 'open'
    IF v_ride.status != 'open' OR v_ride.available_seats <= 0 THEN
        RAISE EXCEPTION 'RIDE_NOT_OPEN';
    END IF;

    -- Passenger cannot be the driver
    IF v_ride.driver_id = p_passenger_id THEN
        RAISE EXCEPTION 'PASSENGER_IS_DRIVER';
    END IF;

    -- Check for an existing active request (pending or accepted)
    SELECT * INTO v_existing_request FROM ride_requests 
    WHERE ride_id = p_ride_id AND passenger_id = p_passenger_id AND status IN ('pending', 'accepted');
    
    IF FOUND THEN
        RETURN jsonb_build_object('already_requested', true, 'request', row_to_json(v_existing_request));
    END IF;

    -- Insert or reactivate previously cancelled/rejected request idempotently
    INSERT INTO ride_requests (ride_id, passenger_id, status, updated_at)
    VALUES (p_ride_id, p_passenger_id, 'pending', now())
    ON CONFLICT (ride_id, passenger_id) 
    DO UPDATE SET status = 'pending', updated_at = now()
    WHERE ride_requests.status IN ('cancelled', 'rejected', 'expired')
    RETURNING * INTO v_new_request;

    -- Notify the driver
    INSERT INTO notifications (user_id, type, title, message, reference_id)
    VALUES (v_ride.driver_id, 'ride_request', 'New seat request', 'A student has requested a seat on your ride.', p_ride_id);

    RETURN jsonb_build_object('already_requested', false, 'request', row_to_json(v_new_request));
END;
$$;

-- 5. Atomic Ride Acceptance with Exclusive Row Locking
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
    -- 1. Lock the request row exclusively to prevent concurrent acceptance or cancellation
    SELECT * INTO v_request FROM ride_requests 
    WHERE id = p_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REQUEST_NOT_FOUND';
    END IF;

    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'REQUEST_NOT_PENDING';
    END IF;

    -- 2. Lock the ride row exclusively to serialize seat reservation
    SELECT * INTO v_ride FROM rides 
    WHERE id = v_request.ride_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RIDE_NOT_FOUND';
    END IF;

    IF v_ride.driver_id != p_driver_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_DRIVER';
    END IF;

    -- 3. Check seat availability under lock
    IF v_ride.available_seats <= 0 THEN
        RAISE EXCEPTION 'RIDE_FULL';
    END IF;

    -- 4. Decrement available seats atomically
    UPDATE rides 
    SET available_seats = available_seats - 1,
        status = CASE WHEN available_seats - 1 = 0 THEN 'full' ELSE status END,
        updated_at = now()
    WHERE id = v_request.ride_id AND available_seats > 0
    RETURNING available_seats INTO v_updated_seats;

    IF v_updated_seats IS NULL THEN
        RAISE EXCEPTION 'RIDE_FULL';
    END IF;

    -- 5. Update request status to accepted
    UPDATE ride_requests 
    SET status = 'accepted', updated_at = now() 
    WHERE id = p_request_id
    RETURNING * INTO v_updated_request;

    -- 6. Notify the passenger
    INSERT INTO notifications (user_id, type, title, message, reference_id)
    VALUES (v_request.passenger_id, 'request_accepted', 'Seat confirmed!', 'The driver has accepted your seat request.', v_request.ride_id);

    RETURN row_to_json(v_updated_request)::jsonb;
END;
$$;

-- 6. Atomic Request Cancellation with Exact-Once Seat Restoration
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
    -- 1. Lock request row exclusively
    SELECT * INTO v_request FROM ride_requests 
    WHERE id = p_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REQUEST_NOT_FOUND';
    END IF;

    IF v_request.passenger_id != p_passenger_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_PASSENGER';
    END IF;

    IF v_request.status NOT IN ('pending', 'accepted') THEN
        RAISE EXCEPTION 'REQUEST_CANNOT_BE_CANCELLED';
    END IF;

    -- 2. If request was accepted, lock ride and restore exactly one seat capped at total_seats
    IF v_request.status = 'accepted' THEN
        SELECT * INTO v_ride FROM rides WHERE id = v_request.ride_id FOR UPDATE;

        UPDATE rides 
        SET available_seats = LEAST(total_seats, available_seats + 1), 
            status = 'open',
            updated_at = now()
        WHERE id = v_request.ride_id;
    END IF;

    -- 3. Update request status to cancelled
    UPDATE ride_requests 
    SET status = 'cancelled', updated_at = now() 
    WHERE id = p_request_id
    RETURNING * INTO v_updated_request;

    -- 4. Notify driver
    SELECT * INTO v_ride FROM rides WHERE id = v_request.ride_id;
    INSERT INTO notifications (user_id, type, title, message, reference_id)
    VALUES (v_ride.driver_id, 'request_cancelled', 'Seat request cancelled', 'A passenger has cancelled their seat request.', v_request.ride_id);

    RETURN row_to_json(v_updated_request)::jsonb;
END;
$$;

-- 7. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
