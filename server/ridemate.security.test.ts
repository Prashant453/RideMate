import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./trpc";
import { supabaseAdmin } from "./supabaseAdmin";
import { updateUserProfile } from "./db";

describe("RideMate Security & Hardening Suite (Phase 2)", () => {
  let userAId: string;
  let userBId: string;
  let userCId: string;
  let adminId: string;

  let testRideId: number;
  let testSingleSeatRideId: number;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Create real test users in auth.users (cascades to profiles via trigger)
    const { data: uA } = await supabaseAdmin.auth.admin.createUser({
      email: `test_user_a_${timestamp}@dbuu.ac.in`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { name: "Test Driver A" },
    });
    userAId = uA.user!.id;

    const { data: uB } = await supabaseAdmin.auth.admin.createUser({
      email: `test_user_b_${timestamp}@dbuu.ac.in`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { name: "Test Passenger B" },
    });
    userBId = uB.user!.id;

    const { data: uC } = await supabaseAdmin.auth.admin.createUser({
      email: `test_user_c_${timestamp}@dbuu.ac.in`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { name: "Test Passenger C" },
    });
    userCId = uC.user!.id;

    const { data: uAdmin } = await supabaseAdmin.auth.admin.createUser({
      email: `test_admin_${timestamp}@dbuu.ac.in`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { name: "Test Admin" },
    });
    adminId = uAdmin.user!.id;

    // Set role for admin
    await supabaseAdmin.from("profiles").update({ role: "admin", verification_status: "verified" }).eq("id", adminId);

    // 2. Fetch origin and destination locations
    const { data: locs } = await supabaseAdmin.from("locations").select("id").limit(2);
    const originId = locs?.[0]?.id || 1;
    const destId = locs?.[1]?.id || 2;

    // 3. Create a test ride with 2 seats
    const { data: ride1 } = await supabaseAdmin.from("rides").insert({
      driver_id: userAId,
      origin_location_id: originId,
      destination_location_id: destId,
      departure_at: new Date(Date.now() + 86400000).toISOString(),
      total_seats: 2,
      available_seats: 2,
      status: "open",
    }).select().single();
    testRideId = ride1.id;

    // 4. Create a single-seat test ride for concurrency testing
    const { data: ride2 } = await supabaseAdmin.from("rides").insert({
      driver_id: userAId,
      origin_location_id: originId,
      destination_location_id: destId,
      departure_at: new Date(Date.now() + 86400000).toISOString(),
      total_seats: 1,
      available_seats: 1,
      status: "open",
    }).select().single();
    testSingleSeatRideId = ride2.id;
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    if (testRideId) await supabaseAdmin.from("rides").delete().eq("id", testRideId);
    if (testSingleSeatRideId) await supabaseAdmin.from("rides").delete().eq("id", testSingleSeatRideId);

    // Delete created test auth users (cascades to profiles, notifications, etc.)
    if (userAId) await supabaseAdmin.auth.admin.deleteUser(userAId);
    if (userBId) await supabaseAdmin.auth.admin.deleteUser(userBId);
    if (userCId) await supabaseAdmin.auth.admin.deleteUser(userCId);
    if (adminId) await supabaseAdmin.auth.admin.deleteUser(adminId);
  }, 30000);

  // -- 1. RBAC: User -> Admin API Rejected ------------------------------------
  it("1. USER calling admin API is rejected with FORBIDDEN", async () => {
    const userCtx: Context = { user: { id: userBId, email: "test_user_b@dbuu.ac.in", role: "user" } };
    const caller = appRouter.createCaller(userCtx);

    await expect(caller.admin.stats()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Admin privileges required",
    });
  });

  // -- 2. RBAC: User -> Super Admin API Rejected ------------------------------
  it("2. USER calling SUPER_ADMIN API is rejected with FORBIDDEN", async () => {
    const userCtx: Context = { user: { id: userBId, email: "test_user_b@dbuu.ac.in", role: "user" } };
    const caller = appRouter.createCaller(userCtx);

    await expect(
      caller.superAdmin.updateRole({ userId: userBId, newRole: "admin" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Super Admin privileges required",
    });
  });

  // -- 3. RBAC: Admin -> Super Admin Operation Rejected -----------------------
  it("3. ADMIN calling SUPER_ADMIN-only operation is rejected with FORBIDDEN", async () => {
    const adminCtx: Context = { user: { id: adminId, email: "test_admin@dbuu.ac.in", role: "admin" } };
    const caller = appRouter.createCaller(adminCtx);

    await expect(
      caller.superAdmin.updateRole({ userId: userBId, newRole: "super_admin" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Super Admin privileges required",
    });
  });

  // -- 4. Contact Privacy: Unconfirmed User Access Rejected -------------------
  it("4. USER cannot read another user's private contact info without confirmed ride", async () => {
    const { data, error } = await supabaseAdmin.rpc("get_confirmed_contact_info", {
      p_ride_id: testRideId,
      p_target_user_id: userAId,
    });

    // When called unauthenticated or for unconfirmed participant, RPC rejects
    expect(error || !data).toBeTruthy();
  });

  // -- 5. Notification Isolation: Cannot Access Other User's Notifications ----
  it("5. USER cannot modify or mark another user's notification", async () => {
    // Insert a notification specifically for user A
    const { data: notif } = await supabaseAdmin.from("notifications").insert({
      user_id: userAId,
      type: "system",
      title: "Private Notification",
      message: "Confidential message for user A",
      is_read: false,
    }).select().single();

    // User B attempts to mark User A's notification as read via tRPC
    const userBCtx: Context = { user: { id: userBId, email: "test_user_b@dbuu.ac.in", role: "user" } };
    const callerB = appRouter.createCaller(userBCtx);
    await callerB.notifications.markRead({ id: notif.id });

    // Verify User A's notification remains unread
    const { data: updatedNotif } = await supabaseAdmin
      .from("notifications")
      .select("is_read")
      .eq("id", notif.id)
      .single();

    expect(updatedNotif?.is_read).toBe(false);

    // Clean up
    await supabaseAdmin.from("notifications").delete().eq("id", notif.id);
  });

  // -- 6. Chat Authorization: Unauthorized User Rejected ----------------------
  it("6. USER cannot send chat messages to a ride they are not confirmed on", async () => {
    const userBCtx: Context = { user: { id: userBId, email: "test_user_b@dbuu.ac.in", role: "user" } };
    const callerB = appRouter.createCaller(userBCtx);

    await expect(
      callerB.chat.send({
        rideId: testRideId,
        receiverId: userAId,
        message: "Unauthorized greeting",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Not authorized for chat on this ride",
    });
  });

  // -- 7. Verification Authorization: User Cannot Self-Promote or Verify ------
  it("7. USER cannot modify verification_status or role through profile update", async () => {
    // Attempt to update verification status and role via updateUserProfile
    const payload: any = {
      name: "User B Modified",
      verification_status: "verified",
      role: "admin",
    };

    await updateUserProfile(userBId, payload);

    // Fetch user B profile from database
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, verification_status")
      .eq("id", userBId)
      .single();

    expect(profile?.role).toBe("user");
    expect(profile?.verification_status).toBe("pending");
  });

  // -- 8. Duplicate Ride Request Protection (Idempotency) ---------------------
  it("8. Duplicate ride request is handled safely and idempotently", async () => {
    // First request
    const { data: firstRes, error: firstErr } = await supabaseAdmin.rpc("request_ride_seat", {
      p_ride_id: testRideId,
      p_passenger_id: userBId,
    });
    expect(firstErr).toBeNull();
    expect(firstRes.already_requested).toBe(false);

    // Second request for the same ride by the same user
    const { data: secondRes, error: secondErr } = await supabaseAdmin.rpc("request_ride_seat", {
      p_ride_id: testRideId,
      p_passenger_id: userBId,
    });
    expect(secondErr).toBeNull();
    expect(secondRes.already_requested).toBe(true);

    // Verify only 1 row exists in ride_requests for this user and ride
    const { data: requests } = await supabaseAdmin
      .from("ride_requests")
      .select("id")
      .eq("ride_id", testRideId)
      .eq("passenger_id", userBId);

    expect(requests?.length).toBe(1);
  });

  // -- 9. Final-Seat Concurrent Booking: Exactly One Succeeds -----------------
  it("9. Concurrently booking the final available seat allows only one passenger to succeed", async () => {
    // On the single-seat ride, create pending requests for User B and User C
    const { data: reqB } = await supabaseAdmin.rpc("request_ride_seat", {
      p_ride_id: testSingleSeatRideId,
      p_passenger_id: userBId,
    });
    const { data: reqC } = await supabaseAdmin.rpc("request_ride_seat", {
      p_ride_id: testSingleSeatRideId,
      p_passenger_id: userCId,
    });

    const requestIdB = reqB.request.id;
    const requestIdC = reqC.request.id;

    // Both requests attempt to be accepted concurrently
    const results = await Promise.allSettled([
      supabaseAdmin.rpc("accept_ride_request", { p_request_id: requestIdB, p_driver_id: userAId }),
      supabaseAdmin.rpc("accept_ride_request", { p_request_id: requestIdC, p_driver_id: userAId }),
    ]);

    const successes = results.filter(
      (r) => r.status === "fulfilled" && !r.value.error
    );
    const failures = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.error?.message?.includes("RIDE_FULL"))
    );

    // Exactly 1 must succeed, and exactly 1 must receive RIDE_FULL
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Check ride seats: available seats must be exactly 0, never negative
    const { data: ride } = await supabaseAdmin
      .from("rides")
      .select("available_seats, status")
      .eq("id", testSingleSeatRideId)
      .single();

    expect(ride?.available_seats).toBe(0);
    expect(ride?.status).toBe("full");
  });

  // -- 10. Cancellation: Seat Restored Exactly Once ---------------------------
  it("10. Cancellation of an accepted request restores seat exactly once", async () => {
    // Find the accepted request on testSingleSeatRideId
    const { data: acceptedReq } = await supabaseAdmin
      .from("ride_requests")
      .select("id, passenger_id")
      .eq("ride_id", testSingleSeatRideId)
      .eq("status", "accepted")
      .single();

    expect(acceptedReq).toBeTruthy();

    // Passenger cancels their request
    const { data: cancelRes, error: cancelErr } = await supabaseAdmin.rpc("cancel_ride_request", {
      p_request_id: acceptedReq!.id,
      p_passenger_id: acceptedReq!.passenger_id,
    });
    expect(cancelErr).toBeNull();
    expect(cancelRes.status).toBe("cancelled");

    // Check that available seats was restored to 1 and status back to 'open'
    const { data: rideAfterFirstCancel } = await supabaseAdmin
      .from("rides")
      .select("available_seats, total_seats, status")
      .eq("id", testSingleSeatRideId)
      .single();

    expect(rideAfterFirstCancel?.available_seats).toBe(1);
    expect(rideAfterFirstCancel?.status).toBe("open");

    // Attempting to cancel the same request a second time must be rejected
    const { error: secondCancelErr } = await supabaseAdmin.rpc("cancel_ride_request", {
      p_request_id: acceptedReq!.id,
      p_passenger_id: acceptedReq!.passenger_id,
    });
    expect(secondCancelErr?.message).toContain("REQUEST_CANNOT_BE_CANCELLED");

    // Check that available seats did NOT increase again (remains 1, <= total_seats)
    const { data: rideAfterSecondCancel } = await supabaseAdmin
      .from("rides")
      .select("available_seats, total_seats")
      .eq("id", testSingleSeatRideId)
      .single();

    expect(rideAfterSecondCancel?.available_seats).toBe(1);
    expect(rideAfterSecondCancel?.available_seats).toBeLessThanOrEqual(rideAfterSecondCancel?.total_seats!);
  });
});
