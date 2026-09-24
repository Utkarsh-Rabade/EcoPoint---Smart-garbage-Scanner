# EcoPoints System Architecture

## Overview
EcoPoints is an AI + IoT based recycling reward platform that incentivizes proper recycling behavior through a points-based reward system. Users submit images of their recycling, which are verified using AI (Gemini) and optionally supplemented with IoT sensor data from smart recycling bins.

## System Components

### 1. Frontend Layer
- **Technology**: React/Next.js (to be developed in Google Antigravity)
- **Responsibilities**: 
  - User interface for submitting recycling images
  - Displaying points balance and reward catalog
  - User profile and authentication flows
  - Leaderboard visualization
  - IoT device configuration (future)

### 2. API Gateway / Supabase Edge Functions
- **Technology**: Supabase Edge Functions (TypeScript)
- **Responsibilities**:
  - Handle all API requests from frontend
  - Authenticate and authorize requests
  - Route requests to appropriate services
  - Implement rate limiting and input validation
  - Serve as security boundary

### 3. Core Services
#### Authentication Service
- **Provider**: Supabase Auth
- **Responsibilities**:
  - User registration and login
  - JWT token management
  - OAuth providers (Google, Apple, etc.)
  - Session management
  - Password reset and email verification

#### Database Service
- **Provider**: Supabase PostgreSQL
- **Responsibilities**:
  - Store user profiles, submissions, verification results
  - Manage points transaction ledger
  - Track rewards and redemptions
  - Store IoT device data and events
  - Maintain audit logs

#### Storage Service
- **Provider**: Supabase Storage
- **Responsibilities**:
  - Store user-submitted recycling images
  - Manage file lifecycle and cleanup
  - Enforce access policies (private buckets)
  - Handle image optimization/thumbnails

#### AI Verification Service
- **Provider**: Google Gemini API (via Edge Functions)
- **Responsibilities**:
  - Analyze recycling submission images
  - Identify recyclable materials, item types, quantities
  - Detect contamination
  - Return structured verification results
  - **Note**: Does NOT award points directly

#### Points Service
- **Technology**: Supabase Edge Functions
- **Responsibilities**:
  - Calculate points based on verification results
  - Apply business rules (confidence thresholds, limits)
  - Update immutable points transaction ledger
  - Prevent point fraud and manipulation
  - Handle points expiration (if applicable)

#### Reward Service
- **Technology**: Supabase Edge Functions
- **Responsibilities**:
  - Manage reward catalog
  - Process reward redemptions
  - Validate user eligibility
  - Handle reward fulfillment
  - Track redemption history

#### IoT Service
- **Technology**: Supabase Edge Functions (Future)
- **Responsibilities**:
  - Receive data from smart recycling bins
  - Validate IoT-generated submissions
  - Correlate IoT data with image submissions
  - Handle device management and firmware updates
  - Process IoT-specific reward logic

## Service Boundaries

### Frontend ↔ API Gateway
- **Contract**: REST/JSON over HTTPS
- **Authentication**: Supabase JWT in Authorization header
- **Data Exchange**: User submissions, points balance, reward catalog

### API Gateway ↔ Core Services
- **Contract**: Internal function calls or direct database access
- **Authentication**: Service role key (never exposed to client)
- **Data Exchange**: Verified submission data, points transactions

### Core Services ↔ External Systems
- **Gemini API**: HTTPS API calls with API key (stored in secrets)
- **IoT Devices**: MQTT/HTTP endpoints (future implementation)
- **Email/SMS**: Supabase Auth notifications or third-party providers
- **Payment Providers**: For reward fulfillment (future)

## Request Flows

### 1. User Registration Flow
1. User submits registration form via frontend
2. Frontend calls Supabase Auth signup endpoint
3. Supabase Auth creates user account and sends verification email
4. Frontend displays success message and prompts for email verification
5. User clicks verification link in email
6. Supabase Auth marks email as verified
7. User can now log in

### 2. Login Flow
1. User submits login credentials via frontend
2. Frontend calls Supabase Auth signin endpoint
3. Supabase Auth validates credentials and returns JWT
4. Frontend stores JWT securely (httpOnly cookie or secure storage)
5. Frontend includes JWT in subsequent API requests

### 3. Submission Creation Flow
1. User captures/upload recycling image via frontend
2. Frontend validates image (size, type) and uploads to Supabase Storage
3. Frontend creates submission record via API Gateway
4. API Gateway validates authentication and creates submission in DB
5. API Gateway triggers verification Edge Function
6. Verification function calls Gemini AI API
7. Gemini returns structured analysis
8. Verification function stores results and applies business rules
9. Points Service calculates and awards points (if approved)
10. Frontend displays submission status and updated points balance

### 4. Points Awarding Flow
1. Verification function determines submission status (approved/rejected/review)
2. If approved, Points Service calculates points based on:
   - Material type and quantity
   - Item condition
   - Confidence score from AI
   - Daily/weekly limits
   - Anti-fraud checks
3. Points Service creates transaction in immutable ledger
4. User's total points balance is derived from summing ledger entries
5. Transaction is cryptographically signed for audit trail

### 5. Reward Redemption Flow
1. User selects reward from catalog via frontend
2. Frontend validates sufficient points balance
3. Frontend calls redeem-reward Edge Function
4. Function validates:
   - User authentication
   - Sufficient points balance
   - Reward availability
   - Redemption limits
5. Function creates points deduction transaction
6. Function marks reward as redeemed
7. Function returns redemption confirmation
8. Frontend updates UI and shows redemption details

### 6. Leaderboard Flow
1. Frontend requests leaderboard data via API Gateway
2. API Gateway queries database for top users by points
3. API Gateway returns anonymized/public profile data
4. Frontend displays leaderboard

## Authentication Flow

### User Authentication
- Uses Supabase Auth with email/password and OAuth providers
- JWT tokens issued on successful login
- Tokens have configurable expiration (typically 1 hour)
- Refresh tokens used to obtain new JWTs without re-authentication
- All API requests require valid JWT in Authorization header

### Service Authentication
- Edge Functions use Supabase service role key for backend operations
- Service role key stored securely in function secrets (never exposed)
- Service role bypasses RLS for administrative operations
- Frontend only ever uses anon/public keys

### API Key Management
- Gemini API key stored in Supabase Edge Function secrets
- Accessed via Deno.env.get() in Edge Functions
- Never committed to repository or exposed to frontend
- Rotated periodically through Supabase dashboard

## Image Verification Flow

### Input Validation
1. Frontend validates:
   - File size (< 10MB)
   - MIME type (image/jpeg, image/png, image/webp)
   - Basic image integrity
2. Uploaded to Supabase Storage in `submissions` bucket
3. Storage returns public URL (or signed URL for private access)

### AI Processing
1. Edge Function retrieves image from Storage
2. Converts image to appropriate format for Gemini
3. Sends to Gemini API with prompt:
   ```
   Analyze this recycling submission image. Identify:
   - Is this a recyclable item? (yes/no)
   - What material is it? (plastic, glass, metal, paper, cardboard, etc.)
   - What type of item is it? (bottle, can, carton, etc.)
   - Estimated quantity
   - Condition (clean, dirty, crushed, etc.)
   - Any contamination detected?
   - Confidence score (0-1)
   - Provide reasoning for your assessment
   ```
4. Gemini returns structured JSON response
5. Edge Function validates response structure and extracts key fields

### Business Rules Application
1. Confidence threshold check (minimum 0.7 for auto-approval)
2. Material validation (only accepted recyclable materials)
3. Duplicate detection (hash-based or metadata-based)
4. Frequency limiting (max submissions per hour/day)
5. Suspicious activity detection (geolocation anomalies, rapid fire submissions)
6. Final determination:
   - APPROVED: Award points based on verified data
   - REJECTED: No points, user notified of reason
   - REVIEW: Flagged for manual review, no points awarded

### Output
- Structured verification result stored in database
- Points transaction created if approved
- User notified of outcome via frontend
- Image retained for audit period (configurable)

## Points Flow

### Earning Points
1. Verified recycling submissions award points based on:
   - Base points per material type
   - Quantity multipliers
   - Condition bonuses/penalties
   - Streak bonuses (for consistent recycling)
   - Promotional multipliers (events, campaigns)
2. Points calculated deterministically in Points Service
3. Immutable transaction recorded in points_ledger table
4. User balance = SUM(points) from all ledger entries
5. Transactions cannot be modified or deleted (only corrected via reversing transaction)

### Spending Points
1. Reward redemptions create negative points transactions
2. Redemption validated against current balance
3. Balance check and deduction happen in single transaction
4. Insufficient balance prevents redemption
5. Redemption transactions marked with reward ID for tracking

### Point Properties
- Non-transferable between accounts
- Expire after period of inactivity (configurable, e.g., 12 months)
- Cannot be converted to cash or transferred externally
- Subject to fraud detection and potential forfeiture
- Audit trail maintained for all transactions

## Reward Redemption Flow

### Reward Catalog
- Admin-managed list of available rewards
- Each reward has:
  - Title and description
  - Points cost
  - Inventory limit (if physical)
  - Availability dates
  - Redemption restrictions (age, location, etc.)
  - Fulfillment method (digital code, physical shipping, etc.)

### Redemption Process
1. User selects reward and confirms redemption
2. Frontend validates local points balance
3. API Gateway calls redeem-reward function with:
   - User ID (from JWT)
   - Reward ID
   - Idempotency key (to prevent double redemption)
4. Function performs server-side validation:
   - User exists and is active
   - Reward exists and is available
   - User has sufficient points
   - Reward not already redeemed by user (if limited)
   - Within redemption limits (daily, etc.)
5. Function creates negative points transaction
6. Function records reward redemption with:
   - User ID
   - Reward ID
   - Points deducted
   - Timestamp
   - Fulfillment status (pending, shipped, delivered, etc.)
7. Function returns redemption confirmation
8. Frontend updates UI and shows estimated fulfillment time

### Fulfillment
- Digital rewards: Automatic code generation/email
- Physical rewards: Queued for manual fulfillment or integrated with 3rd party logistics
- Tracking information stored and made available to user
- Customer service interface for issue resolution

## Future IoT Integration

### Architecture Preparation
- Database schema includes iot_devices and iot_events tables
- Edge Functions designed to accept IoT telemetry
- Submission flow can be triggered by IoT events
- Hybrid verification possible (image + sensor data)
- Separate IoT authentication mechanism planned

### Planned IoT Features
- Smart recycling bins with fill-level sensors
- Weight measurement for precise quantity detection
- Material-specific sensors (conductivity for metal, etc.)
- Tamper detection and security features
- Solar-powered with cellular connectivity
- Geolocation tracking for route optimization

### Data Flow with IoT
1. IoT device detects recycling event
2. Device captures image (optional) and sensor data
3. Device submits to EcoPoints IoT endpoint
4. Endpoint validates device authentication
5. If image submitted, runs standard verification pipeline
6. Sensor data supplements or validates image analysis
7. Points awarded based on combined confidence
8. Device updates fill-level and maintenance status

## Failure Handling

### Graceful Degradation
- If Gemini API unavailable: Queue submissions for later processing
- If database unavailable: Queue API requests with retry mechanism
- If storage unavailable: Reject uploads with clear error message
- If points service unavailable: Prevent new submissions until recovered

### Error Handling
- All Edge Functions return consistent error format:
  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human readable message",
      "details": {} // Optional debug info
    }
  }
  ```
- HTTP status codes follow REST conventions:
  - 2xx: Success
  - 400: Client error (validation, auth)
  - 401: Unauthorized
  - 403: Forbidden
  - 404: Not found
  - 429: Rate limited
  - 5xx: Server error

### Retry Mechanisms
- Exponential backoff for external API calls
- Dead letter queues for failed submissions
- Manual review queue for perpetually failing items
- Alerting on persistent failure patterns

### Data Recovery
- Regular database snapshots via Supabase backup
- Point-in-time recovery capability
- Audit logs for all critical operations
- Manual intervention procedures for data corruption

## Security Boundaries

### Network Security
- All communication over HTTPS/TLS 1.2+
- Supabase managed networking with DDoS protection
- Edge Functions run in isolated environments
- Storage buckets with private access controls

### Application Security
- Row Level Security (RLS) enforces data access rules
- Input validation and sanitization at all boundaries
- Output encoding to prevent XSS (though API-focused)
- CSRF protection via SameSite cookies and token validation
- Rate limiting on all public endpoints
- JWT expiration and refresh token rotation

### Data Security
- Encryption at rest for database and storage
- Encryption in transit for all service communications
- API keys and secrets managed through Supabase secret store
- No sensitive data stored in frontend or logs
- PII minimization (only essential user data stored)
- GDPR/CCPA compliance features planned

### Audit and Monitoring
- Comprehensive audit logging for:
  - Authentication events
  - Points transactions
  - Reward redemptions
  - Administrative actions
  - Failed verification attempts
- Real-time alerting for suspicious patterns
- Regular security scanning and penetration testing
- Access logs retained for forensic analysis

## Technology Choices Rationale

### Supabase
- **Why**: Integrated PostgreSQL, Auth, Storage, and Edge Functions
- **Benefits**: Reduced operational overhead, strong security model, real-time capabilities
- **Alternatives Considered**: AWS/Firebase (more complex), self-hosted (higher ops burden)

### TypeScript
- **Why**: Type safety for backend services, shared types with future frontend
- **Benefits**: Fewer runtime errors, better IDE support, maintainability
- **Alternatives Considered**: JavaScript (too risky for financial logic), Python (less ideal for web services)

### Gemini AI
- **Why**: Strong multimodal capabilities for image understanding
- **Benefits**: Good recycling item recognition, structured JSON output
- **Alternatives Considered**: Custom ML model (too early stage), other vision APIs (less suited for reasoning)

### Architecture Principles
1. **Security First**: Never trust client, validate everything server-side
2. **Immutability**: Points ledger cannot be altered, only appended
3. **Separation of Concerns**: AI analysis separate from business decisions
4. **Auditability**: Every important action traceable to user/service
5. **Scalability**: Stateless functions that can scale horizontally
6. **Maintainability**: Clear boundaries and well-documented contracts