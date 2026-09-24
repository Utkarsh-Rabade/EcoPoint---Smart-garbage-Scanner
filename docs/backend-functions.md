# EcoPoints Backend Functions Structure

## Overview
This document outlines the structure and organization of EcoPoints backend functions implemented as Supabase Edge Functions. All business-critical decisions occur server-side in these functions, ensuring security, consistency, and auditability.

## Architecture Principles

### Separation of Concerns
Each Edge Function has a single, well-defined responsibility:
- **Atomic Operations**: Functions perform one specific task
- **Clear Input/Output**: Well-defined contracts for each function
- **Independence**: Functions can be developed, tested, and deployed independently
- **Reusability**: Common logic extracted to shared modules where appropriate

### Security-First Design
- **Authentication Verification**: All functions verify JWT tokens
- **Authorization Checks**: Functions enforce appropriate access controls
- **Input Validation**: Strict validation of all inputs
- **Principle of Least Privilege**: Functions run with minimal required permissions
- **Secure Defaults**: Fail-secure posture for error conditions

### Observability and Reliability
- **Structured Logging**: Consistent JSON logging for all functions
- **Error Handling**: Comprehensive error handling with meaningful messages
- **Timeout Management**: Appropriate timeouts for external service calls
- **Retry Logic**: Exponential backoff for transient failures
- **Circuit Breakers**: Protection against cascading failures

### Performance Considerations
- **Cold Start Optimization**: Minimal dependencies and initialization
- **Database Connection Pooling**: Efficient reuse of database connections
- **Caching**: Appropriate use of caching for frequently accessed data
- **Async Processing**: Non-blocking I/O where beneficial
- **Resource Limits**: Explicit memory and CPU limits

## Edge Function Organization

### Core Functions
These functions handle the primary user-facing operations:

#### 1. create-submission
**Purpose**: Handle new recycling submission creation
**Path**: `/api/v1/submissions`
**Method**: POST
**Authentication**: Required
**Responsibilities**:
- Verify user authentication
- Validate submission request (image URL, hash, optional location)
- Check idempotency key to prevent duplicate submissions
- Create submission record in database with status=`pending`
- Return submission ID and processing status
- Trigger verification process via internal function call

**Key Security Features**:
- Rate limiting (10 submissions/hour per user)
- Idempotency key validation
- Input sanitization and validation
- User-specific submission limits

#### 2. verify-submission
**Purpose**: Process submission through AI verification pipeline
**Path**: Internal function (called by create-submission and retry mechanisms)
**Method**: Internal call
**Authentication**: Service role (internal use only)
**Responsibilities**:
- Fetch image from Supabase Storage
- Validate image integrity and type
- Execute preprocessing pipeline (metadata stripping, format conversion)
- Call Gemini AI API with carefully crafted prompt
- Parse and validate AI response
- Apply postprocessing and normalization
- Execute business rules engine for final determination
- Update submission record with results and status
- Trigger points awarding if approved
- Handle errors and retry logic

**Key Security Features**:
- Service role only (not exposed to clients)
- Image validation before processing
- Prompt injection protection
- AI response validation and sanitization
- Rate limiting for AI API calls
- Secure handling of API keys via secrets

#### 3. award-points
**Purpose**: Award points for approved submissions or process redemptions
**Path**: Internal function (called by verify-submission and redeem-reward)
**Method**: Internal call
**Authentication**: Service role (internal use only)
**Responsibilities**:
- Calculate points based on verification results and business rules
- Apply daily/weekly caps and anti-fraud adjustments
- Create immutable points transaction record
- Update user's cached points balance (optimization)
- Ensure idempotency where appropriate
- Handle both positive (earnings) and negative (redemptions) amounts
- Create reversing transactions for corrections when needed

**Key Security Features**:
- Service role only with additional function-specific checks
- Immutable transaction ledger enforcement
- Database-level prevention of direct inserts/updates
- Transactional integrity for related operations
- Audit trail for all points movements

#### 4. redeem-reward
**Purpose**: Process reward redemption requests
**Path**: `/api/v1/rewards/redeem`
**Method**: POST
**Authentication**: Required
**Responsibilities**:
- Verify user authentication
- Validate reward redemption request (reward ID, idempotency key)
- Check reward availability and validity
- Verify user has sufficient points balance
- Prevent double redemption using idempotency key
- Call award-points function to deduct points
- Create reward redemption record
- Return redemption confirmation with new points balance
- Trigger fulfillment process (digital code generation or shipping queue)

**Key Security Features**:
- Idempotency key required to prevent double redemption
- Server-side points balance verification (not trusting client)
- Reward availability and validity checks
- Rate limiting (5 redemptions/hour per user)
- Fraud detection for unusual redemption patterns

### Supporting Functions
These functions support auxiliary operations and system maintenance:

#### 5. get-leaderboard
**Purpose**: Retrieve leaderboard data
**Path**: `/api/v1/leaderboard`
**Method**: GET
**Authentication**: Required (returns anonymized data)
**Responsibilities**:
- Query top users by points balance
- Apply timeframe filtering (all_time, monthly, weekly)
- Format response with anonymized user data
- Implement caching for performance
- Support pagination for large leaderboards

#### 6. get-user-profile
**Purpose**: Retrieve user profile information
**Path**: `/api/v1/profile`
**Method**: GET
**Authentication**: Required
**Responsibilities**:
- Return user profile data (excluding sensitive information)
- Include cached points balance for performance
- Support ETag for conditional requests
- Handle profile updates via separate endpoint

#### 7. update-user-profile
**Purpose**: Update user profile information
**Path**: `/api/v1/profile`
**Method**: PUT
**Authentication**: Required
**Responsibilities**:
- Validate update requests
- Update allowed profile fields (full_name, avatar_url, preferences)
- Update updated_at timestamp
- Return updated profile data
- Invalidate caches as needed

#### 8. get-rewards
**Purpose**: Retrieve available rewards catalog
**Path**: `/api/v1/rewards`
**Method**: GET
**Authentication**: Optional (public endpoint with filtering)
**Responsibilities**:
- Filter rewards by availability and validity
- Support category filtering
- Implement pagination
- Sort by points cost or other criteria
- Cache frequently accessed catalog data

#### 9. admin-moderate-submission
**Purpose**: Moderator review of submissions
**Path**: `/api/v1/moderator/submissions/{id}/review`
**Method**: POST
**Authentication**: Required (moderator/admin role)
**Responsibilities**:
- Verify moderator/admin authentication
- Validate submission exists and is in review state
- Process approve/reject decision with optional notes
- Update submission status and record moderator action
- Trigger points awarding if approved
- Return moderation result
- Log moderation action to audit trail

#### 10. admin-adjust-points
**Purpose**: Administrative points adjustment
**Path**: `/api/v1/admin/points/adjust`
**Method**: POST
**Authentication**: Required (admin role)
**Responsibilities**:
- Verify admin authentication
- Validate adjustment request (user ID, amount, reason)
- Create points transaction with type=`admin_adjust`
- Update user's cached points balance
- Return adjustment confirmation with before/after balances
- Log adjustment to audit trail with reference ID
- Prevent abuse through limits and approval workflows

### Shared Modules and Utilities
Common functionality extracted to reduce duplication:

#### Authentication Helper
- JWT validation and user ID extraction
- Role and permission checking
- Session validation
- Token refresh logic (if implemented)

#### Database Client
- Supabase client initialization with proper configuration
- Connection pooling configuration
- Query builders for common operations
- Transaction handling utilities

#### Storage Client
- Secure signed URL generation
- File upload/download helpers
- Metadata management
- Bucket-specific operations

#### Validation Library
- Input validation schemas (using zod or similar)
- Custom validators for business rules
- Sanitization functions
- Error formatting utilities

#### AI Service Client
- Gemini API client with retry logic
- Prompt templating and management
- Response parsing and validation
- Error handling and fallback mechanisms
- Rate limiting and quota management

#### Business Rules Engine
- Configurable rule definitions
- Rule evaluation engine
- Integration points for verification results
- Fraud detection algorithms
- Points calculation logic

#### Logging Utility
- Structured JSON logging
- Correlation ID tracking
- Performance timing
- Error tracking and reporting
- Log level management

#### Configuration Manager
- Environment variable loading
- Default value management
- Feature flag handling
- Secure configuration access

## Function Lifecycle

### Development
1. **Design**: Function specification created with clear inputs/outputs
2. **Implementation**: Function written following coding standards
3. **Unit Testing**: Comprehensive test suite covering happy path and edge cases
4. **Integration Testing**: Function tested with dependencies (mocked where appropriate)
5. **Security Review**: Security team review for vulnerabilities
6. **Performance Benchmarking**: Load testing to ensure performance targets

### Deployment
1. **Version Control**: Function code committed to feature branch
2. **Pull Request**: Code review and automated testing
3. **CI/CD Pipeline**: Automated build, test, and security scanning
4. **Staging Deployment**: Deployment to staging environment for validation
5. **Production Deployment**: Blue-green or canary deployment to production
6. **Monitoring**: Post-deployment monitoring for anomalies

### Operations
1. **Monitoring**: Real-time monitoring of function performance and errors
2. **Logging**: Centralized logging for debugging and auditing
3. **Alerting**: Alerting on error rates, latency, and unusual patterns
4. **Updates**: Rolling updates for bug fixes and feature enhancements
5. **Rollback**: Ability to rollback to previous version if issues detected
6. **Deprecation**: Six-month notice before removing functions

## Inter-Function Communication

### Internal Calls
Functions communicate with each other through direct internal calls (not HTTP):
- **Performance**: Avoids network overhead and latency
- **Security**: No exposure to external networks
- **Consistency**: Shared transaction context when needed
- **Atomicity**: Related operations can be wrapped in transactions

Example call pattern:
```typescript
// In verify-submission function
if (verificationResult.is_recyclable_item && verificationResult.confidence >= threshold) {
  const pointsResult = await awardPoints({
    userId: submission.user_id,
    submissionId: submission.id,
    verificationResult,
    ipAddress: request.ip,
    userAgent: request.userAgent
  });
  
  // Update submission with points awarded
  await db
    .from('submissions')
    .update({ points_awarded: pointsResult.points, status: 'approved' })
    .eq('id', submission.id);
}
```

### External Communication
Functions communicate with external services through well-defined interfaces:
- **Supabase**: Database and storage operations via official SDK
- **Gemini AI**: HTTPS API calls with API key from secrets
- **Email Services**: SMTP or API calls for notifications
- **Webhooks**: Outbound webhooks for third-party integrations
- **IoT Platforms**: MQTT or HTTPS for device communication (future)

### Event-Driven Communication
Future enhancement using database triggers and pub/sub:
- **Database Triggers**: Functions triggered by database changes
- **Pub/Sub**: Event-driven architecture for loose coupling
- **Webhooks**: Incoming webhooks for third-party service notifications
- **Scheduled Functions**: Cron-like functionality for periodic tasks

## Error Handling and Resilience

### Error Classification
Functions classify errors to determine appropriate response:
- **Validation Errors** (400): Invalid input data
- **Authentication Errors** (401): Missing or invalid credentials
- **Authorization Errors** (403): Insufficient permissions
- **Not Found Errors** (404): Requested resource doesn't exist
- **Conflict Errors** (409): Resource conflict (e.g., duplicate submission)
- **Rate Limit Errors** (429): Too many requests
- **External Service Errors** (502/503): Downstream service unavailable
- **Internal Errors** (500): Unexpected function errors

### Response Format
All errors follow a consistent format:
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

### Retry Strategies
- **Exponential Backoff**: For transient failures (network, external services)
- **Circuit Breaker**: Prevents repeated calls to failing services
- **Dead Letter Queue**: For permanently failed items requiring manual intervention
- **User Notification**: Inform users of temporary issues and retry options

### Fallback Mechanisms
- **Graceful Degradation**: Reduced functionality when non-critical services fail
- **Queued Processing**: Delay processing when services are temporarily unavailable
- **Manual Review Queue**: Route items to human reviewers when automated processing fails
- **Cached Responses**: Serve stale data when fresh data unavailable (with staleness indicators)

## Testing Strategy

### Unit Testing
- **Function Logic**: Test individual function logic in isolation
- **Input Validation**: Test validation of all inputs
- **Error Paths**: Test error handling and edge cases
- **Mocking**: Mock external dependencies (database, storage, AI services)
- **Coverage**: Target >90% code coverage for critical functions

### Integration Testing
- **Database Interactions**: Test with real database instance (test database)
- **Storage Operations**: Test with real Supabase Storage (test bucket)
- **External Services**: Test with mocked or sandboxed external services
- **Function Chains**: Test sequences of function calls (e.g., submit → verify → award)
- **Transaction Integrity**: Test atomicity of related operations

### Performance Testing
- **Load Testing**: Simulate expected peak loads
- **Stress Testing**: Test beyond expected limits to find breaking points
- **Soak Testing**: Extended duration testing to find memory leaks
- **Spike Testing**: Sudden load increases to test elasticity
- **Benchmarking**: Measure latency and throughput under various conditions

### Security Testing
- **Authentication Bypass**: Attempt to access functions without proper credentials
- **Authorization Bypass**: Attempt to perform actions without sufficient permissions
- **Input Validation**: Test for SQL injection, NoSQL injection, command injection
- **Session Testing**: Test session handling and token validation
- **Data Exposure**: Ensure no sensitive data leaked in errors or responses
- **Rate Limiting**: Verify rate limiting effectiveness

### Monitoring in Production
- **Health Checks**: Endpoints to verify function health
- **Metrics Collection**: Request rates, error rates, latency (RED metrics)
- **Log Analysis**: Centralized logging for debugging and auditing
- **Error Tracking**: Automated error reporting and alerting
- **User Impact**: Metrics on user-facing performance and errors

## Deployment Strategy

### Environment Promotion
1. **Development**: Local development environment
2. **Testing**: Automated testing environment
3. **Staging**: Pre-production environment mirroring production
4. **Production**: Live environment serving real users

### Deployment Patterns
- **Blue-Green Deployment**: Zero-downtime switching between identical environments
- **Canary Deployment**: Gradual rollout to subset of users
- **Rolling Deployment**: Incremental replacement of instances
- **Feature Flags**: Runtime toggling of features without deployment

### Rollback Procedures
- **Immediate Rollback**: Ability to revert to previous version within minutes
- **Database Rollback**: Point-in-time recovery for database changes
- **Feature Flag Disable**: Turn off problematic features via flags
- **Traffic Shifting**: Redirect traffic back to previous version

### Versioning
- **Semantic Versioning**: MAJOR.MINOR.PATCH for breaking changes, features, fixes
- **Git Tags**: Tag releases in version control
- **Changelog**: Document changes between versions
- **Deprecation Notices**: Six-month notice before removing functionality

## Future Enhancements

### Advanced Function Patterns
- **Event-Driven Functions**: Functions triggered by database changes or events
- **Workflow Orchestration**: Long-running workflows with state management
- **Stream Processing**: Real-time processing of event streams
- **Batch Processing**: Scheduled batch jobs for periodic tasks
- **Machine Learning Inference**: Hosting and serving ML models

### Performance Optimizations
- **Edge Computing**: Functions deployed closer to users geographically
- **Caching Layers**: Multi-level caching (in-memory, Redis, CDN)
- **Database Read Replicas**: Offloading reads to replicas
- **Connection Pooling**: Advanced connection pooling strategies
- **Async/Await Optimization**: Non-blocking I/O throughout

### Observability Improvements
- **Distributed Tracing**: End-to-end tracing of requests across functions
- **Custom Metrics**: Business-specific metrics alongside standard RED metrics
- **Log Enrichment**: Adding contextual information to logs
- **Alert Suppression**: Intelligent alerting to reduce noise
- **SLA Monitoring**: Tracking against service level agreements

### Security Advancements
- **Zero Trust Architecture**: Continuous verification of permissions
- **Just-In-Time Access**: Temporary elevation of privileges when needed
- **Behavioral Analysis**: Anomaly detection based on usage patterns
- **Automated Threat Response**: Automatic containment of detected threats
- **Security Headers**: Enhanced HTTP security headers

### Developer Experience
- **Local Development**: Improved local development experience with emulators
- **Testing Framework**: Enhanced testing utilities and fixtures
- **Documentation**: Auto-generated documentation from code
- **CI/CD Integration**: Tighter integration with continuous deployment pipelines
- **Monitoring Dashboards**: Real-time visibility into function performance

## Conclusion
The EcoPoints backend functions architecture provides a secure, scalable, and maintainable foundation for the platform. By following principles of separation of concerns, security-first design, observability, and performance optimization, the system ensures reliable operation while protecting user data and preventing fraud.

The modular design allows for independent development, testing, and deployment of functions, enabling rapid iteration and continuous improvement. Comprehensive error handling, retry mechanisms, and fallback strategies ensure resilience in the face of failures.

Most importantly, the architecture ensures that all business-critical decisions occur server-side, protecting the integrity of the points system and preventing client-side manipulation. This server-side authority, combined with comprehensive auditing and monitoring, creates a trustworthy platform for users to earn rewards for their recycling efforts.