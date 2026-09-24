# EcoPoints Data Flow Documentation

## Overview
This document describes the flow of data through the EcoPoints system, covering all major user interactions and system processes. Data flows are designed with security, immutability, and auditability as core principles.

## Key Data Entities

### 1. User Profile
- `id` (UUID): Primary key
- `email` (String): User's email address
- `full_name` (String): User's display name
- `avatar_url` (String): URL to profile image
- `created_at` (Timestamp): Account creation time
- `updated_at` (Timestamp): Last profile update
- `is_active` (Boolean): Account status
- `last_login_at` (Timestamp): Last successful login
- `total_points` (Integer): Cached points balance (derived from ledger)
- `location` (JSON): Optional location data
- `preferences` (JSON): User settings and preferences

### 2. Submission
- `id` (UUID): Primary key
- `user_id` (UUID): Foreign key to profiles
- `image_url` (String): URL to stored image in Supabase Storage
- `image_hash` (String): SHA-256 hash for duplicate detection
- `submitted_at` (Timestamp): When submission was made
- `status` (Enum): pending, processing, approved, rejected, review
- `verification_result` (JSONB): AI verification output
- `points_awarded` (Integer): Points granted (0 if not approved)
- `processed_at` (Timestamp): When verification completed
- `reviewed_by` (UUID): Admin who reviewed (if applicable)
- `reviewed_at` (Timestamp): When manual review completed
- `ip_address` (String): Submitter's IP address (for fraud detection)
- `user_agent` (String): Submitter's browser/client info

### 3. Verification Result
- `is_recyclable_item` (Boolean): AI's determination
- `material` (String): Detected material type
- `item_type` (String): Detected item category
- `quantity` (Float): Estimated quantity
- `condition` (String): Item condition assessment
- `confidence` (Float): AI confidence score (0.0-1.0)
- `contamination_detected` (Boolean): Whether contamination was found
- `visible
- `reason` (String): AI's explanation for determination
- `processed_model` (String): Gemini model version used
- `processed_at` (Timestamp): When AI processing completed

### 4. Points Transaction (Immutable Ledger)
- `id` (UUID): Primary key
- `user_id` (UUID): Foreign key to profiles
- `amount` (Integer): Points change (positive for earning, negative for spending)
- `transaction_type` (Enum): submission_award, reward_redeem, admin_adjust, expiration, correction
- `related_id` (UUID): Foreign key to submission, reward_redemption, etc. (nullable)
- `description` (String): Human-readable transaction description
- `created_at` (Timestamp): When transaction occurred
- `batch_id` (UUID): For grouping related transactions (nullable)
- `merkle_proof` (String): Cryptographic proof for audit (future enhancement)
- `reversing_transaction_id` (UUID): If this transaction reverses another (for corrections)

### 5. Reward Redemption
- `id` (UUID): Primary key
- `user_id` (UUID): Foreign key to profiles
- `reward_id` (UUID): Foreign key to rewards catalog
- `points_cost` (Integer): Points deducted for redemption
- `redeemed_at` (Timestamp): When redemption occurred
- `fulfillment_status` (Enum): pending, processing, shipped, delivered, cancelled
- `tracking_number` (String): Shipping tracking info (if applicable)
- `fulfillment_notes` (String): Notes from fulfillment team
- `shipping_address` (JSON): For physical rewards
- `digital_code` (String): For digital rewards (encrypted at rest)
- `expires_at` (Timestamp): If reward has expiration

### 6. IoT Device (Future)
- `id` (UUID): Primary key
- `device_id` (String): Unique device identifier
- `user_id` (UUID): Foreign key to profiles (nullable for public bins)
- `location` (JSON): GPS coordinates
- `installation_date` (Timestamp): When deployed
- `last_seen_at` (Timestamp): Last communication from device
- `battery_level` (Integer): Percentage remaining
- `fill_level` (Integer): Current capacity percentage
- `status` (Enum): active, maintenance, inactive, lost
- `firmware_version` (String): Current firmware
- `capabilities` (JSONB): Supported sensors and features

### 7. IoT Event (Future)
- `id` (UUID): Primary key
- `device_id` (UUID): Foreign key to iot_devices
- `event_type` (Enum): deposit, weight_change, tamper, environmental
- `timestamp` (Timestamp): When event occurred
- `weight_grams` (Integer): Measured weight
- `fill_level_before` (Integer): Percentage before event
- `fill_level_after` (Integer): Percentage after event
- `image_url` (String): Optional captured image
- `sensor_data` (JSONB): Raw sensor readings
- `processed` (Boolean): Whether event has been processed into submission
- `related_submission` (UUID): Foreign key to submissions (if processed)

## Data Flows

### 1. User Onboarding Flow

#### Data Elements: Email, password, name → User profile record

```
Frontend → Supabase Auth (signup) → Supabase Auth DB
                                    ↓
                            Email Verification Sent
                                    ↓
              User clicks link → Supabase Auth (verify)
                                    ↓
                    Auth DB updated (email_verified=true)
                                    ↓
              Frontend receives success → User can login
```

#### Data Storage:
- Auth data: Supabase Auth internal tables (email, encrypted password hash, etc.)
- Profile data: `profiles` table (created via Auth trigger on signup)
- No sensitive data stored in logs or client-side

### 2. Authentication Flow

#### Data Elements: Credentials → JWT tokens

```
Login Attempt:
Frontend (email/password) → Supabase Auth (signin)
                                    ↓
              Valid credentials → JWT + Refresh Token issued
                                    ↓
              Frontend stores tokens securely
                                    ↓
              Subsequent requests include JWT in Authorization header

Token Refresh:
Frontend (refresh_token) → Supabase Auth (refresh)
                                    ↓
              Valid token → New JWT issued
                                    ↓
              Frontend updates stored JWT
```

#### Data Storage:
- Auth tokens: Securely stored in frontend (httpOnly cookie or secure storage)
- Never stored in logs or exposed to client-side JavaScript
- Refresh token rotation implemented for security

### 3. Submission Creation Flow

#### Data Elements: Image file → Submission record + Image storage + Verification result → Points transaction

```
Step 1: Image Upload
Frontend (image file) → Client-side validation (size, type)
                                    ↓
              Valid → Supabase Storage (submissions bucket)
                                    ↓
              Storage returns: image_url, image_hash (SHA-256)
                                    ↓
              Frontend stores image_url/hash temporarily

Step 2: Submission Record Creation
Frontend → API Gateway (create-submission) 
                                    ↓
              Validate JWT + image_url
                                    ↓
              Create submission record: status=pending
                                    ↓
              Return submission_id to frontend

Step 3: Verification Trigger
API Gateway → Edge Function (verify-submission) via internal call
                                    ↓
              Update submission: status=processing
                                    ↓
              Fetch image from Supabase Storage
                                    ↓
              Call Gemini API with image
                                    ↓
              Receive structured verification result
                                    ↓
              Store verification_result in submission
                                    ↓
              Apply business rules (confidence, limits, etc.)
                                    ↓
              Determine status: approved/rejected/review
                                    ↓
              If approved: Call points-service to award points
                                    ↓
              Update submission: status=final, points_awarded, processed_at
                                    ↓
              Return result to API Gateway

Step 4: Points Awarding (if approved)
Edge Function (award-points) → Points Service logic
                                    ↓
              Calculate points based on:
                - Material type (plastic=10pts, glass=15pts, etc.)
                - Quantity multiplier
                - Condition bonus/penalty
                - Daily/weekly caps
                - Anti-fraud score
              ↓
              Create points_transaction record:
                - user_id, amount (positive)
                - transaction_type=submission_award
                - related_id=submission.id
                - description="Recycling submission: [item_type] ([material])"
              ↓
              Update user's cached total_points (optional optimization)
              ↓
              Return transaction_id

Step 5: Frontend Update
API Gateway → Frontend
                                    ↓
              Frontend updates:
                - Submission status display
                - Points balance (from transaction or recalc)
                - User feedback (success/error message)
```

#### Data Storage:
- Images: Supabase Storage `submissions` bucket (private)
- Submission records: `submissions` table
- Verification results: JSONB column in `submissions` table
- Points transactions: `points_transactions` table (append-only ledger)
- Audit trail: All changes tracked via database triggers (future)

### 4. Points Balance Calculation Flow

#### Data Elements: Points transactions → Current balance

```
Method 1: Cached Value (Optimized)
Frontend → API Gateway (get-user-profile)
                                    ↓
              Return cached total_points from profiles table
              ↓
              Updated via trigger on points_transactions insert/update/delete

Method 2: Real-time Calculation (Accurate)
Frontend → API Gateway (get-points-balance)
                                    ↓
              SELECT SUM(amount) FROM points_transactions 
              WHERE user_id = ? AND created_at <= NOW()
              ↓
              Return exact balance
```

#### Data Flow:
- Every points transaction insert/update triggers balance update
- Balance stored in `profiles.total_points` for performance
- Recalculated periodically or on discrepancy detection
- Immutable ledger ensures balance can always be recalculated from scratch

### 5. Reward Redemption Flow

#### Data Elements: Reward selection → Points deduction → Redemption record

```
Step 1: Redemption Request
Frontend (reward_id) → API Gateway (redeem-reward)
                                    ↓
              Validate JWT + reward_id + idempotency_key
                                    ↓
              Check local points balance (optimistic)
                                    ↓
              Proceed to server validation

Step 2: Server Validation
API Gateway → Edge Function (redeem-reward)
                                    ↓
              Validate:
                - User exists and active
                - Reward exists and available
                - Sufficient points balance (SELECT SUM...)
                - Not already redeemed (if limited)
                - Within daily/weekly limits
                - Idempotency key not used before
              ↓
              If valid: Proceed to deduction

Step 3: Points Deduction
Edge Function → Points Service
                                    ↓
              Create points_transaction record:
                - user_id, amount (negative)
                - transaction_type=reward_redeem
                - related_id=reward_redemption.id (to be created)
                - description="Redeemed reward: [reward_title]"
              ↓
              Return transaction_id

Step 4: Redemption Record Creation
Edge Function → Database
                                    ↓
              Create reward_redemption record:
                - user_id, reward_id, points_cost
                - transaction_id (from points deduction)
                - status=pending
                - redemption_timestamp=NOW()
              ↓
              Return redemption_id

Step 5: Fulfillment Trigger
Edge Function → (Optional) Fulfillment System
                                    ↓
              For digital rewards: Generate code immediately
              For physical rewards: Queue for fulfillment team
              ↓
              Update fulfillment_status accordingly

Step 6: Frontend Update
API Gateway → Frontend
                                    ↓
              Frontend updates:
                - Points balance (deducted)
                - Shows redemption confirmation
                - Provides tracking/digital code
```

#### Data Storage:
- Reward redemptions: `reward_redemptions` table
- Points transactions: `points_transactions` table (negative entries)
- Rewards catalog: `rewards` table (admin-managed)
- Fulfillment data: Stored in reward_redemption or separate table

### 6. Leaderboard Flow

#### Data Elements: User profiles → Leaderboard display

```
Frontend → API Gateway (get-leaderboard)
                                    ↓
              SELECT p.id, p.full_name, p.avatar_url, p.total_points
              FROM profiles p
              WHERE p.is_active = true
              ORDER BY p.total_points DESC
              LIMIT 10
              ↓
              Return anonymized data (no email, etc.)
              ↓
              Frontend displays leaderboard
```

#### Data Storage:
- Source: `profiles` table (total_points cached)
- No additional storage required
- Updated in real-time as points transactions occur

### 7. Administrative Flows

#### Data Elements: Admin actions → Audit logs

```
Admin Action (e.g., manual review):
Frontend (admin credentials) → Supabase Auth (signin)
                                    ↓
              Valid admin JWT → API Gateway (admin endpoint)
                                    ↓
              Validate admin role (via RBAC or profile flag)
              ↓
              Perform requested action:
                - Update submission status to review/approved/rejected
                - Award manual points
                - Modify reward inventory
                - Ban/user suspend
              ↓
              Log action to admin_audit_logs table
              ↓
              Return result to frontend
```

#### Data Storage:
- Admin audit logs: `admin_audit_logs` table
- Includes: admin_id, action_type, target_id, target_type, changes (JSONB), timestamp, ip_address
- Immutable and append-only for security

### 8. IoT Data Flow (Future)

#### Data Elements: Sensor data → Submission record

```
IoT Device → HTTPS/MQTT Endpoint (iot-submission)
                                    ↓
              Validate device authentication (JWT or API key)
              ↓
              Validate payload format and ranges
              ↓
              If image included: Store in Supabase Storage
              ↓
              Create submission record with:
                - Source flag: iot_generated
                - Sensor data attached
                - Status: pending_verification
              ↓
              Trigger standard verification pipeline
              ↓
              Combine AI analysis with sensor confidence
              ↓
              Award points based on fused confidence
              ↓
              Update device telemetry (fill-level, etc.)
```

#### Data Storage:
- IoT devices: `iot_devices` table
- IoT events: `iot_events` table
- Submission records: `submissions` table (with iot_source flag)
- Points transactions: Standard flow applies

## Data Consistency and Integrity

### Transactional Boundaries
- All financial operations (points awards/deductions) use database transactions
- Either all related operations succeed or all are rolled back
- Prevents points inconsistency between user balance and ledger

### Immutability Enforcement
- Points transactions table has DELETE triggers prevented
- Updates only allowed via correction transactions (which create new records)
- Application code never attempts to modify existing transactions
- Database permissions restrict direct table access

### Duplicate Prevention
- Image hash stored with each submission
- Unique constraint on (user_id, image_hash) with time window
- Similarity detection for near-duplicates (future: perceptual hashing)
- Idempotency keys for client-retriable operations

### Conflict Resolution
- Last-write-wins for profile updates (with timestamp)
- Manual review queue for conflicting verification results
- Escalation process for disputed points transactions
- Clear audit trail for all modifications

## Data Retention and Archival

### Active Data
- User profiles: Retained until account deletion
- Submissions: Retained for 2 years (adjustable by regulation)
- Verification results: Retained with submission
- Points transactions: Retained indefinitely (financial record)
- Reward redemptions: Retained for 7 years (tax/audit)
- Audit logs: Retained for 3 years (security compliance)

### Archival Process
- Monthly batch jobs move old data to cold storage
- Submissions >2 years: Moved to archival storage tier
- Access restored via request process
- Summary statistics retained for analytics
- Personal data purged upon GDPR deletion request

### Backup and Recovery
- Point-in-time recovery enabled (Supabase feature)
- Daily snapshots with 30-day retention
- Weekly full backups with 1-year retention
- Cross-region replication for disaster recovery
- Regular restore testing procedures

## Performance Considerations

### Caching Strategy
- Profile data: Cached in API Gateway for 5 minutes
- Leaderboard: Cached for 15 minutes (tolerates slight staleness)
- Reward catalog: Cached for 1 hour (admin-updated infrequently)
- Never cache: Points balance, submission status, auth tokens

### Database Optimization
- Indexes on foreign keys: user_id, reward_id, device_id
- Indexes on timestamps for time-range queries
- Partial indexes for active/inactive records
- Covering indexes for frequent query patterns
- Connection pooling via Supabase

### Storage Optimization
- Image compression upon upload (configurable quality)
- Thumbnail generation for preview images
- CDN caching for public assets (if any)
- Lifecycle rules to move old images to cheaper storage
- Virus scanning on upload (future)

### API Optimization
- Pagination on all list endpoints
- Field selection to minimize payload size
- ETag support for conditional requests
- Compression (gzip/brotli) enabled
- Rate limiting to prevent abuse

## Security Data Flows

### Authentication Data Flow
```
User Credentials → TLS → Supabase Auth
                                    ↓
              bcrypt hash comparison (never stores/plaintext password)
                                    ↓
              JWT signed with Supabase secret
                                    ↓
              JWT returned over TLS to client
                                    ↓
              Client stores JWT securely (httpOnly/secure storage)
                                    ↓
              JWT sent in Authorization header over TLS
                                    ↓
              API Gateway verifies JWT signature
                                    ↓
              Supabase validates JWT via JWKS endpoint
```

### Authorization Data Flow
```
Request with JWT → API Gateway
                                    ↓
              Extract user_id from JWT claims
                                    ↓
              Apply RLS policies:
                - Users can only SELECT/UPDATE own profile
                - Users can only INSERT own submissions
                - Users can only SELECT own submissions
                - Users cannot directly modify points_transactions
                - Admin roles have elevated permissions
                                    ↓
              Database enforces row-level access
```

### Secret Management Flow
```
Secrets (API keys, etc.) → Supabase Secret Store
                                    ↓
              Edge Function runtime → Deno.env.get()
                                    ↓
              Used only in memory during execution
                                    ↓
              Never logged or exposed in errors
                                    ↓
              Rotated via Supabase dashboard (no redeploy needed)
```

### Audit Trail Data Flow
```
Security-relevant event → Application code
                                    ↓
              Create audit record:
                - Actor (user_id or service)
                - Action type
                - Target entity and ID
                - Changes (before/after diff for updates)
                - Timestamp, IP address, user agent
                                    ↓
              Insert into admin_audit_logs table
                                    ↓
              Table append-only, no updates/deletes allowed
                                    ↓
              Regular export to SIEM for analysis
                                    ↓
              Retained per compliance requirements
```

## Failure Scenarios and Data Safety

### Network Partition
- Frontend queues submissions offline (via service worker)
- API Gateway returns 503 with retry-after header
- Edge Functions fail fast, no partial processing
- Database writes use transactions, no partial commits
- Recovery: Queued submissions processed on reconnect

### Database Failure
- Read replicas available for non-critical queries
- Write operations queued with exponential backoff
- Circuit breaker prevents cascading failures
- Recovery: Automatic failover to healthy instance
- Data loss prevented by WAL and snapshots

### Storage Failure
- Uploads rejected with clear error message
- Alternative: User can retry later
- Existing submissions unaffected
- Recovery: Automatic failover to redundant storage

### AI Service Failure
- Submissions queued for later processing
- Dead letter queue after N failed attempts
- Manual review queue for perpetually failing items
- Fallback: Basic heuristics (not for points awarding)
- Recovery: Process queued items when service restored

### Points Ledger Corruption
- Impossible through normal operations (append-only + constraints)
- Recovery from backup if somehow corrupted
- Audit trail allows reconstruction of correct state
- Regular checksum verification planned (future)

## Data Privacy and Compliance

### Personal Data Handling
- Email: Stored encrypted at rest, used only for auth/notifications
- Name: Stored for display, optional
- IP address: Stored for fraud detection, purged after 30 days
- User agent: Stored for analytics, purged after 90 days
- Location: Optional, stored only if user consents
- Images: Stored with user consent, deletable on request
- No payment information stored directly (handled by 3rd party)

### Data Subject Rights
- Access: API endpoint to export user data
- Rectification: Profile update endpoints
- Erasure: Account deletion anonymizes data
- Portability: Export in standard JSON format
- Objection: Opt-out of analytics/processing
- Restriction: Ability to freeze account temporarily

### Compliance Features
- GDPR: Right to be forgotten, data portability, breach notification
- CCPA: Right to know, delete, opt-out of sale
- Data minimization: Only collect necessary data
- Purpose limitation: Data used only for stated purposes
- Storage limitation: Defined retention periods
- Integrity and confidentiality: Encryption and access controls
- Accountability: Audit logs and compliance reporting

## Future Data Flow Enhancements

### Real-time Updates
- WebSocket connection for live points updates
- Server-sent events for submission status changes
- Collaborative features (future: community challenges)

### Advanced Analytics
- Event streaming to data warehouse (BigQuery/Snowflake)
- Batch processing for trend analysis
- Machine learning model training data pipeline
- Export APIs for research partners (anonymized)

### IoT Integration
- Device telemetry streaming
- Over-the-air (OTA) update management
- Fleet monitoring and analytics
- Predictive maintenance alerts

### Internationalization
- Multi-language support for all user-facing data
- Localized reward catalogs
- Region-specific recycling guidelines
- Currency-aware point valuations (future)