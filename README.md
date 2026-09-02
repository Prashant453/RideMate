# RideMate

RideMate is a student-focused ride-sharing platform.

Students travelling with spare vehicle seats can offer rides to other students travelling along similar routes. Students can discover rides, request seats, communicate after confirmation, and coordinate their journey.

## Initial Pilot
The first deployment is focused around the DBUU student region and nearby locations including:
- Bhauwala
- Naugaon
- Manduwala
- DBUU and nearby campus routes

These locations should be stored as database data, not hardcoded into business logic.

## Core Features
- Student authentication
- Student profile management
- Verification system
- Offer a ride
- Find rides
- Custom ride time
- Time flexibility
- Ride requests
- Driver acceptance/rejection
- Atomic seat management
- Real-time updates
- Confirmed-ride chat
- Confirmed-ride phone contact
- In-app notifications
- External push notifications
- Admin dashboard
- User verification
- Announcements
- Ride moderation

## Production Architecture
- **Frontend:** Vercel
- **Backend/API:** Render
- **Database/Auth/Realtime:** Supabase
- **Push Notifications:** Web Push + Service Worker
- **Source Control:** GitHub

## Roles
- `USER`
- `ADMIN`
- `SUPER_ADMIN`

## Important Rule
The frontend UI must never be treated as the source of authorization.

Sensitive actions must be protected by:
- Supabase RLS
- Backend authorization
- Database constraints

## Documentation

| File | Purpose |
| :--- | :--- |
| [`AGENTS.md`](./AGENTS.md) | Instructions for developers and AI coding agents |
| [`docs/PROJECT_OVERVIEW.md`](./docs/PROJECT_OVERVIEW.md) | Product purpose and scope |
| [`docs/REQUIREMENTS.md`](./docs/REQUIREMENTS.md) | Functional requirements |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Technical architecture |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Database design |
| [`docs/AUTH_RBAC.md`](./docs/AUTH_RBAC.md) | Authentication and roles |
| [`docs/FEATURES.md`](./docs/FEATURES.md) | Feature behavior |
| [`docs/API.md`](./docs/API.md) | API and server operations |
| [`docs/NOTIFICATIONS.md`](./docs/NOTIFICATIONS.md) | Notification architecture |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Production deployment |
| [`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md) | Environment variables |
| [`docs/TESTING.md`](./docs/TESTING.md) | Testing strategy |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | Security requirements |
| [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) | Project changes |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Future development |

## Source of Truth
The source of truth is:
1. Application code
2. Supabase migrations/database
3. Deployed environment

Documentation describes the intended architecture and must be updated when significant changes are made.
