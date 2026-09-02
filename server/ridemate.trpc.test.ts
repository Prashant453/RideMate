import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./trpc";

describe("RideMate tRPC Router Architecture", () => {
  const unauthenticatedCtx: Context = { user: null };

  it("auth.me returns null for unauthenticated context", async () => {
    const caller = appRouter.createCaller(unauthenticatedCtx);
    const me = await caller.auth.me();
    expect(me).toBeNull();
  });

  it("rejects protected procedures when unauthenticated", async () => {
    const caller = appRouter.createCaller(unauthenticatedCtx);
    await expect(caller.rides.mine()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Please login (10001)",
    });
  });

  it("rejects vehicle management when unauthenticated", async () => {
    const caller = appRouter.createCaller(unauthenticatedCtx);
    await expect(caller.vehicles.mine()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects admin procedures for standard authenticated users", async () => {
    const regularUserCtx: Context = {
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "student@example.com",
        role: "user",
      },
    };
    const caller = appRouter.createCaller(regularUserCtx);
    await expect(caller.admin.stats()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Admin privileges required",
    });
  });

  it("rejects super admin procedures for standard admin users", async () => {
    const adminUserCtx: Context = {
      user: {
        id: "00000000-0000-0000-0000-000000000002",
        email: "admin@example.com",
        role: "admin",
      },
    };
    const caller = appRouter.createCaller(adminUserCtx);
    await expect(
      caller.superAdmin.updateRole({
        userId: "00000000-0000-0000-0000-000000000003",
        newRole: "admin",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Super Admin privileges required",
    });
  });
});
