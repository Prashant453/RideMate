# Environment Variables

> [!CAUTION]
> Never commit actual secret values to source control.

## Frontend
Typical variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_URL`

Only browser-safe values belong here.

## Backend
Typical variables:
- `SUPABASE_URL` / `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY`
- `DATABASE_URL`
- `FRONTEND_URL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Actual variable names must match the code.

## Security Rules
Never expose in frontend:
- Service role key
- Secret key
- Database URL containing credentials
- VAPID private key

If a secret is exposed:
1. Revoke/rotate it immediately.
2. Update environment variables.
3. Remove it from source control history if required.
