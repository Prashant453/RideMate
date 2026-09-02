# System Architecture

## High-Level Architecture
```
User
 ?
Vercel Frontend / PWA
 ?
Render Backend/API where required
 ?
Supabase (Auth + PostgreSQL + Realtime)
```

**Push Notifications:**
```
Backend
 ?
Web Push Service
 ?
Device
```

## Frontend Responsibilities
The frontend handles:
- UI
- Forms
- Client-side interaction
- Auth-aware routing
- Displaying data
- Realtime subscriptions
- Notification interface
- Service Worker registration
- Push subscription permission flow

The frontend must **not**:
- Contain privileged credentials
- Enforce critical authorization alone
- Trust user-provided roles

## Backend Responsibilities
The backend handles operations requiring:
- Server-side secrets
- Privileged operations
- Complex business logic
- Push notification delivery
- External integrations
- Additional validation

## Supabase Responsibilities
Supabase provides:
- Authentication
- PostgreSQL database
- Row Level Security (RLS)
- Realtime
- Database functions
- RPC operations
- Migrations

## Ride Request Flow
```
Passenger
 ?
Select Ride
 ?
Create Request
 ?
Database validates request
 ?
Driver notified
 ?
Driver accepts
 ?
Atomic seat transaction
 ?
Request confirmed
 ?
Chat/contact access unlocked
 ?
Notifications sent
```

## Realtime Principle
- Realtime is used for immediate updates.
- Database remains authoritative.
- If the client reconnects:
  1. Reconnect realtime subscription.
  2. Refetch current state.
  3. Synchronize UI.

## Scalability
The initial version should remain simple.
Future expansion can add:
- More colleges
- More campuses
- More locations
- Native applications
- FCM

Avoid microservices until justified.
