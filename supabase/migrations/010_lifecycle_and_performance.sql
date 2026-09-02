-- =============================================================================
-- Migration 010: Lifecycle Edge-Case Safeguards & Targeted Performance Indexes
-- =============================================================================

-- 1. Targeted Performance Indexes
CREATE INDEX IF NOT EXISTS ride_requests_ride_created_idx ON ride_requests(ride_id, created_at ASC);
CREATE INDEX IF NOT EXISTS ride_requests_passenger_created_idx ON ride_requests(passenger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_ride_timeline_idx ON chat_messages(ride_id, created_at ASC);
CREATE INDEX IF NOT EXISTS announcements_college_created_idx ON announcements(target_college_id, created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_verification_status_idx ON profiles(verification_status);

-- 2. Atomic cancel_ride with Row Locking
CREATE OR REPLACE FUNCTION cancel_ride(p_ride_id integer, p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ride rides%ROWTYPE;
    v_req ride_requests%ROWTYPE;
BEGIN
    -- Exclusively lock the ride row to prevent race conditions with completion or requests
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RIDE_NOT_FOUND';
    END IF;

    IF v_ride.driver_id != p_driver_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_DRIVER';
    END IF;

    IF v_ride.status NOT IN ('open', 'full') THEN
        RAISE EXCEPTION 'RIDE_CANNOT_BE_CANCELLED';
    END IF;

    -- Update ride status and zero out available seats
    UPDATE rides 
    SET status = 'cancelled', available_seats = 0, updated_at = now() 
    WHERE id = p_ride_id;

    -- Cancel all active requests and notify passengers
    FOR v_req IN 
      SELECT * FROM ride_requests 
      WHERE ride_id = p_ride_id AND status IN ('pending', 'accepted') 
      FOR UPDATE 
    LOOP
        UPDATE ride_requests SET status = 'cancelled', updated_at = now() WHERE id = v_req.id;
        
        INSERT INTO notifications (user_id, type, title, message, reference_id)
        VALUES (v_req.passenger_id, 'ride_cancelled', 'Ride cancelled', 'The driver has cancelled the ride.', p_ride_id);
    END LOOP;
END;
$$;

-- 3. Atomic complete_ride with Row Locking (Idempotency & Exact-Once Stats)
CREATE OR REPLACE FUNCTION complete_ride(p_ride_id integer, p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ride rides%ROWTYPE;
    v_req ride_requests%ROWTYPE;
BEGIN
    -- Exclusively lock ride row
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RIDE_NOT_FOUND';
    END IF;

    IF v_ride.driver_id != p_driver_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_DRIVER';
    END IF;

    IF v_ride.status NOT IN ('open', 'full', 'in_progress') THEN
        RAISE EXCEPTION 'RIDE_CANNOT_BE_COMPLETED';
    END IF;

    -- Mark ride completed
    UPDATE rides 
    SET status = 'completed', available_seats = 0, updated_at = now() 
    WHERE id = p_ride_id;

    -- Transition accepted requests to completed, notify passengers, increment stats exactly once
    FOR v_req IN 
      SELECT * FROM ride_requests 
      WHERE ride_id = p_ride_id AND status = 'accepted' 
      FOR UPDATE 
    LOOP
        UPDATE ride_requests SET status = 'completed', updated_at = now() WHERE id = v_req.id;
        
        INSERT INTO notifications (user_id, type, title, message, reference_id)
        VALUES (v_req.passenger_id, 'ride_completed', 'Ride completed', 'Your ride has concluded.', p_ride_id);

        UPDATE profiles SET total_rides = total_rides + 1, updated_at = now() WHERE id = v_req.passenger_id;
    END LOOP;

    -- Expire any remaining pending requests
    UPDATE ride_requests 
    SET status = 'expired', updated_at = now() 
    WHERE ride_id = p_ride_id AND status = 'pending';

    -- Increment driver total_rides exactly once
    UPDATE profiles SET total_rides = total_rides + 1, updated_at = now() WHERE id = p_driver_id;
END;
$$;

-- 4. Atomic start_ride (OPEN/FULL -> IN_PROGRESS)
CREATE OR REPLACE FUNCTION start_ride(p_ride_id integer, p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ride rides%ROWTYPE;
    v_req ride_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RIDE_NOT_FOUND';
    END IF;

    IF v_ride.driver_id != p_driver_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_DRIVER';
    END IF;

    IF v_ride.status NOT IN ('open', 'full') THEN
        RAISE EXCEPTION 'RIDE_CANNOT_BE_STARTED';
    END IF;

    UPDATE rides SET status = 'in_progress', updated_at = now() WHERE id = p_ride_id;

    -- Notify accepted passengers that the ride has started
    FOR v_req IN 
      SELECT * FROM ride_requests 
      WHERE ride_id = p_ride_id AND status = 'accepted' 
    LOOP
        INSERT INTO notifications (user_id, type, title, message, reference_id)
        VALUES (v_req.passenger_id, 'ride_started', 'Ride underway', 'Your driver has started the trip.', p_ride_id);
    END LOOP;
END;
$$;

-- 5. Notification Maintenance Function
CREATE OR REPLACE FUNCTION cleanup_old_notifications(p_days_old integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    DELETE FROM notifications
    WHERE is_read = true 
      AND created_at < now() - (p_days_old || ' days')::interval;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
