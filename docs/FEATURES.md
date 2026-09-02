# RideMate Features

## Profile
Users can:
- View details
- Save details
- Update permitted details
- Update phone number

Profile updates must actually persist.
If a save operation fails:
- Show a clear error
- Inspect the actual database/API cause
- Do not silently claim success

## Verification
Users see their status:
- `PENDING`
- `VERIFIED`
- `REJECTED`
- `SUSPENDED`

Pending means administrative verification has not been completed.

## Offer Ride
Driver enters:
- Route
- Date
- Time
- Flexibility
- Seats
- Notes

Ride is stored and becomes available according to eligibility/search rules.

## Find Ride
Users can use:
- Predefined time slots
- Custom time picker
- Flexibility

Custom time must be supported rather than forcing users to only use a few fixed options.

## Ride Request
- Passenger requests a seat.
- Driver receives notification.

## Acceptance
When accepted:
- Request becomes `ACCEPTED`
- Available seats are updated atomically
- Passenger is notified
- Communication is unlocked

## Text
- Confirmed participants can open the private ride chat.

## Call
- Confirmed participants can access the authorized contact/call option.
- Before confirmation, contact details remain hidden.

## Notifications
Notification bell should:
- Open the notification interface
- Display notifications
- Display unread state/count
- Navigate to relevant resources

## Toast Messages
Toasts such as:
- *Profile saved*
- *Ride updated*
- *Could not save*

Must:
- Be readable
- Have sufficient contrast
- Not rely on difficult-to-read blur/transparency
- Appear above other UI
- Remain visible long enough

## Admin Announcements
Admins can broadcast announcements.
Publishing should:
1. Save announcement.
2. Mark it published.
3. Make it available to target users.
4. Create notifications where applicable.
5. Send push notifications where configured.
