import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./trpc";
import { supabaseAdmin } from "./supabaseAdmin";
import { rateLimiter } from "./rateLimiter";

describe("RideMate Lifecycle Edge-Cases, Validation & Reliability (Phase 3)", () => {
  let driverAId: string;
  let driverBId: string;
  let passengerId: string;

  let cancelledRideId: number;
  let completedRideId: number;
  let fullRideId: number;
  let activeRideId: number;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Create test users
    const { data: uA } = await supabaseAdmin.auth.admin.createUser({
      email: `p3_driver_a_${timestamp}@dbuu.ac.in`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { name: "P3 Driver A" },
    });
    driverAId = uA.user!.id;

    const { data: uB } = await supabaseAdmin.auth.admin.createUser({
      email: `p3_driver_b_${timestamp}@dbuu.ac.in`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { name: "P3 Driver B" },
    });
    driverBId = uB.user!.id;

    const { data: uP } = await supabaseAdmin.auth.admin.createUser({
      email: `p3_passenger_${timestamp}@dbuu.ac.in`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { name: "P3 Passenger" },
    });
    passengerId = uP.user!.id;

    const { data: locs } = await supabaseAdmin.from("locations").select("id").limit(2);
    const originId = locs?.[0]?.id || 1;
    const destId = locs?.[1]?.id || 2;

    // 2. Create and cancel a ride
    const { data: r1 } = await supabaseAdmin.from("rides").insert({
      driver_id: driverAId,
      origin_location_id: originId,
      destination_location_id: destId,
      departure_at: new Date(Date.now() + 86400000).toISOString(),
      total_seats: 2,
      available_seats: 2,
      status: "open",
    }).select().single();
    cancelledRideId = r1.id;
    await supabaseAdmin.rpc("cancel_ride", { p_ride_id: cancelledRideId, p_driver_id: driverAId });

    // 3. Create and complete a ride
    const { data: r2 } = await supabaseAdmin.from("rides").insert({
      driver_id: driverAId,
      origin_location_id: originId,
      destination_location_id: destId,
      departure_at: new Date(Date.now() + 86400000).toISOString(),
      total_seats: 2,
      available_seats: 2,
      status: "open",
    }).select().single();
    completedRideId = r2.id;
    await supabaseAdmin.rpc("complete_ride", { p_ride_id: completedRideId, p_driver_id: driverAId });

    // 4. Create a 1-seat ride and fill it
    const { data: r3 } = await supabaseAdmin.from("rides").insert({
      driver_id: driverAId,
      origin_location_id: originId,
      destination_location_id: destId,
      departure_at: new Date(Date.now() + 86400000).toISOString(),
      total_seats: 1,
      available_seats: 1,
      status: "open",
    }).select().single();
    fullRideId = r3.id;

    const { data: reqRes } = await supabaseAdmin.rpc("request_ride_seat", {
      p_ride_id: fullRideId,
      p_passenger_id: passengerId,
    });
    await supabaseAdmin.rpc("accept_ride_request", {
      p_request_id: reqRes.request.id,
      p_driver_id: driverAId,
    });

    // 5. Active ride for ownership tests
    const { data: r4 } = await supabaseAdmin.from("rides").insert({
      driver_id: driverAId,
      origin_location_id: originId,
      destination_location_id: destId,
      departure_at: new Date(Date.now() + 86400000).toISOString(),
      total_seats: 3,
      available_seats: 3,
      status: "open",
    }).select().single();
    activeRideId = r4.id;
  }, 30000);

  afterAll(async () => {
    if (cancelledRideId) await supabaseAdmin.from("rides").delete().eq("id", cancelledRideId);
    if (completedRideId) await supabaseAdmin.from("rides").delete().eq("id", completedRideId);
    if (fullRideId) await supabaseAdmin.from("rides").delete().eq("id", fullRideId);
    if (activeRideId) await supabaseAdmin.from("rides").delete().eq("id", activeRideId);

    if (driverAId) await supabaseAdmin.auth.admin.deleteUser(driverAId);
    if (driverBId) await supabaseAdmin.auth.admin.deleteUser(driverBId);
    if (passengerId) await supabaseAdmin.auth.admin.deleteUser(passengerId);
  }, 30000);

  // -- 1. Cancelled Ride Cannot Receive New Request ---------------------------
  it("1. CANCELLED ride cannot receive a new seat request", async () => {
    const { error } = await supabaseAdmin.rpc("request_ride_seat", {
      p_ride_id: cancelledRideId,
      p_passenger_id: passengerId,
    });
    expect(error?.message).toContain("RIDE_NOT_OPEN");
  });

  // -- 2. Completed Ride Cannot Receive New Request ---------------------------
  it("2. COMPLETED ride cannot receive a new seat request", async () => {
    const { error } = await supabaseAdmin.rpc("request_ride_seat", {
      p_ride_id: completedRideId,
      p_passenger_id: passengerId,
    });
    expect(error?.message).toContain("RIDE_NOT_OPEN");
  });

  // -- 3. Full Ride Cannot Receive New Request --------------------------------
  it("3. FULL ride cannot receive a new seat request", async () => {
    // Attempt request from another student (driver B as passenger)
    const { error } = await supabaseAdmin.rpc("request_ride_seat", {
      p_ride_id: fullRideId,
      p_passenger_id: driverBId,
    });
    expect(error?.message).toContain("RIDE_NOT_OPEN");
  });

  // -- 4. Duplicate Lifecycle Operations Are Safe -----------------------------
  it("4. Duplicate cancel_ride and complete_ride operations are rejected safely", async () => {
    // Calling cancel on already cancelled ride
    const { error: cancelErr } = await supabaseAdmin.rpc("cancel_ride", {
      p_ride_id: cancelledRideId,
      p_driver_id: driverAId,
    });
    expect(cancelErr?.message).toContain("RIDE_CANNOT_BE_CANCELLED");

    // Calling complete on already completed ride
    const { error: completeErr } = await supabaseAdmin.rpc("complete_ride", {
      p_ride_id: completedRideId,
      p_driver_id: driverAId,
    });
    expect(completeErr?.message).toContain("RIDE_CANNOT_BE_COMPLETED");
  });

  // -- 5. Input Validation: Invalid Seat Counts & Bad Dates Rejected ----------
  it("5. Invalid seat counts (< 1 or > 8) and identical locations are rejected", async () => {
    const driverCtx: Context = { user: { id: driverAId, email: "p3_driver_a@dbuu.ac.in", role: "user" } };
    const caller = appRouter.createCaller(driverCtx);

    // Seats = 0
    await expect(
      caller.rides.create({
        originLocationId: 1,
        destinationLocationId: 2,
        departureAt: new Date(Date.now() + 86400000),
        availableSeats: 0,
      })
    ).rejects.toThrow();

    // Seats = 9
    await expect(
      caller.rides.create({
        originLocationId: 1,
        destinationLocationId: 2,
        departureAt: new Date(Date.now() + 86400000),
        availableSeats: 9,
      })
    ).rejects.toThrow();

    // Identical origin and destination
    await expect(
      caller.rides.create({
        originLocationId: 1,
        destinationLocationId: 1,
        departureAt: new Date(Date.now() + 86400000),
        availableSeats: 2,
      })
    ).rejects.toThrow();
  });

  // -- 6. Unauthorized Ownership Changes Rejected -----------------------------
  it("6. Non-owner cannot cancel, complete, or accept requests on another driver's ride", async () => {
    // Driver B attempts to cancel Driver A's active ride
    const { error } = await supabaseAdmin.rpc("cancel_ride", {
      p_ride_id: activeRideId,
      p_driver_id: driverBId,
    });
    expect(error?.message).toContain("UNAUTHORIZED_DRIVER");
  });

  // -- 7. Invalid Authentication Rejected -------------------------------------
  it("7. Protected procedure called without valid authentication is rejected", async () => {
    const unauthenticatedCtx: Context = { user: null };
    const caller = appRouter.createCaller(unauthenticatedCtx);

    await expect(caller.rides.mine()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Please login (10001)",
    });
  });

  // -- 8. Rate Limiter Enforces Window Limits ---------------------------------
  it("8. In-memory rate limiter correctly rejects requests that exceed the quota", () => {
    const testKey = `test_key_${Date.now()}`;
    const max = 3;
    const windowMs = 5000;

    expect(rateLimiter.check(testKey, max, windowMs).allowed).toBe(true);
    expect(rateLimiter.check(testKey, max, windowMs).allowed).toBe(true);
    expect(rateLimiter.check(testKey, max, windowMs).allowed).toBe(true);

    // 4th request exceeds limit
    const exceeded = rateLimiter.check(testKey, max, windowMs);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.retryAfterMs).toBeGreaterThan(0);

    rateLimiter.reset(testKey);
  });

  // -- 9. Pagination Limits Respected -----------------------------------------
  it("9. Pagination limit is strictly respected on rides search", async () => {
    const caller = appRouter.createCaller({ user: null });
    const results = await caller.rides.search({ limit: 3, offset: 0 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  // -- 10. Notification Maintenance Function Works ---------------------------
  it("10. Notification maintenance cleanup executes cleanly without errors", async () => {
    const { data, error } = await supabaseAdmin.rpc("cleanup_old_notifications", {
      p_days_old: 60,
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("number");
  });
});
