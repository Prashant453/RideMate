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
    -- Verify ride exists
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RIDE_NOT_FOUND';
    END IF;

    -- Status must be 'open'
    IF v_ride.status != 'open' THEN
        RAISE EXCEPTION 'RIDE_NOT_OPEN';
    END IF;

    -- Passenger cannot be driver
    IF v_ride.driver_id = p_passenger_id THEN
        RAISE EXCEPTION 'PASSENGER_IS_DRIVER';
    END IF;

    -- Check no existing active request
    SELECT * INTO v_existing_request FROM ride_requests 
    WHERE ride_id = p_ride_id AND passenger_id = p_passenger_id AND status IN ('pending', 'accepted');
    
    IF FOUND THEN
        RETURN jsonb_build_object('already_requested', true, 'request', row_to_json(v_existing_request));
    END IF;

    -- Insert request
    INSERT INTO ride_requests (ride_id, passenger_id, status)
    VALUES (p_ride_id, p_passenger_id, 'pending')
    RETURNING * INTO v_new_request;

    -- Notify driver
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
    -- Verify request
    SELECT * INTO v_request FROM ride_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'REQUEST_NOT_FOUND';
    END IF;

    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'REQUEST_NOT_PENDING';
    END IF;

    -- Verify driver
    SELECT * INTO v_ride FROM rides WHERE id = v_request.ride_id;
    IF v_ride.driver_id != p_driver_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_DRIVER';
    END IF;

    -- Update ride seats
    UPDATE rides SET available_seats = available_seats - 1 
    WHERE id = v_request.ride_id AND available_seats > 0
    RETURNING available_seats INTO v_updated_seats;

    IF v_updated_seats IS NULL THEN
        RAISE EXCEPTION 'RIDE_FULL';
    END IF;

    -- Mark ride full if 0 seats
    IF v_updated_seats = 0 THEN
        UPDATE rides SET status = 'full' WHERE id = v_request.ride_id;
    END IF;

    -- Update request
    UPDATE ride_requests SET status = 'accepted' WHERE id = p_request_id
    RETURNING * INTO v_updated_request;

    -- Notify passenger
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
    -- Verify request
    SELECT * INTO v_request FROM ride_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'REQUEST_NOT_FOUND';
    END IF;

    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'REQUEST_NOT_PENDING';
    END IF;

    -- Verify driver
    SELECT * INTO v_ride FROM rides WHERE id = v_request.ride_id;
    IF v_ride.driver_id != p_driver_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_DRIVER';
    END IF;

    -- Update request
    UPDATE ride_requests SET status = 'rejected' WHERE id = p_request_id
    RETURNING * INTO v_updated_request;

    -- Notify passenger
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
    -- Verify request
    SELECT * INTO v_request FROM ride_requests WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'REQUEST_NOT_FOUND';
    END IF;

    IF v_request.passenger_id != p_passenger_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_PASSENGER';
    END IF;

    IF v_request.status NOT IN ('pending', 'accepted') THEN
        RAISE EXCEPTION 'REQUEST_CANNOT_BE_CANCELLED';
    END IF;

    -- Update ride seats if was accepted
    IF v_request.status = 'accepted' THEN
        UPDATE rides 
        SET available_seats = available_seats + 1, 
            status = CASE WHEN status = 'full' THEN 'open' ELSE status END
        WHERE id = v_request.ride_id;
    END IF;

    -- Update request
    UPDATE ride_requests SET status = 'cancelled' WHERE id = p_request_id
    RETURNING * INTO v_updated_request;

    -- Notify driver
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
    -- Verify ride
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RIDE_NOT_FOUND';
    END IF;

    IF v_ride.driver_id != p_driver_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_DRIVER';
    END IF;

    IF v_ride.status NOT IN ('open', 'full') THEN
        RAISE EXCEPTION 'RIDE_CANNOT_BE_CANCELLED';
    END IF;

    -- Update ride
    UPDATE rides SET status = 'cancelled' WHERE id = p_ride_id;

    -- Update requests and notify passengers
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
    -- Verify ride
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RIDE_NOT_FOUND';
    END IF;

    IF v_ride.driver_id != p_driver_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED_DRIVER';
    END IF;

    IF v_ride.status NOT IN ('open', 'full', 'in_progress') THEN
        RAISE EXCEPTION 'RIDE_CANNOT_BE_COMPLETED';
    END IF;

    -- Update ride
    UPDATE rides SET status = 'completed' WHERE id = p_ride_id;

    -- Process requests
    UPDATE ride_requests SET status = 'completed' WHERE ride_id = p_ride_id AND status = 'accepted';
    UPDATE ride_requests SET status = 'expired' WHERE ride_id = p_ride_id AND status = 'pending';

    -- Notify passengers and update total_rides
    FOR v_req IN SELECT * FROM ride_requests WHERE ride_id = p_ride_id AND status = 'completed' LOOP
        INSERT INTO notifications (user_id, type, title, message, reference_id)
        VALUES (v_req.passenger_id, 'ride_completed', 'Ride completed', 'The ride has been completed.', p_ride_id);
        
        UPDATE profiles SET total_rides = total_rides + 1 WHERE id = v_req.passenger_id;
    END LOOP;

    -- Notify driver and update total_rides
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
    -- Verify ride
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'RIDE_NOT_FOUND';
    END IF;

    IF v_ride.status != 'completed' THEN
        RAISE EXCEPTION 'RIDE_NOT_COMPLETED';
    END IF;

    -- Check participants
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

    -- Check duplicates
    IF EXISTS (SELECT 1 FROM ratings WHERE ride_id = p_ride_id AND from_user_id = p_from_user AND to_user_id = p_to_user) THEN
        RAISE EXCEPTION 'RATING_ALREADY_SUBMITTED';
    END IF;

    -- Insert rating
    INSERT INTO ratings (ride_id, from_user_id, to_user_id, rating, review)
    VALUES (p_ride_id, p_from_user, p_to_user, p_rating, p_review)
    RETURNING * INTO v_rating;

    -- Update average rating
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
    -- Get affected ride IDs and update rides
    WITH updated_rides AS (
        UPDATE rides 
        SET status = 'expired' 
        WHERE status IN ('open', 'full') AND departure_at < now() - interval '2 hours'
        RETURNING id
    )
    SELECT array_agg(id) INTO v_affected_ids FROM updated_rides;

    -- If no rides updated, return 0
    IF v_affected_ids IS NULL THEN
        RETURN 0;
    END IF;

    -- Update requests
    UPDATE ride_requests 
    SET status = 'expired' 
    WHERE ride_id = ANY(v_affected_ids) AND status = 'pending';

    v_count := array_length(v_affected_ids, 1);
    RETURN COALESCE(v_count, 0);
END;
$$;
