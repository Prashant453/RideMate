import { supabaseAdmin } from './supabaseAdmin';

// ── Locations & Colleges ──────────────────────────────
export async function listLocations() {
  const { data, error } = await supabaseAdmin
    .from('locations')
    .select('id, name, type')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function listColleges() {
  const { data, error } = await supabaseAdmin
    .from('colleges')
    .select('id, name, city, state')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

// ── Profile ───────────────────────────────────────────
export async function getUserProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*, colleges(*)')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  if (!data) {
    // If profile row doesn't exist yet, auto-create initial profile for authenticated user
    const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userAuth?.user?.email || '';
    const name = userAuth?.user?.user_metadata?.name || email.split('@')[0] || 'Student';
    
    const { data: newProfile, error: upsertErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, email, name, verification_status: 'pending' }, { onConflict: 'id' })
      .select('*, colleges(*)')
      .single();

    if (upsertErr) throw upsertErr;
    return { user: newProfile, college: newProfile.colleges };
  }

  return { user: data, college: data.colleges };
}

export async function updateUserProfile(userId: string, input: {
  name?: string | null;
  collegeId?: number | null;
  course?: string | null;
  year?: string | null;
  profileImage?: string | null;
  phoneNumber?: string | null;
}) {
  const updateData: Record<string, unknown> = {
    id: userId,
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.collegeId !== undefined) updateData.college_id = input.collegeId;
  if (input.course !== undefined) updateData.course = input.course;
  if (input.year !== undefined) updateData.year = input.year;
  if (input.profileImage !== undefined) updateData.profile_image = input.profileImage;
  if (input.phoneNumber !== undefined) updateData.phone_number = input.phoneNumber;
  
  // Security protection: NEVER allow modifying system fields from profile update
  delete updateData.verification_status;
  delete updateData.role;
  delete updateData.rating;
  delete updateData.total_rides;

  let { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(updateData, { onConflict: 'id' })
    .select('*, colleges(*)')
    .single();

  if (error && (error.message?.includes("phone_number") || error.code === 'PGRST204')) {
    // If phone_number column is missing in DB schema cache, retry update without phone_number
    delete updateData.phone_number;
    const retryRes = await supabaseAdmin
      .from('profiles')
      .upsert(updateData, { onConflict: 'id' })
      .select('*, colleges(*)')
      .single();
    if (retryRes.error) throw retryRes.error;
    return retryRes.data;
  }

  if (error) throw error;
  return data;
}

// ── Vehicles ──────────────────────────────────────────
export async function listVehicles(ownerId: string) {
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addVehicle(ownerId: string, input: {
  type: string;
  model: string;
  registrationLast4?: string;
  seatCapacity: number;
}) {
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .insert({
      owner_id: ownerId,
      type: input.type,
      model: input.model,
      registration_last4: input.registrationLast4 || null,
      seat_capacity: input.seatCapacity,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVehicle(ownerId: string, vehicleId: number, input: {
  type?: string;
  model?: string;
  registrationLast4?: string;
  seatCapacity?: number;
}) {
  const updateData: Record<string, unknown> = {};
  if (input.type !== undefined) updateData.type = input.type;
  if (input.model !== undefined) updateData.model = input.model;
  if (input.registrationLast4 !== undefined) updateData.registration_last4 = input.registrationLast4;
  if (input.seatCapacity !== undefined) updateData.seat_capacity = input.seatCapacity;
  
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .update(updateData)
    .eq('id', vehicleId)
    .eq('owner_id', ownerId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVehicle(ownerId: string, vehicleId: number) {
  const { error } = await supabaseAdmin
    .from('vehicles')
    .update({ is_active: false })
    .eq('id', vehicleId)
    .eq('owner_id', ownerId);
  if (error) throw error;
  return { success: true };
}

// ── Rides ─────────────────────────────────────────────
export async function searchRides(input: {
  originLocationId?: number;
  destinationLocationId?: number;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}) {
  let query = supabaseAdmin
    .from('rides')
    .select(`
      id, origin_location_id, destination_location_id, departure_at,
      available_seats, total_seats, status, notes, driver_id, vehicle_id,
      profiles!rides_driver_id_fkey(name, rating, verification_status),
      vehicles(type, model)
    `)
    .eq('status', 'open')
    .gt('available_seats', 0);
  
  if (input.originLocationId) query = query.eq('origin_location_id', input.originLocationId);
  if (input.destinationLocationId) query = query.eq('destination_location_id', input.destinationLocationId);
  if (input.from) query = query.gte('departure_at', input.from.toISOString());
  if (input.to) query = query.lte('departure_at', input.to.toISOString());
  
  query = query.order('departure_at', { ascending: true }).range(input.offset, input.offset + input.limit - 1);
  
  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []).map((ride: any) => ({
    id: ride.id,
    originLocationId: ride.origin_location_id,
    destinationLocationId: ride.destination_location_id,
    departureAt: ride.departure_at,
    availableSeats: ride.available_seats,
    totalSeats: ride.total_seats,
    status: ride.status,
    notes: ride.notes,
    driverId: ride.driver_id,
    vehicleId: ride.vehicle_id,
    driverName: ride.profiles?.name || null,
    driverRating: ride.profiles?.rating || null,
    verificationStatus: ride.profiles?.verification_status || null,
    vehicleType: ride.vehicles?.type || null,
    vehicleModel: ride.vehicles?.model || null,
  }));
}

export async function createRide(driverId: string, input: {
  vehicleId?: number;
  originLocationId: number;
  destinationLocationId: number;
  departureAt: Date;
  availableSeats: number;
  notes?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from('rides')
    .insert({
      driver_id: driverId,
      vehicle_id: input.vehicleId || null,
      origin_location_id: input.originLocationId,
      destination_location_id: input.destinationLocationId,
      departure_at: input.departureAt.toISOString(),
      total_seats: input.availableSeats,
      available_seats: input.availableSeats,
      notes: input.notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Ride Requests (via RPC) ───────────────────────────
export async function requestRideSeat(passengerId: string, rideId: number) {
  const { data, error } = await supabaseAdmin.rpc('request_ride_seat', {
    p_ride_id: rideId,
    p_passenger_id: passengerId,
  });
  if (error) {
    if (error.message?.includes('RIDE_NOT_OPEN')) throw new Error('RIDE_NOT_OPEN');
    if (error.message?.includes('CANNOT_REQUEST_OWN')) throw new Error('CANNOT_REQUEST_OWN');
    throw error;
  }
  return data;
}

export async function acceptRideRequest(requestId: number, driverId: string) {
  const { data, error } = await supabaseAdmin.rpc('accept_ride_request', {
    p_request_id: requestId,
    p_driver_id: driverId,
  });
  if (error) {
    if (error.message?.includes('RIDE_FULL')) throw new Error('RIDE_FULL');
    throw error;
  }
  return data;
}

export async function rejectRideRequest(requestId: number, driverId: string) {
  const { data, error } = await supabaseAdmin.rpc('reject_ride_request', {
    p_request_id: requestId,
    p_driver_id: driverId,
  });
  if (error) throw error;
  return data;
}

export async function cancelRideRequest(requestId: number, passengerId: string) {
  const { data, error } = await supabaseAdmin.rpc('cancel_ride_request', {
    p_request_id: requestId,
    p_passenger_id: passengerId,
  });
  if (error) throw error;
  return data;
}

export async function cancelRide(rideId: number, driverId: string) {
  const { error } = await supabaseAdmin.rpc('cancel_ride', {
    p_ride_id: rideId,
    p_driver_id: driverId,
  });
  if (error) throw error;
  return { success: true };
}

export async function completeRide(rideId: number, driverId: string) {
  const { error } = await supabaseAdmin.rpc('complete_ride', {
    p_ride_id: rideId,
    p_driver_id: driverId,
  });
  if (error) throw error;
  return { success: true };
}

// ── My Rides ──────────────────────────────────────────
export async function listUserRides(userId: string) {
  const [offeredRes, requestedRes] = await Promise.all([
    supabaseAdmin
      .from('rides')
      .select('*, vehicles(type, model)')
      .eq('driver_id', userId)
      .order('departure_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('ride_requests')
      .select('*, rides(*, vehicles(type, model))')
      .eq('passenger_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  
  if (offeredRes.error) throw offeredRes.error;
  if (requestedRes.error) throw requestedRes.error;
  
  return {
    offered: offeredRes.data || [],
    requested: (requestedRes.data || []).map((r: any) => ({ request: r, ride: r.rides })),
  };
}

// ── Ride Requests for Driver ──────────────────────────
export async function getRideRequests(rideId: number, driverId: string) {
  // First verify the caller is the driver
  const { data: ride, error: rideError } = await supabaseAdmin
    .from('rides')
    .select('driver_id')
    .eq('id', rideId)
    .single();
  if (rideError) throw rideError;
  if (ride.driver_id !== driverId) throw new Error('NOT_AUTHORIZED');
  
  const { data, error } = await supabaseAdmin
    .from('ride_requests')
    .select('*, profiles!ride_requests_passenger_id_fkey(name, rating, verification_status)')
    .eq('ride_id', rideId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── Ratings ───────────────────────────────────────────
export async function submitRating(rideId: number, fromUserId: string, toUserId: string, rating: number, review?: string) {
  const { data, error } = await supabaseAdmin.rpc('submit_rating', {
    p_ride_id: rideId,
    p_from_user: fromUserId,
    p_to_user: toUserId,
    p_rating: rating,
    p_review: review || null,
  });
  if (error) throw error;
  return data;
}

export async function getRatingsForRide(rideId: number) {
  const { data, error } = await supabaseAdmin
    .from('ratings')
    .select('*, profiles!ratings_from_user_id_fkey(name)')
    .eq('ride_id', rideId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Notifications ─────────────────────────────────────
export async function getNotifications(userId: string, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getUnreadNotificationCount(userId: string) {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(userId: string, notificationId: number) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw error;
  return { success: true };
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return { success: true };
}

// ── System ────────────────────────────────────────────
export async function expireOldRides() {
  const { data, error } = await supabaseAdmin.rpc('expire_old_rides');
  if (error) { console.error('[expire-rides]', error); return 0; }
  return data || 0;
}

// ── Contact & Chat ─────────────────────────────────────
export async function getConfirmedContactInfo(rideId: number, targetUserId: string, callerUserId: string) {
  // First verify caller and target are confirmed participants
  const [callerRes, targetRes] = await Promise.all([
    isConfirmedParticipant(rideId, callerUserId),
    isConfirmedParticipant(rideId, targetUserId),
  ]);

  if (!callerRes || !targetRes) {
    throw new Error('NOT_AUTHORIZED_FOR_CONTACT');
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('name, email, phone_number')
    .eq('id', targetUserId)
    .single();

  if (error) throw error;
  return data;
}

export async function isConfirmedParticipant(rideId: number, userId: string): Promise<boolean> {
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('driver_id')
    .eq('id', rideId)
    .single();

  if (ride && ride.driver_id === userId) return true;

  const { data: req } = await supabaseAdmin
    .from('ride_requests')
    .select('id')
    .eq('ride_id', rideId)
    .eq('passenger_id', userId)
    .in('status', ['accepted', 'completed'])
    .limit(1);

  return Boolean(req && req.length > 0);
}

export async function sendChatMessage(rideId: number, senderId: string, receiverId: string, message: string) {
  const isSenderConfirmed = await isConfirmedParticipant(rideId, senderId);
  const isReceiverConfirmed = await isConfirmedParticipant(rideId, receiverId);

  if (!isSenderConfirmed || !isReceiverConfirmed) {
    throw new Error('NOT_AUTHORIZED_FOR_CHAT');
  }

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      ride_id: rideId,
      sender_id: senderId,
      receiver_id: receiverId,
      message: message.trim(),
    })
    .select()
    .single();

  if (error) throw error;

  // Send notification to receiver
  await supabaseAdmin.from('notifications').insert({
    user_id: receiverId,
    type: 'chat_message',
    title: 'New ride message',
    message: message.length > 50 ? `${message.slice(0, 47)}...` : message,
    reference_id: rideId,
  });

  return data;
}

export async function getChatHistory(rideId: number, otherUserId: string, currentUserId: string) {
  const isCurrentConfirmed = await isConfirmedParticipant(rideId, currentUserId);
  if (!isCurrentConfirmed) throw new Error('NOT_AUTHORIZED_FOR_CHAT');

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('ride_id', rideId)
    .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function markChatRead(rideId: number, otherUserId: string, currentUserId: string) {
  const { error } = await supabaseAdmin
    .from('chat_messages')
    .update({ is_read: true })
    .eq('ride_id', rideId)
    .eq('sender_id', otherUserId)
    .eq('receiver_id', currentUserId)
    .eq('is_read', false);

  if (error) throw error;
  return { success: true };
}

