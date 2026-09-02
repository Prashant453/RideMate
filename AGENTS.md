# RideMate � AI Coding Agent & Developer Instructions

## Project
RideMate is a student-focused ride-sharing platform that connects students who have spare seats in their vehicles with students travelling on similar routes.

The initial pilot area includes the DBUU region and nearby locations such as Bhauwala, Naugaon and Manduwala.

## Before Making Any Changes
Before modifying the project:
- Read `README.md`.
- Read the relevant files inside `/docs`.
- Inspect the existing codebase.
- Inspect the current Supabase schema and migrations.
- Never assume a database table, function, API, package manager or configuration exists without checking.
- Fix the root cause instead of adding temporary workarounds.
- Do not redesign the existing UI unless explicitly requested.

## Engineering Principles
- Keep the architecture simple and production-ready.
- Prefer maintainable solutions over unnecessary complexity.
- Do not create duplicate tables, functions or systems.
- Reuse existing components and logic where possible.
- Database changes must use proper migrations.
- Supabase database is the source of truth.
- Critical authorization must never rely only on frontend checks.
- Use Supabase RLS and/or backend authorization.
- Use atomic operations for ride acceptance and seat updates.
- Prevent duplicate ride requests at database level.
- Keep locations and colleges database-driven.
- Do not hardcode the pilot locality into application logic.
- Add indexes for frequently queried data.
- Validate important inputs.
- Never expose privileged secrets to the frontend.
- Do not commit secrets to Git.
- Keep documentation updated after significant changes.

## Security Rules
Never expose in frontend code:
- Supabase service-role key
- Supabase secret key
- Database password
- `DATABASE_URL`
- VAPID private key
- GitHub token
- Other privileged credentials

Only public/publishable Supabase credentials may exist in the frontend.

## Definition of Done
Before considering work complete:
1. Inspect the existing implementation.
2. Implement the required feature or fix.
3. Add/update database migration if required.
4. Add indexes/constraints if required.
5. Apply correct RLS/authorization.
6. Test the feature.
7. Check lint/type/build errors.
8. Verify production implications.
9. Update relevant documentation.
10. Report the actual root cause and solution.

## Critical End-to-End Flow
Test when relevant:
Signup/Login
? Profile Completion
? Verification
? Offer Ride
? Find Ride
? Request Seat
? Driver Accepts/Rejects
? Seat Update
? Chat Unlocks
? Contact Unlocks
? Notifications
? Cancellation/Completion
