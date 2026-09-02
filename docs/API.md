# API and Server Operations

> [!IMPORTANT]
> The exact API paths and RPC names must match the implementation.
> Do not rename or recreate APIs without inspecting the code.

## Server Responsibilities
Server-side operations may include:
- Ride creation
- Ride request creation
- Atomic ride acceptance
- Cancellation
- Contact retrieval
- Push notification delivery
- Administrative operations

## Input Validation
All sensitive server operations must validate:
- Authenticated user
- Ownership
- Role
- Resource existence
- Allowed state transition
- Input format

## Contact Retrieval
The contact function must:
1. Verify authentication.
2. Verify both users belong to the same confirmed ride.
3. Return only authorized contact data.
4. Do not expose phone numbers before confirmation.

## Error Handling
Do not expose:
- Database passwords
- Stack traces
- Internal secrets

Return useful but safe errors, for example:
- `RESOURCE_NOT_FOUND`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `RIDE_FULL`
- `DUPLICATE_REQUEST`

## Health Endpoint
The backend should provide a simple health endpoint.
- *Example:* `/health`
- Response may indicate application status and service health.
- It should not redirect to the frontend.
