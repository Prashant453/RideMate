import { describe, expect, it } from "vitest";
import {
  getLocalDateString,
  getLocalTimeString,
  getDefaultDepartureTime,
  parseLocalDateTime,
  isPastDate,
  isPastDateTime,
} from "../client/src/lib/dateTime";
import { appRouter } from "./routers";
import type { Context } from "./trpc";

describe("RideMate Date & Time Validation Suite", () => {
  it("computes local date in YYYY-MM-DD format accurately", () => {
    const customDate = new Date(2026, 8, 5, 14, 30); // Sept 5, 2026, 14:30
    expect(getLocalDateString(customDate)).toBe("2026-09-05");
    expect(getLocalTimeString(customDate)).toBe("14:30");
  });

  // 1. Yesterday -> Cannot select / identified as past
  it("1. Yesterday is identified as a past date and blocked", () => {
    const simulatedNow = new Date(2026, 8, 5, 12, 0); // 2026-09-05 12:00
    const yesterday = "2026-09-04";

    expect(isPastDate(yesterday, simulatedNow)).toBe(true);
    expect(isPastDateTime(yesterday, "18:00", simulatedNow)).toBe(true);
  });

  // 2. Today + future time -> Allowed
  it("2. Today with a future time is allowed", () => {
    const simulatedNow = new Date(2026, 8, 5, 12, 0); // 2026-09-05 12:00
    const todayStr = "2026-09-05";

    expect(isPastDate(todayStr, simulatedNow)).toBe(false);
    expect(isPastDateTime(todayStr, "14:30", simulatedNow)).toBe(false);
  });

  // 3. Today + past time -> Blocked
  it("3. Today with a past time is blocked", () => {
    const simulatedNow = new Date(2026, 8, 5, 15, 0); // 2026-09-05 15:00
    const todayStr = "2026-09-05";

    // 10:00 AM today is in the past
    expect(isPastDateTime(todayStr, "10:00", simulatedNow)).toBe(true);
    // 14:00 (2:00 PM) today is in the past
    expect(isPastDateTime(todayStr, "14:00", simulatedNow)).toBe(true);
  });

  // 4. Future date -> Allowed
  it("4. Future date is allowed regardless of time slot", () => {
    const simulatedNow = new Date(2026, 8, 5, 18, 0); // 2026-09-05 18:00
    const tomorrowStr = "2026-09-06";
    const nextWeekStr = "2026-09-12";

    expect(isPastDate(tomorrowStr, simulatedNow)).toBe(false);
    expect(isPastDateTime(tomorrowStr, "08:00", simulatedNow)).toBe(false);
    expect(isPastDate(nextWeekStr, simulatedNow)).toBe(false);
    expect(isPastDateTime(nextWeekStr, "09:00", simulatedNow)).toBe(false);
  });

  it("5. parseLocalDateTime accurately builds local Date object", () => {
    const parsed = parseLocalDateTime("2026-09-05", "16:45");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8); // Month 8 is September
    expect(parsed.getDate()).toBe(5);
    expect(parsed.getHours()).toBe(16);
    expect(parsed.getMinutes()).toBe(45);
  });

  // 6. Direct / API submission of past date/time -> rejected by backend
  it("6. Direct API submission of a past departure date/time is strictly rejected by backend", async () => {
    const driverCtx: Context = { user: { id: "00000000-0000-0000-0000-000000000001", email: "driver@dbuu.ac.in", role: "user" } };
    const caller = appRouter.createCaller(driverCtx);

    const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours in the past

    await expect(
      caller.rides.create({
        originLocationId: 1,
        destinationLocationId: 2,
        departureAt: pastDate,
        availableSeats: 2,
      })
    ).rejects.toThrow();
  });
});
