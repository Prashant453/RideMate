import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createRide, getDb, listUserRides, requestRideSeat } from "./db";
import { notifications, rideRequests, rides, users } from "../drizzle/schema";

describe("RideMate persistence procedures", () => {
  const context = {
    user: {
      id: 101,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "test",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: {},
  } as TrpcContext;

  it("rejects invalid ride input before touching the database", async () => {
    const caller = appRouter.createCaller(context);
    await expect(caller.rides.create({
      originLocationId: 1,
      destinationLocationId: 2,
      departureAt: new Date(),
      availableSeats: 0,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires an authenticated context for protected ride requests", async () => {
    const unauthenticated = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
    const caller = appRouter.createCaller(unauthenticated);
    await expect(caller.rides.requestSeat({ rideId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.runIf(Boolean(process.env.DATABASE_URL))("persists rides and rejects a second request after the last seat is reserved", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL is required for the persistence integration test");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const driverInsert = await db.insert(users).values({ openId: `test-driver-${suffix}`, name: "Persistence Driver", email: `driver-${suffix}@example.com` });
    const passengerInsert = await db.insert(users).values({ openId: `test-passenger-${suffix}`, name: "Persistence Passenger", email: `passenger-${suffix}@example.com` });
    const secondPassengerInsert = await db.insert(users).values({ openId: `test-passenger-2-${suffix}`, name: "Persistence Passenger Two", email: `passenger-2-${suffix}@example.com` });
    const driverId = Number(driverInsert[0].insertId);
    const passengerId = Number(passengerInsert[0].insertId);
    const secondPassengerId = Number(secondPassengerInsert[0].insertId);
    let rideId: number | undefined;
    try {
      const created = await createRide(driverId, { originLocationId: 1, destinationLocationId: 4, departureAt: new Date(Date.now() + 60 * 60 * 1000), availableSeats: 1, notes: "Persistence verification" });
      if (!created) throw new Error("Ride was not created");
      rideId = created.id;
      const mine = await listUserRides(driverId);
      expect(mine.offered.some((ride) => ride.id === rideId)).toBe(true);

      const firstRequest = await requestRideSeat(passengerId, rideId);
      expect(firstRequest.alreadyRequested).toBe(false);
      const storedRide = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
      expect(storedRide[0]?.availableSeats).toBe(0);
      expect(storedRide[0]?.status).toBe("full");
      const storedRequests = await db.select().from(rideRequests).where(eq(rideRequests.rideId, rideId));
      expect(storedRequests).toHaveLength(1);
      await expect(requestRideSeat(secondPassengerId, rideId)).rejects.toThrow("RIDE_FULL");
    } finally {
      if (rideId) {
        await db.delete(notifications).where(eq(notifications.referenceId, rideId));
        await db.delete(rideRequests).where(eq(rideRequests.rideId, rideId));
        await db.delete(rides).where(eq(rides.id, rideId));
      }
      await db.delete(users).where(inArray(users.id, [driverId, passengerId, secondPassengerId]));
    }
  });
});
