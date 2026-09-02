# Database Design

> [!IMPORTANT]
> This document describes the intended design. Actual Supabase migrations and the deployed schema are the final source of truth.
> Before changing the database:
> - Inspect existing tables.
> - Inspect existing migrations.
> - Inspect application references.
> - Avoid duplicate schemas.

## Core Tables

### `profiles`
Stores application user information.
- Typical fields: `id`, `full_name`, `phone`, `college_id`, `verification_status`, `created_at`, `updated_at`
- `id` should correspond to the authenticated user.

### `colleges`
Stores supported colleges.
- Typical fields: `id`, `name`, `created_at`

### `campuses`
Stores campuses if needed.
- Typical fields: `id`, `college_id`, `name`

### `locations`
Stores selectable locations.
- Examples: DBUU, Bhauwala, Naugaon, Manduwala. Locations must be configurable.

### `vehicles`
Stores vehicles.
- Typical fields: `id`, `owner_id`, `type`, `model`, registration details where required.
- Only collect/store sensitive vehicle information if necessary.

### `rides`
Stores ride offers.
- Typical fields: `id`, `driver_id`, `origin_location_id`, `destination_location_id`, `ride_date`, `ride_time`, `time_flexibility_minutes`, `total_seats`, `available_seats`, `status`, `notes`, `created_at`, `updated_at`

### `ride_requests`
Stores passenger ride requests.
- Typical fields: `id`, `ride_id`, `passenger_id`, `status`, `created_at`, `updated_at`
- Required constraint: `UNIQUE(ride_id, passenger_id)`

### `conversations`
Represents private chat conversations.
- Typical fields: `id`, `ride_id`, `created_at`
- Conversation access must be derived from authorized ride participants.

### `chat_messages`
Stores chat messages.
- Typical fields: `id`, `conversation_id`, `sender_id`, `message`, `created_at`, `read_at`
- The actual table name must match the code. If the application queries `public.chat_messages`, then the table must exist or the code must be correctly updated through a proper migration/refactor.

### `notifications`
Stores persistent notifications.
- Typical fields: `id`, `user_id`, `type`, `title`, `body`, `related_resource_id` where applicable, `is_read`, `created_at`

### `announcements`
Stores platform announcements.
- Typical fields: `id`, `title`, `content`, `created_by`, `is_published`, `published_at`, `created_at`, `updated_at`
- Only authorized admins can create/publish.

### `reports`
Stores user or ride reports.
- Typical fields: `id`, `reporter_id`, `reported_user_id` or resource reference, `reason`, `status`, `created_at`

## Relationships
- `profiles` ? college/campus
- `vehicles` ? profile
- `rides` ? driver profile
- `rides` ? origin location
- `rides` ? destination location
- `ride_requests` ? ride
- `ride_requests` ? passenger
- `conversations` ? ride
- `chat_messages` ? conversation
- `chat_messages` ? sender
- `notifications` ? user
- `announcements` ? authorized admin

## Row Level Security
RLS must be enabled on protected tables.

- **Profiles:** Users can read permitted profile data and update their own permitted fields. Users cannot change own role, verification status, or grant admin access.
- **Rides:** Drivers can manage their own rides. Passengers can read rides according to application rules.
- **Ride Requests:** Passengers can manage their own requests. Drivers can view requests for their own rides.
- **Chat:** Only confirmed eligible participants may read messages and create messages.
- **Notifications:** Only the owning user can read/update their notifications.
- **Announcements:** Users can read published announcements. Only authorized admins can create/manage them.

## Indexing
Common indexes should include:
- Rides by date
- Rides by origin
- Rides by destination
- Rides by status
- Ride requests by ride
- Ride requests by passenger
- Messages by conversation and creation time
- Notifications by user and read status

Avoid unnecessary indexes.

## Atomic Seat Management
Ride acceptance must not perform separate unsafe operations like:
1. Read seat count.
2. Check seat count.
3. Update later.

Use a transaction, RPC or backend operation that performs:
- Authorization check
- Request status validation
- Seat availability check
- Seat update
- Request update
as one controlled operation.

## Migrations
Schema changes must be stored in `supabase/migrations/`.
- *Example:* `001_initial_schema.sql`, `002_ride_system.sql`, `003_notifications.sql`, `004_chat.sql`, `005_announcements.sql`
- Migration naming should follow the project's actual convention.
