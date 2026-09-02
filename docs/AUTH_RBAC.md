# Authentication and Role-Based Access Control

## Authentication
Supabase Auth manages user identity and sessions.

## Roles
- `USER`: Standard platform user.
- `ADMIN`: Platform moderator/administrator.
- `SUPER_ADMIN`: Highest application administrator.

## Verification Status
- `PENDING`
- `VERIFIED`
- `REJECTED`
- `SUSPENDED`

Role and verification status are separate.
A user may be:
- `USER` + `VERIFIED`
or
- `ADMIN` + `VERIFIED`
depending on the implementation.

## Critical Security Rule
The following must never be used as authorization:
- Frontend button visibility
- localStorage role value
- URL parameter
- Client-side JavaScript state

Authorization must be enforced by:
- Supabase RLS
- Backend authorization
- Secure database functions

## Admin Route Protection
When an unauthorized user visits an admin route:
- Frontend should redirect or block access.
- Backend/database must also reject unauthorized operations.

## Role Management
- Only authorized `SUPER_ADMIN` operations should change admin roles.
- Users must never be able to activate admin capabilities through a profile link or self-mutation.
