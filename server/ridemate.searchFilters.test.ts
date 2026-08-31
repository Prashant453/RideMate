import { describe, expect, it } from "vitest";
import { buildSearchWindow } from "../client/src/lib/searchFilters";

describe("Find a Ride search filters", () => {
  it("builds the correct local ±30-minute window for an afternoon selection", () => {
    const now = new Date("2026-08-30T09:00:00");
    const window = buildSearchWindow("5:00 PM", now);
    expect(window.from.getHours()).toBe(16);
    expect(window.from.getMinutes()).toBe(30);
    expect(window.to.getHours()).toBe(17);
    expect(window.to.getMinutes()).toBe(30);
  });

  it("handles noon and midnight correctly", () => {
    const now = new Date("2026-08-30T09:00:00");
    expect(buildSearchWindow("12:00 PM", now).from.getHours()).toBe(11);
    expect(buildSearchWindow("12:00 AM", now).from.getHours()).toBe(23);
  });
});
