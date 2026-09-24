# EcoPoints API Contracts

## Overview
This document defines the request and response schemas for all backend endpoints in the EcoPoints system. All APIs follow REST principles with JSON payloads, use HTTP status codes appropriately, and implement consistent error handling. Authentication is required for all endpoints unless explicitly noted as public.

## Common Patterns

### Authentication
- All protected endpoints require a valid Supabase JWT in the Authorization header: `Authorization: Bearer <jwt_token>`
- Token validation is handled by Supabase at the API Gateway level
- JWT must contain `sub` (user ID) claim
- Expired tokens result in 401 Unauthorized

### Request Format
- Content-Type: `application/json` for all JSON endpoints
- UTF-8 encoding
- Request body must be valid JSON
- Maximum request size: 1MB (except file upload endpoints)
- Unknown fields are rejected (strict validation)

### Response Format
- Content-Type: `application/json`
- UTF-8 encoding
- Success responses follow defined schemas
- Error responses follow standard error format
- Timestamps in ISO 8601 format (UTC)
- UUIDs in standard lowercase format

### Error Handling
All errors follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Optional field-specific validation errors
      "field_name": ["Error message 1", "Error message 2"]
    }
  }
}
```

HTTP Status Codes:
- 2xx: Success
- 400: Bad Request (client error - validation, missing fields)
- 401: Unauthorized (missing or invalid authentication)
- 403: Forbidden (authenticated but insufficient permissions)
- 404: Not Found (resource doesn't exist)
- 409: Conflict (resource conflict - duplicate submission)
- 422: Unprocessable Entity (semantic errors)
- 429: Too Many Requests (rate limiting)
- 500: Internal Server Error (unexpected server error)
- 502: Bad Gateway (downstream service error)
- 503: Service Unavailable (temporary overload/maintenance)
- 504: Gateway Timeout (downstream timeout)

### Pagination
List endpoints support pagination:
```json
{
  "data": [...], // Array of items
  "pagination": {
    "page": 1, // Current page (1-indexed)
    "limit": 20, // Items per page
    "total": 150, // Total items available
    "pages": 8, // Total pages
    "has_next": true,
    "has_prev": false
  }
}
```
Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field (default: created_at)
- `order`: asc or desc (default: desc)

### Filtering
List endpoints support filtering via query parameters:
- Exact match: `field=value`
- Not equal: `field_ne=value`
- Greater than: `field_gt=value`
- Greater than or equal: `field_gte=value`
- Less than: `field_lt=value`
- Less than or equal: `field_lte=value`
- In list: `field_in=value1,value2,value3`
- Not in list: `field_not_in=value1,value2,value3`
- Contains (string): `field_contains=substring`
- Starts with: `field_startswith=prefix`
- Ends with: `field_endswith=suffix`

### Idempotency
For actions that should not be repeated (submissions, redemptions):
- Clients should generate a unique idempotency key (UUID v4)
- Send as `Idempotency-Key: <key>` header
- Server stores key with request and returns same response for repeat requests
- Key expires after 24 hours
- Prevents duplicate submissions/redemptions on network retries

### Rate Limiting
All endpoints implement rate limiting:
- Per IP: 100 requests/minute (burst 200)
- Per authenticated user: 50 requests/minute (burst 100)
- Stricter limits on sensitive endpoints:
  - Submission creation: 10/hour per user
  - Reward redemption: 5/hour per user
  - Password reset: 3/hour per IP
- Response includes headers:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Seconds until reset
  - `Retry-After`: Seconds to wait (when 429)

## Public Endpoints

These endpoints do not require authentication.

### GET /api/v1/health
Health check endpoint for monitoring and load balancers.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-21T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "storage": "healthy",
    "ai_service": "healthy"
  }
}
```

### GET /api/v1/rewards
Get list of available rewards (public catalog).

**Query Parameters:**
- `category`: Filter by reward category
- `available_only`: Boolean (default: true)
- `sort`: Sort field (default: points_cost)
- `order`: asc or desc
- `page`, `limit`: Pagination

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Reward Title",
      "description": "Reward description",
      "points_cost": 500,
      "category": "eco-friendly",
      "image_url": "https://...",
      "available": true,
      "inventory_limit": 100,
      "inventory_remaining": 75,
      "valid_from": "2026-09-01T00:00:00Z",
      "valid_until": "2026-12-31T23:59:59Z",
      "fulfilled_count": 25
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

### GET /api/v1/leaderboard
Get public leaderboard (anonymized).

**Query Parameters:**
- `timeframe`: all_time, monthly, weekly (default: all_time)
- `limit`: Number of entries (default: 10, max: 50)
- `region`: Geographic filter (future)

**Response:**
```json
{
  "data": [
    {
      "rank": 1,
      "display_name": "EcoWarrior42",
      "avatar_url": "https://.../avatar.png",
      "points": 1250,
      "badge": "platinum_recycler"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1250,
    "pages": 125,
    "has_next": true,
    "has_prev": false
  }
}
```

## Protected Endpoints

All endpoints below require authentication unless otherwise noted.

### Authentication Endpoints

#### POST /api/v1/auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "full_name": "John Doe",
  "referral_code": "optional_ref_code" // optional
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "avatar_url": null,
    "created_at": "2026-09-21T10:30:00Z",
    "is_active": true,
    "email_verified": false
  },
  "session": {
    "access_token": "jwt_token_here",
    "refresh_token": "refresh_token_here",
    "expires_in": 3600
  }
}
```

#### POST /api/v1/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "avatar_url": "https://.../avatar.jpg",
    "created_at": "2026-09-20T15:20:00Z",
    "is_active": true,
    "email_verified": true,
    "last_login_at": "2026-09-21T10:30:00Z"
  },
  "session": {
    "access_token": "jwt_token_here",
    "refresh_token": "refresh_token_here",
    "expires_in": 3600
  }
}
```

#### POST /api/v1/auth/logout
Logout current session (invalidate refresh token).

**Request:** (empty body)
**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

#### POST /api/v1/auth/refresh-refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refresh_token": "refresh_token_here"
}
```

**Response (200 OK):**
```json
{
  "access_token": "new_jwt_token_here",
  "expires_in": 3600
}
```

#### POST /api/v1/auth/reset-password
Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "If an account exists with that email, a reset link has been sent"
}
```

#### POST /api/v1/auth/reset-password-confirm
Confirm password reset with token.

**Request:**
```json
{
  "token": "reset_token_from_email",
  "password": "newSecurePassword456!"
}
```

**Response (200 OK):**
```json
{
  "message": "Password has been reset successfully"
}
```

### User Profile Endpoints

#### GET /api/v1/profile
Get current user's profile.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://.../avatar.jpg",
  "created_at": "2026-09-20T15:20:00Z",
  "updated_at": "2026-09-21T09:15:00Z",
  "is_active": true,
  "email_verified": true,
  "last_login_at": "2026-09-21T10:30:00Z",
  "total_points": 1250,
  "member_since": "2026-09-20",
  "preferences": {
    "email_notifications": true,
    "push_notifications": true,
    "newsletter": false,
    "privacy_level": "standard"
  }
}
```

#### PUT /api/v1/profile
Update current user's profile.

**Request:**
```json
{
  "full_name": "John Doe",
  "avatar_url": "https://.../new-avatar.jpg", // optional
  "preferences": {
    "email_notifications": false,
    "newsletter": true
  }
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://.../new-avatar.jpg",
  "created_at": "2026-09-20T15:20:00Z",
  "updated_at": "2026-09-21T10:45:00Z",
  "is_active": true,
  "email_verified": true,
  "last_login_at": "2026-09-21T10:30:00Z",
  "total_points": 1250,
  "preferences": {
    "email_notifications": false,
    "push_notifications": true,
    "newsletter": true,
    "privacy_level": "standard"
  }
}
```

### Submission Endpoints

#### POST /api/v1/submissions
Create a new recycling submission.

**Headers:**
- `Idempotency-Key`: <uuid> (strongly recommended to prevent duplicates)

**Request:**
```json
{
  "image_url": "https://supabase-storage-url.com/bucket/path/image.jpg",
  "image_hash": "sha256_hash_of_image_file",
  "latitude": 40.7128, // optional
  "longitude": -74.0060, // optional
  "accuracy": 15.0 // optional, GPS accuracy in meters
}
```

**Response (202 Accepted):**
```json
{
  "submission_id": "uuid",
  "status": "processing",
  "message": "Submission received and queued for verification",
  "estimated_processing_time": "30 seconds"
}
```

#### GET /api/v1/submissions/{id}
Get a specific submission by ID.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "image_url": "https://supabase-storage-url.com/bucket/path/image.jpg",
  "image_hash": "sha256_hash_of_image_file",
  "submitted_at": "2026-09-21T10:25:00Z",
  "status": "approved",
  "verification_result": {
    "is_recyclable_item": true,
    "material": "plastic",
    "item_type": "water_bottle",
    "quantity": 2.0,
    "condition": "clean",
    "confidence": 0.92,
    "contamination_detected": false,
    "reason": "Clear image of two clean plastic water bottles"
  },
  "points_awarded": 20,
  "processed_at": "2026-09-21T10:25:30Z",
  "reviewed_by": null,
  "reviewed_at": null
}
```

#### GET /api/v1/submissions
Get list of user's submissions.

**Query Parameters:**
- `status`: pending, processing, approved, rejected, review
- `sort`: submitted_at, processed_at, points_awarded
- `order`: asc or desc (default: desc)
- `page`, `limit`: Pagination (default: page=1, limit=20)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "image_url": "https://.../image1.jpg",
      "submitted_at": "2026-09-21T10:25:00Z",
      "status": "approved",
      "material": "plastic",
      "points_awarded": 20,
      "processed_at": "2026-09-21T10:25:30Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

#### DELETE /api/v1/submissions/{id}
Delete a submission (only if still pending/processing).

**Response (200 OK):**
```json
{
  "message": "Submission deleted successfully"
}
```

### Points Endpoints

#### GET /api/v1/points/balance
Get current user's points balance.

**Response (200 OK):**
```json
{
  "balance": 1250,
  "currency": "points",
  "last_updated": "2026-09-21T10:30:00Z",
  "breakdown": {
    "total_earned": 1500,
    "total_spent": 250,
    "pending_approval": 0
  }
}
```

#### GET /api/v1/points/transactions
Get user's points transaction history (ledger).

**Query Parameters:**
- `type`: submission_award, reward_redeem, admin_adjust, expiration, correction
- `start_date`: ISO date string (inclusive)
- `end_date`: ISO date string (inclusive)
- `sort`: created_at (default: desc)
- `page`, `limit`: Pagination (default: page=1, limit=50)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "amount": 20,
      "transaction_type": "submission_award",
      "description": "Recycling submission: water_bottle (plastic)",
      "related_id": "submission_uuid",
      "created_at": "2026-09-21T10:25:30Z",
      "balance_after": 1250
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 125,
    "pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

### Reward Endpoints

#### GET /api/v1/rewards/{id}
Get details of a specific reward.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "title": "Reusable Shopping Bag Set",
  "description": "Set of 5 reusable produce bags made from recycled materials",
  "points_cost": 300,
  "category": "eco-friendly",
  "image_url": "https://.../reward-image.jpg",
  "available": true,
  "inventory_limit": 500,
  "inventory_remaining": 423,
  "valid_from": "2026-09-01T00:00:00Z",
  "valid_until": "2026-12-31T23:59:59Z",
  "fulfillment_type": "physical_shipping",
  "requires_address": true,
  "digital_delivery": false,
  "rating": 4.5,
  "review_count": 128
}
```

#### POST /api/v1/rewards/redeem
Redeem a reward using points.

**Headers:**
- `Idempotency-Key`: <uuid> (required to prevent double redemption)

**Request:**
```json
{
  "reward_id": "uuid",
  "shipping_address": { // required if reward.requires_address=true
    "name": "John Doe",
    "street": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "postal_code": "12345",
    "country": "US",
    "phone": "555-123-4567"
  }
}
```

**Response (200 OK):**
```json
{
  "redemption_id": "uuid",
  "reward_id": "uuid",
  "points_cost": 300,
  "redeemed_at": "2026-09-21T11:15:00Z",
  "status": "pending",
  "estimated_fulfillment": "3-5 business days",
  "tracking_number": null,
  "new_points_balance": 950
}
```

#### GET /api/v1/rewards/redemptions
Get user's reward redemption history.

**Query Parameters:**
- `status`: pending, processing, shipped, delivered, cancelled
- `sort`: redeemed_at (default: desc)
- `page`, `limit`: Pagination

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "reward": {
        "id": "uuid",
        "title": "Reusable Shopping Bag Set",
        "image_url": "https://.../reward-image.jpg"
      },
      "points_cost": 300,
      "redeemed_at": "2026-09-21T11:15:00Z",
      "status": "delivered",
      "tracking_number": "1Z999AA10123456784",
      "delivered_at": "2026-09-25T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

### Leaderboard Endpoints (Protected Version)

#### GET /api/v1/leaderboard/personal
Get user's position and nearby competitors on leaderboard.

**Query Parameters:**
- `timeframe`: all_time, monthly, weekly (default: all_time)
- `neighbors`: Number of competitors above/below to show (default: 5)

**Response (200 OK):**
```json
{
  "user": {
    "rank": 42,
    "points": 1250,
    "percentile": 78.5
  },
  "neighbors_above": [
    {
      "rank": 37,
      "display_name": "GreenGuru",
      "points": 1380
    }
  ],
  "neighbors_below": [
    {
      "rank": 47,
      "display_name": "EcoNovice",
      "points": 1120
    }
  ],
  "timeframe": "all_time",
  "total_users": 12500
}
```

## Administrative Endpoints

These endpoints require administrative privileges (moderator or admin role).

### Moderator Endpoints

#### GET /api/v1/moderator/queue
Get submissions awaiting review.

**Query Parameters:**
- `sort`: submitted_at, confidence (default: submitted_at)
- `order`: asc or desc
- `page`, `limit`: Pagination

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "submitted_at": "2026-09-21T09:15:00Z",
      "image_url": "https://.../image.jpg",
      "verification_result": {
        "is_recyclable_item": true,
        "material": "plastic",
        "confidence": 0.65,
        "reason": "Appears to be a plastic container but image is blurry"
      },
      "time_in_queue": "45 minutes",
      "priority": "medium" // based on potential points, user history, etc.
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 125,
    "pages": 7,
    "has_next": true,
    "has_prev": false
  }
}
```

#### POST /api/v1/moderator/submissions/{id}/review
Review a submission (approve/reject).

**Request:**
```json
{
  "action": "approve" // or "reject"
  "notes": "Clear image of recyclable item" // optional
}
```

**Response (200 OK):**
```json
{
  "submission_id": "uuid",
  "action": "approve",
  "points_awarded": 15,
  "new_points_balance": 875,
  "message": "Submission approved and points awarded"
}
```

### Admin Endpoints

#### GET /api/v1/admin/stats
Get system statistics (admin only).

**Response (200 OK):**
```json
{
  "users": {
    "total": 12500,
    "active_30d": 8750,
    "new_today": 42,
    "premium": 1250
  },
  "submissions": {
    "total_today": 342,
    "approved_today": 215,
    "rejected_today": 95,
    "review_today": 32,
    "avg_processing_time": "28 seconds"
  },
  "points": {
    "total_circulating": 4250000,
    "awarded_today": 8500,
    "redeemed_today": 3200
  },
  "rewards": {
    "total_redemptions_today": 45,
    "popular_reward": "Reusable Shopping Bag Set",
    "inventory_alerts": 3
  }
}
```

#### POST /api/v1/admin/points/adjust
Manually adjust user's points (admin only).

**Request:**
```json
{
  "user_id": "uuid",
  "amount": 500, // can be negative
  "reason": "Compensation for service downtime",
  "reference_id": "optional_reference" // e.g., ticket number
}
```

**Response (200 OK):**
```json
{
  "transaction_id": "uuid",
  "user_id": "uuid",
  "amount": 500,
  "balance_before": 1250,
  "balance_after": 1750,
  "message": "Points adjustment successful"
}
```

#### GET /api/v1/admin/audit-logs
Get administrative audit logs.

**Query Parameters:**
- `action_type`: login, submission_review, points_adjust, etc.
- `user_id`: Filter by admin user
- `target_type`: submission, user, reward
- `start_date`, `end_date`: Date range
- `sort`: timestamp (default: desc)
- `page`, `limit`: Pagination

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "admin_user_id": "uuid",
      "action_type": "points_adjust",
      "target_type": "user",
      "target_id": "user_uuid",
      "changes": {
        "amount": 500,
        "reason": "Compensation for service downtime"
      },
      "timestamp": "2026-09-21T14:30:00Z",
      "ip_address": "203.0.113.1",
      "user_agent": "Mozilla/5.0 (Admin Panel)"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "pages": 25,
    "has_next": true,
    "has_prev": false
  }
}
```

## WebSocket Endpoints (Future Real-Time Features)

### Notes
WebSocket endpoints are planned for future implementation to provide real-time updates.

#### WS /ws/v1/notifications
User-specific notifications feed.

**Message Types:**
- `submission_status`: {submission_id, status, points_awarded}
- `points_balance`: {balance, change, reason}
- `redemption_update`: {redemption_id, status, tracking_info}
- `system_alert`: {type, message, severity}
- `leaderboard_update`: {rank, points, percentile}

#### WS /ws/v1/leaderboard
Live leaderboard updates.

**Message Types:**
- `leaderboard_update`: {rank, display_name, points, change}
- `milestone_reached`: {user_id, milestone_type, value}

## Error Codes Reference

### Authentication Errors
- `AUTH_INVALID_TOKEN`: Invalid or expired JWT
- `AUTH_MISSING_TOKEN`: Authorization header missing
- `AUTH_INSUFFICIENT_SCOPE`: User lacks required permissions
- `AUTH_ACCOUNT_LOCKED`: Account temporarily locked due to failed attempts
- `AUTH_EMAIL_NOT_VERIFIED`: Email verification required
- `AUTH_PASSWORD_EXPIRED`: Password needs to be changed

### Validation Errors
- `VALIDATION_REQUIRED_FIELD`: Required field is missing
- `VALIDATION_INVALID_FORMAT`: Field format is invalid (email, URL, etc.)
- `VALIDATION_OUT_OF_RANGE`: Value is outside acceptable range
- `VALIDATION_INVALID_ENUM`: Value is not one of allowed options
- `VALIDATION_TOO_LONG`: Field exceeds maximum length
- `VALIDATION_TOO_SHORT`: Field is below minimum length

### Submission Errors
- `SUBMISSION_DUPLICATE`: Image matches recent submission (potential duplicate)
- `SUBMISSION_INVALID_IMAGE`: File is not a valid image or corrupt
- `SUBMISSION_UNSUPPORTED_FORMAT`: Image format not supported (use JPG, PNG, WebP)
- `SUBMISSION_TOO_LARGE`: Image exceeds maximum size limit
- `SUBMISSION_PROCESSING_FAILED`: Internal error during verification
- `SUBMISSION_RATE_LIMITED`: User has exceeded submission frequency limits

### Points Errors
- `POINTS_INSUFFICIENT_BALANCE`: User does not have enough points for action
- `POINTS_INVALID_TRANSACTION`: Invalid points transaction attempted
- `POINTS_LEDGER_ERROR`: Error accessing points ledger
- `POINTS_DAILY_LIMIT_EXCEEDED`: User has exceeded daily points earning limit
- `POINTS_WEEKLY_LIMIT_EXCEEDED`: User has exceeded weekly points earning limit

### Reward Errors
- `REWARD_NOT_FOUND`: Reward with specified ID does not exist
- `REWARD_UNAVAILABLE`: Reward is not currently available for redemption
- `REWARD_INSUFFICIENT_INVENTORY`: Reward is out of stock
- `REWARD_REDEMPTION_LIMIT_EXCEEDED`: User has exceeded redemption limit for this reward
- `REWARD_INVALID_ADDRESS`: Shipping address is invalid or incomplete
- `REWARD_ALREADY_REDEEMED`: User has already redeemed this reward (if limited)

### System Errors
- `SERVICE_UNAVAILABLE`: Required service is temporarily unavailable
- `EXTERNAL_SERVICE_ERROR`: Downstream service (AI, email, etc.) returned error
- `DATABASE_ERROR`: Error interacting with database
- `STORAGE_ERROR`: Error storing or retrieving file
- `RATE_LIMIT_EXCEEDED`: Too many requests, try again later
- `IDEMPOTENCY_CONFLICT`: Request with same idempotency key but different parameters

## Versioning and Compatibility

### API Versioning
- Current version: `v1` (in URL path: `/api/v1/`)
- Version increments for breaking changes only
- Backward compatibility maintained within minor versions
- Deprecation policy: 6-month notice for deprecated endpoints
- Sunset period: 90 days after deprecation notice

### Content Negotiation
- Currently only supports `application/json`
- Future versions may support other formats via `Accept` header
- Version specified in URL, not headers (more cache-friendly)

### Deprecation Headers
When an endpoint is deprecated:
- `Deprecation: true`
- `Sunset: <date>` (ISO 8601 date when endpoint will be removed)
- `Link: <https://docs.ecopoints.io/api/v2/>; rel="successor-version"`

### Backward Compatibility Guarantees
- Adding new endpoints: Always safe
- Adding new optional fields: Always safe
- Adding new enum values: Safe if default handling provided
- Making required fields optional: Safe with default value
- Changing response format: Requires version bump
- Removing fields or endpoints: Requires version bump and deprecation period

## Security Considerations

### Input Validation
- All inputs validated against strict schemas
- SQL injection prevented via parameterized queries
- NoSQL injection prevented via document structure validation
- Command injection prevented via avoid shell execution
- XXE prevented via XML parser configuration
- Deserialization prevented via avoiding unsafe deserialization

### Output Encoding
- JSON responses properly encoded
- HTML escaping not needed (API-only)
- If web views added: Context-appropriate output encoding applied

### Communication Security
- All API traffic encrypted via TLS 1.2+
- HSTS enforced with long max-age
- Certificate Transparency monitoring
- OCSP stapling for certificate validation
- Forward secrecy enforced (ECDHE cipher suites)

### Access Control
- Authentication verified on every request
- Authorization checked for resource access
- Role-based access control enforced at API Gateway
- Row Level Security provides database-level protection
- Service role key never exposed to clients
- Admin endpoints require additional role verification

### Rate Limiting and Abuse Prevention
- Per-IP and per-user rate limiting
- Strategic endpoints have stricter limits
- Idempotency keys prevent duplicate operations
- Behavioral analysis for anomaly detection
- CAPTCHA challenges for suspicious patterns (planned)
- Account locking after excessive failed auth attempts

### Data Protection
- PII encrypted at rest (Supabase managed)
- Access logs exclude sensitive data
- Error messages avoid leaking system information
- Secure headers prevent clickjacking, MIME sniffing
- Referrer policy limits information leakage
- Cookies secured with HttpOnly, Secure, SameSite flags

## Change Log

### Version 1.0.0 (Initial Release)
- Initial API specification
- All endpoints documented
- Error codes and common patterns defined
- Authentication and authorization flows specified
- Pagination, filtering, and idempotency standards established

---

*This document is the authoritative source for EcoPoints API contracts. All implementations must adhere to these specifications. Changes to this document require version bump and appropriate deprecation notices.*