# Functional and Non-Functional Requirements

## 1. Authentication
The system must support:
- Sign up
- Sign in
- Sign out
- Session management
- Password recovery where implemented
- Protected routes

Supabase Auth should manage user authentication.

## 2. User Profile
Users must be able to:
- View profile
- Save profile information
- Update permitted details
- Add/update phone number
- Select college/campus
- View verification status

Verification status may include:
- `PENDING`
- `VERIFIED`
- `REJECTED`
- `SUSPENDED`

Users must not change their own:
- Role
- Verification status
- Admin permissions

## 3. Ride Offering
A driver can create a ride containing:
- Origin
- Destination
- Date
- Time
- Time flexibility
- Number of available seats
- Vehicle information where required
- Notes

Time selection must support:
- Predefined time slots
- Custom time selection

Time flexibility must allow users to specify an acceptable range.
- *Example:* Requested time: `16:30`, Flexibility: `�30 minutes`. The system should search the appropriate time range.

## 4. Find Ride
Passengers should be able to filter rides by:
- Origin
- Destination
- Date
- Time
- Flexibility
- Available seats
- Ride status

Only appropriate available rides should be returned.
The database should perform filtering rather than downloading unnecessary rides to the frontend.

## 5. Ride Requests
A passenger can request a seat on a ride.

Request states:
- `PENDING`
- `ACCEPTED`
- `REJECTED`
- `CANCELLED`

The database must prevent duplicate requests.
Recommended constraint: `UNIQUE(ride_id, passenger_id)`

## 6. Ride Acceptance
When the driver accepts a request:
1. Verify the request belongs to the ride.
2. Verify the acting user is the ride driver.
3. Verify the request is pending.
4. Verify seats are available.
5. Update the request.
6. Update available seats.
7. Perform the operation atomically.
8. Notify the passenger.
9. Unlock authorized communication.

The operation must never allow overbooking.

## 7. Ride States
Recommended ride states:
- `OPEN`
- `FULL`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `EXPIRED`

## 8. Communication
After ride confirmation:
- The confirmed driver and passenger can:
  - Send chat messages
  - Receive chat messages
  - Call each other

Before confirmation:
- Phone numbers remain protected
- Private chat remains inaccessible

Only confirmed participants may access communication data.

## 9. Notifications
The system must support:
- **In-App:**
  - Unread notification count
  - Notification list
  - Mark as read
  - Navigation to related resource
- **External Push:**
  - Where enabled, important events may generate device notifications.
  - Events include: ride request, request acceptance, request rejection, cancellation, chat message, reminder, announcement.

## 10. Real-Time Updates
Relevant users should receive updates when:
- Rides are created
- Rides change
- Requests change
- Messages arrive
- Notifications are created

Realtime must not replace database state. On reconnect, the client should fetch authoritative data.

## 11. Admin
- **ADMIN capabilities:**
  - Review users
  - Verify users
  - Reject verification
  - Suspend users
  - Manage announcements
  - Moderate rides
  - Manage locations
  - Manage colleges/campuses
  - Review reports
  - View permitted statistics
- **SUPER_ADMIN capabilities:**
  - All ADMIN capabilities
  - Manage administrator accounts and roles

No normal user may enable administrative access from:
- Profile links
- Hidden buttons
- localStorage
- Query parameters
- Frontend state

## 12. Announcements
Admins can:
- Create announcements
- Edit announcements where permitted
- Publish announcements

Users can:
- Read published announcements
- Receive notifications where applicable

Announcements must use the actual database schema.
If `public.announcements` is referenced by code, the correct table/migration must exist.

## Non-Functional Requirements
The system should provide:
- Responsive design
- Mobile support
- Reasonable performance
- Secure authorization
- Clear errors
- Production logging
- Database indexes
- Atomic critical operations
- Versioned database migrations
- No exposed secrets
- Expandable architecture
