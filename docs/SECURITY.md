# Security Requirements

## Trust Model
Never trust:
- Client roles
- Client verification status
- Client seat count
- Resource ownership claims

Verify everything server-side and database-side.

## Data Protection
- **Phone numbers:** Private before confirmation, available only to authorized confirmed participants.
- **Chat:** Private to eligible users.
- **Notifications:** Private to owner.
- **Admin actions:** Restricted by role.

## Supabase
Use:
- Row Level Security (RLS)
- Ownership checks
- Role checks
- Secure RPC/functions

## Race Conditions
- Seat acceptance must be atomic.
- Duplicate requests must be prevented.
- The system must never produce:
  - Negative seats
  - Overbooking
  - Multiple conflicting acceptance

## Secrets
Never commit:
- Service-role keys
- Database credentials
- VAPID private keys
- GitHub tokens

## Logging
Logs should be useful but must not contain:
- Passwords
- Tokens
- Private keys
- Complete sensitive credentials
