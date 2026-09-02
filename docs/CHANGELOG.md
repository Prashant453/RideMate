# Changelog

All significant changes should be recorded here.

## Unreleased
### Added
- Standardized documentation structure (`AGENTS.md`, `README.md`, `/docs`).
- Real-time Web Push notification integration.
- Text & Call communication for confirmed ride participants.
- Admin announcement broadcast system.

### Changed
- Refactored CallButton to query confirmed contact RPC on demand.
- Modernized notification toast styles with high contrast theme.

### Fixed
- Fixed PostgREST schema cache and missing migration execution for chat messages and announcements.
- Fixed contact information parameter ordering in API routers.
- Resolved profile phone number persistence issue.

### Security
- Verified RLS policies on chat messages, announcements, and push subscriptions.
- Protected phone numbers behind `get_confirmed_contact_info` security definer RPC.

### Database
- Applied migrations `004_chat_and_contact.sql`, `005_realtime_and_notifications.sql`, `006_admin_rbac.sql`, `007_push_notifications.sql`, `008_admin_announcements_fix.sql`.

### Deployment
- Frontend deployed on Vercel.
- API backend deployed on Render.
- Supabase hosting Auth, PostgreSQL, and Realtime.

---

## Entry Format
```markdown
## [YYYY-MM-DD] � Version
### Added
- ...
### Changed
- ...
### Fixed
- ...
### Security
- ...
### Database
- ...
### Deployment
- ...
```
