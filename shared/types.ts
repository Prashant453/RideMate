/**
 * Unified type exports for RideMate with Supabase backend.
 * Database types are inferred from Supabase queries, not from Drizzle schema.
 */

// Ride status values
export type RideStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled' | 'expired';

// Ride request status values
export type RideRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed' | 'expired';

// Vehicle types
export type VehicleType = 'bike' | 'scooter' | 'car';

// User roles
export type UserRole = 'user' | 'admin';

// Verification status
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
