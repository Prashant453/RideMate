# Notification Architecture

## Notification Channels

### In-App
```
Database notification
 ?
Supabase Realtime
 ?
Notification UI
```

### External Push
```
Important event
 ?
Backend
 ?
Web Push
 ?
Device
```

## Events
Important events include:
- Relevant ride available
- Ride request
- Request accepted
- Request rejected
- Ride cancellation
- Ride reminder
- Chat message
- Announcement

## Push Flow
```
User installs/opens PWA
 ?
Service Worker registers
 ?
User grants permission
 ?
Push subscription created
 ?
Subscription securely stored
 ?
Event occurs
 ?
Backend sends Web Push
 ?
Device receives notification
```

## Subscription Rules
Support:
- Multiple subscriptions per user
- Invalid subscription cleanup
- Permission denial
- Expiration
- Logout/user switching

## Security
- **VAPID private key:** Server-side only
- **Service Worker:** No server secrets

## Notification Click
Clicking a push notification should open the application and navigate to the related:
- Ride
- Request
- Chat
- Announcement
