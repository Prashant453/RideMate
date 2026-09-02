# Production Deployment

## Production Setup
- **Frontend:** Vercel
- **Backend:** Render
- **Database:** Supabase

## Vercel
Deploy frontend only.
Verify:
- Correct project root
- Correct build output
- Correct environment variables
- Correct API URL
- Correct Supabase URL
- Publishable key only

A blank white page requires inspection of:
- Browser console
- Production runtime errors
- Environment variables
- Build output
- Deployment root

## Render
Deploy backend/API.
- The backend root should not incorrectly redirect to the frontend.
- Provide a health/API response.
- Verify:
  - Build command
  - Start command
  - Package manager
  - Environment variables
  - CORS
  - Logs

Do not guess npm or pnpm. Inspect:
- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`

## Supabase
Verify:
- Migrations applied
- Required tables exist
- RLS enabled
- Policies work
- Required functions exist
- Realtime enabled where needed

## Deployment Verification
Test:
Signup ? Login ? Profile ? Ride creation ? Ride search ? Request ? Acceptance ? Chat ? Contact ? Notifications ? Admin access
