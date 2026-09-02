# Testing Strategy

## Authentication
Test:
- Signup
- Login
- Logout
- Invalid login
- Protected routes
- Session persistence

## Profile
Test:
- Save profile
- Update profile
- Phone persistence
- Verification status

## Rides
Test:
- Create ride
- Edit ride
- Cancel ride
- Invalid input
- Seat count

## Search
Test:
- Route search
- Date search
- Predefined time
- Custom time
- Flexibility range

## Requests
Test:
- Create request
- Duplicate request blocked
- Accept
- Reject
- Cancel

## Concurrency
- Test simultaneous requests for the last seat.
- The result must not overbook.

## Chat
Test:
- Unavailable before confirmation
- Available after confirmation
- Send message
- Receive message
- Unauthorized access blocked

## Contact
Test:
- Loading state ends correctly
- Authorized contact returns
- Phone hidden before confirmation
- Unauthorized access blocked

## Notifications
Test:
- Notification creation
- Unread count
- Mark as read
- Realtime
- Push notification

## Admin
Test:
- `USER` blocked
- `ADMIN` permitted
- `SUPER_ADMIN` role management

## Production
Test:
- Vercel production build
- Render health endpoint
- CORS
- Environment variables
- Supabase migrations
