import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, protectedProcedure, adminProcedure, superAdminProcedure, router } from './trpc';
import {
  searchRides, createRide, requestRideSeat, acceptRideRequest, rejectRideRequest,
  cancelRideRequest, cancelRide, completeRide, listUserRides, getRideRequests,
  listLocations, listColleges, listVehicles, addVehicle, updateVehicle, deleteVehicle,
  getUserProfile, updateUserProfile, submitRating, getRatingsForRide,
  getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead,
  getConfirmedContactInfo, sendChatMessage, getChatHistory, markChatRead,
  listUsersForAdmin, updateVerificationStatus, makeUserAdmin,
  getPlatformStats, adminListAllRides, adminCancelRide, adminAddLocation, adminAddCollege, adminSendAnnouncement, superAdminUpdateRole
} from './db';

const rideInput = z.object({
  vehicleId: z.number().int().positive().optional(),
  originLocationId: z.number().int().positive(),
  destinationLocationId: z.number().int().positive(),
  departureAt: z.coerce.date(),
  availableSeats: z.number().int().min(1).max(8),
  notes: z.string().max(500).optional(),
});

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
  }),
  locations: publicProcedure.query(() => listLocations()),
  colleges: publicProcedure.query(() => listColleges()),
  rides: router({
    search: publicProcedure.input(z.object({
      originLocationId: z.number().int().positive().optional(),
      destinationLocationId: z.number().int().positive().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
      refreshToken: z.number().int().min(0).default(0),
    })).query(({ input }) => searchRides(input)),
    create: protectedProcedure.input(rideInput).mutation(({ ctx, input }) =>
      createRide(ctx.user.id, input)
    ),
    mine: protectedProcedure.query(({ ctx }) => listUserRides(ctx.user.id)),
    getContactInfo: protectedProcedure
      .input(z.object({ rideId: z.number().int().positive(), targetUserId: z.string().uuid() }))
      .query(({ ctx, input }) => getConfirmedContactInfo(input.rideId, ctx.user.id, input.targetUserId)),
    requestSeat: protectedProcedure
      .input(z.object({ rideId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await requestRideSeat(ctx.user.id, input.rideId);
        } catch (error) {
          if (error instanceof Error) {
            if (error.message === 'RIDE_NOT_OPEN') throw new TRPCError({ code: 'CONFLICT', message: 'This ride is not available for requests.' });
            if (error.message === 'CANNOT_REQUEST_OWN') throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot request a seat on your own ride.' });
          }
          throw error;
        }
      }),
    requests: protectedProcedure
      .input(z.object({ rideId: z.number().int().positive() }))
      .query(({ ctx, input }) => getRideRequests(input.rideId, ctx.user.id)),
    acceptRequest: protectedProcedure
      .input(z.object({ requestId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await acceptRideRequest(input.requestId, ctx.user.id);
        } catch (error) {
          if (error instanceof Error && error.message === 'RIDE_FULL')
            throw new TRPCError({ code: 'CONFLICT', message: 'This ride no longer has an available seat.' });
          throw error;
        }
      }),
    rejectRequest: protectedProcedure
      .input(z.object({ requestId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => rejectRideRequest(input.requestId, ctx.user.id)),
    cancelRequest: protectedProcedure
      .input(z.object({ requestId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => cancelRideRequest(input.requestId, ctx.user.id)),
    cancel: protectedProcedure
      .input(z.object({ rideId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => cancelRide(input.rideId, ctx.user.id)),
    complete: protectedProcedure
      .input(z.object({ rideId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => completeRide(input.rideId, ctx.user.id)),
  }),
  vehicles: router({
    mine: protectedProcedure.query(({ ctx }) => listVehicles(ctx.user.id)),
    add: protectedProcedure
      .input(z.object({
        type: z.enum(['bike', 'scooter', 'car']),
        model: z.string().min(1).max(120),
        registrationLast4: z.string().max(4).optional(),
        seatCapacity: z.number().int().min(1).max(8),
      }))
      .mutation(({ ctx, input }) => addVehicle(ctx.user.id, input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        type: z.enum(['bike', 'scooter', 'car']).optional(),
        model: z.string().min(1).max(120).optional(),
        registrationLast4: z.string().max(4).optional(),
        seatCapacity: z.number().int().min(1).max(8).optional(),
      }))
      .mutation(({ ctx, input }) => updateVehicle(ctx.user.id, input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteVehicle(ctx.user.id, input.id)),
  }),
  profile: router({
    me: protectedProcedure.query(({ ctx }) => getUserProfile(ctx.user.id)),
    update: protectedProcedure
      .input(z.object({
        name: z.string().min(2).max(160).optional(),
        collegeId: z.number().int().positive().nullable().optional(),
        course: z.string().max(160).nullable().optional(),
        year: z.string().max(40).nullable().optional(),
        profileImage: z.string().url().nullable().optional(),
        phoneNumber: z.string().max(30).nullable().optional(),
      }))
      .mutation(({ ctx, input }) => updateUserProfile(ctx.user.id, input)),
  }),
  admin: router({
    stats: adminProcedure.query(() => getPlatformStats()),
    users: adminProcedure.query(() => listUsersForAdmin()),
    updateVerification: adminProcedure
      .input(z.object({
        userId: z.string().uuid(),
        status: z.enum(['pending', 'verified', 'rejected', 'suspended']),
      }))
      .mutation(({ input }) => updateVerificationStatus(input.userId, input.status)),
    rides: adminProcedure.query(() => adminListAllRides()),
    cancelRide: adminProcedure
      .input(z.object({ rideId: z.number().int().positive() }))
      .mutation(({ input }) => adminCancelRide(input.rideId)),
    addLocation: adminProcedure
      .input(z.object({ name: z.string().min(1).max(100), type: z.string().default('area') }))
      .mutation(({ input }) => adminAddLocation(input.name, input.type)),
    addCollege: adminProcedure
      .input(z.object({ name: z.string().min(2).max(160), domain: z.string().optional(), city: z.string().optional(), state: z.string().optional() }))
      .mutation(({ input }) => adminAddCollege(input.name, input.domain, input.city, input.state)),
    broadcastAnnouncement: adminProcedure
      .input(z.object({ title: z.string().min(2).max(150), message: z.string().min(2).max(1000), targetCollegeId: z.number().int().positive().optional() }))
      .mutation(({ ctx, input }) => adminSendAnnouncement(ctx.user.id, input.title, input.message, input.targetCollegeId)),
  }),
  superAdmin: router({
    updateRole: superAdminProcedure
      .input(z.object({
        userId: z.string().uuid(),
        newRole: z.enum(['user', 'admin', 'super_admin']),
      }))
      .mutation(({ input }) => superAdminUpdateRole(input.userId, input.newRole)),
  }),
  chat: router({
    send: protectedProcedure
      .input(z.object({
        rideId: z.number().int().positive(),
        receiverId: z.string().uuid(),
        message: z.string().min(1).max(1000),
      }))
      .mutation(({ ctx, input }) =>
        sendChatMessage(input.rideId, ctx.user.id, input.receiverId, input.message)
      ),
    history: protectedProcedure
      .input(z.object({
        rideId: z.number().int().positive(),
        otherUserId: z.string().uuid(),
      }))
      .query(({ ctx, input }) =>
        getChatHistory(input.rideId, input.otherUserId, ctx.user.id)
      ),
    markRead: protectedProcedure
      .input(z.object({
        rideId: z.number().int().positive(),
        otherUserId: z.string().uuid(),
      }))
      .mutation(({ ctx, input }) =>
        markChatRead(input.rideId, input.otherUserId, ctx.user.id)
      ),
  }),
  ratings: router({
    submit: protectedProcedure
      .input(z.object({
        rideId: z.number().int().positive(),
        toUserId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        review: z.string().max(500).optional(),
      }))
      .mutation(({ ctx, input }) =>
        submitRating(input.rideId, ctx.user.id, input.toUserId, input.rating, input.review)
      ),
    forRide: protectedProcedure
      .input(z.object({ rideId: z.number().int().positive() }))
      .query(({ input }) => getRatingsForRide(input.rideId)),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => getNotifications(ctx.user.id)),
    unreadCount: protectedProcedure.query(({ ctx }) => getUnreadNotificationCount(ctx.user.id)),
    markRead: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => markNotificationRead(ctx.user.id, input.id)),
    markAllRead: protectedProcedure
      .mutation(({ ctx }) => markAllNotificationsRead(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
