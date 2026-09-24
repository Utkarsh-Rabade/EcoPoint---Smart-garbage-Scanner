# EcoPoints Storage Architecture

## Overview
This document describes the storage architecture for the EcoPoints platform, focusing on how user-submitted recycling images and other files are stored, managed, and secured using Supabase Storage.

## Storage Strategy

### Bucket Structure
EcoPoints uses the following Supabase Storage buckets:

1. **submissions** (Private)
   - Stores user-submitted recycling images
   - Access controlled via Row Level Security and backend services only
   - Images retained for compliance period (2 years)
   - Automatic lifecycle management for deletion after retention period

2. **rewards** (Public)
   - Stores reward catalog images
   - Publicly accessible for displaying reward catalog
   - Images optimized for web delivery
   - Content Delivery Network (CDN) enabled for global performance

3. **avatars** (Private)
   - Stores user profile avatars
   - Access restricted to authenticated users
   - Images processed for multiple sizes (thumbnail, medium, full)
   - Default avatar provided for users without custom upload

4. **temp** (Private)
   - Temporary storage for processing
   - Automatically cleaned up after 24 hours
   - Used for image preprocessing before AI analysis
   - Access restricted to backend services only

5. **audit** (Private)
   - Stores audit trail images and evidence
   - Access restricted to administrators and service accounts
   - Images retained for legal compliance period (7 years)
   - Write-once-read-many (WORM) protection enabled

## File Naming Convention

All stored files follow a standardized naming convention to ensure uniqueness, traceability, and efficient retrieval:

### Submission Images
```
submissions/{user_id}/{submission_id}_{timestamp}_{hash}.{ext}
```
- `user_id`: UUID of the submitting user
- `submission_id`: UUID of the submission record
- `timestamp`: ISO 8601 timestamp of submission (YYYYMMDD_HHMMSS)
- `hash`: First 8 characters of SHA-256 hash of the file content
- `ext`: File extension (jpg, png, webp)

Example: `submissions/123e4567-e89b-12d3-a456-426614174000/987f6543-e21b-34d5-c678-901234567890_20260921_103000_abcd1234.jpg`

### Reward Images
```
rewards/{reward_id}_{variant}.{ext}
```
- `reward_id`: UUID of the reward
- `variant`: Size variant (original, thumbnail, banner)
- `ext`: File extension

Example: `rewards/456e7890-e89b-12d3-a456-426614174000_thumbnail.jpg`

### Avatar Images
```
avatars/{user_id}_{size}_{timestamp}.{ext}
```
- `user_id`: UUID of the user
- `size`: Size variant (thumbnail, medium, large)
- `timestamp`: ISO 8601 timestamp of last update
- `ext`: File extension

Example: `avatars/123e4567-e89b-12d3-a456-426614174000_medium_20260921_103000.jpg`

## Security Measures

### Access Control
- **Row Level Security (RLS)**: All buckets have RLS policies enforced
- **Private by Default**: All buckets are private unless explicitly made public
- **Service-Only Access**: Submission and temp buckets accessible only by backend services
- **User-Specific Access**: Avatar access restricted to owning user
- **Admin Access**: Audit bucket accessible only by administrators and service accounts

### Encryption
- **At Rest**: Supabase-managed encryption using AES-256-GCM
- **In Transit**: TLS 1.2+ for all storage operations
- **Key Management**: Automatic key rotation handled by Supabase

### Upload Validation
- **File Type Validation**: MIME type checking (image/jpeg, image/png, image/webp)
- **File Size Limits**: Maximum 10MB per upload
- **Content Validation**: Basic image integrity checks
- **Metadata Stripping**: EXIF/GPS data removed for privacy
- **Virus Scanning**: Planned integration with ClamAV or similar

## Image Processing Pipeline

### Upload Flow
1. User selects image via frontend
2. Frontend performs client-side validation (size, type)
3. Image uploaded directly to Supabase Storage (submissions bucket) with signed URL
4. Storage returns file path and metadata
5. Backend creates submission record with file reference
6. Backend triggers verification process

### Processing Steps
1. **Retrieval**: Backend fetches image from storage using signed URL
2. **Validation**: Server-side validation of file type and integrity
3. **Hashing**: SHA-256 hash generated for duplicate detection
4. **Metadata Stripping**: EXIF and other metadata removed
5. **Format Conversion**: Image converted to standard format (JPEG, quality 85%)
6. **Thumbnail Generation**: Multiple sizes created for different use cases
7. **Storage**: Processed images stored temporarily or in appropriate buckets
8. **AI Analysis**: Image sent to Gemini AI API for verification
9. **Cleanup**: Temporary files removed after processing

### Image Variants
For performance and user experience, multiple image variants are generated:

- **Original**: Full resolution (max 1920x1080, aspect ratio preserved)
- **Large**: 1200x1200px (for detailed viewing)
- **Medium**: 600x600px (for standard display)
- **Thumbnail**: 150x150px (for lists and previews)
- **Icon**: 64x64px (for UI icons)

## Lifecycle Management

### Retention Policies
- **Submission Images**: 2 years (configurable based on local regulations)
- **Reward Images**: Indefinitely (while reward is active)
- **Avatar Images**: Until user updates or deletes account
- **Temp Files**: 24 hours (automatic cleanup)
- **Audit Images**: 7 years (legal compliance)

### Automated Cleanup
- Daily cron job identifies and deletes expired files
- Logging of deletion operations for audit trail
- Storage usage monitoring and alerting
- Soft delete option available for recovery window (30 days)

### Storage Optimization
- **Compression**: Automatic compression upon upload (configurable quality)
- **Deduplication**: Hash-based detection prevents duplicate storage
- **Tiering**: Infrequently accessed images moved to cooler storage tiers
- **CDN Caching**: Publicly accessible content cached at edge locations

## Performance Considerations

### Upload Performance
- **Direct Uploads**: Clients upload directly to Supabase Storage (reduces backend load)
- **Signed URLs**: Time-limited, scope-restricted URLs for secure direct uploads
- **Parallel Chunking**: Large files can be uploaded in parallel chunks (future)
- **Upload Progress**: Client-side progress indicators for better UX

### Retrieval Performance
- **CDN Integration**: Public buckets integrated with global CDN
- **Cache Control**: Appropriate cache headers for different content types
- **Image Optimization**: Serving appropriately sized images based on device
- **Lazy Loading**: Frontend implements lazy loading for image-heavy views
- **Placeholder Images**: Low-quality image placeholders while loading

### Storage Efficiency
- **Right-Sizing**: Storing only necessary image dimensions
- **Format Selection**: WebP for browsers that support it, fallback to JPEG/PNG
- **Quality Optimization**: Perceptual compression to minimize quality loss
- **Metadata Removal**: Stripping unnecessary EXIF and metadata
- **Batch Processing**: Off-hor processing for non-urgent transformations

## Backup and Disaster Recovery

### Backup Strategy
- **Point-in-Time Recovery**: Supabase built-in PITR enabled
- **Geographic Redundancy**: Multi-region storage replication
- **Regular Snapshots**: Daily snapshots with 30-day retention
- **Versioning**: Object versioning enabled for critical buckets (audit, rewards)
- **Cross-Region Replication**: Automatic replication to secondary region

### Recovery Procedures
- **Accidental Deletion**: Recovery from trash within 30 days
- **Data Corruption**: Point-in-time recovery to specific timestamp
- **Regional Failure**: Failover to secondary region with DNS update
- **Complete Loss**: Restore from snapshots + transaction logs
- **Testing**: Quarterly restore tests performed and documented

## Integration with Services

### Frontend Integration
- **Direct Access**: Frontend uses signed URLs for private images
- **Public URLs**: Frontend uses public URLs for reward catalog and public content
- **Image Components**: Reusable React components for optimized image display
- **Error Handling**: Graceful degradation when images fail to load
- **Loading States**: Skeletons and placeholders during image loading

### Backend Integration
- **Supabase SDK**: Official SDK used for storage operations
- **Signed URL Generation**: Backend generates time-limited URLs for secure access
- **Metadata Storage**: Storage paths stored in database records
- **Event Triggers**: Storage bucket events can trigger backend functions (future)
- **Storage Functions**: Custom SQL functions for storage operations

### AI Service Integration
- **Image Retrieval**: Backend fetches image from storage for AI analysis
- **In-Memory Processing**: Image processed in memory, not stored persistently
- **Secure Transfer**: Image sent to Gemini API over secure connection
- **No Retention**: AI service does not retain images per terms of service
- **Audit Trail**: Storage access logged for AI processing requests

## Monitoring and Alerting

### Metrics Collected
- **Storage Usage**: Total space used per bucket
- **Upload Rates**: Files uploaded per time period
- **Download Rates**: Files downloaded per time period
- **Error Rates**: Failed uploads/downloads
- **Latency**: Average time for storage operations
- **Bandwidth**: Data transfer rates
- **Request Counts**: Number of storage API requests

### Alerting Rules
- **Storage Capacity**: Warning at 80%, critical at 95% usage
- **Upload Failures**: Alert if failure rate exceeds 1%
- **Download Failures**: Alert if failure rate exceeds 0.5%
- **Unusual Patterns**: Spike in upload/download rates
- **Unauthorized Access**: Alert on access attempts from blocked IPs
- **Performance Degradation**: Alert if latency exceeds thresholds

### Logging
- **Access Logs**: All storage operations logged (who, what, when)
- **Error Logs**: Detailed error information for troubleshooting
- **Audit Logs**: Security-relevant storage operations logged separately
- **Retention**: Logs retained according to security policy (30 days operational, 1 year compliance)

## Future Enhancements

### Advanced Features
- **AI-Powered Tagging**: Automatic image tagging for search and categorization
- **Content Moderation**: Automated screening for inappropriate content
- **Image Similarity**: Duplicate and near-duplicate detection using perceptual hashing
- **Dynamic Transformation**: On-the-fly image resizing and format conversion
- **Watermarking**: Invisible watermarking for traceability (future)
- **Blockchain Storage Proof**: Cryptographic proofs of storage integrity (research)

### Performance Improvements
- **Edge Computing**: Image processing at CDN edge locations
- **Predictive Prefetching**: Anticipatory loading of likely-to-be-needed images
- **Adaptive Quality**: Dynamic compression based on network conditions
- **Progressive Loading**: Low-quality placeholders that refine over time
- **WebP/AVIF Adoption**: Increased use of modern image formats as browser support grows

### Cost Optimization
- **Intelligent Tiering**: Automatic movement to appropriate storage classes
- **Compression Optimization**: Advanced compression algorithms
- **Duplicate Elimination**: Global deduplication across similar content
- **Lifecycle Policies**: Sophisticated rules based on access patterns and business rules
- **Vendor Optimization**: Multi-cloud storage strategies for cost and resilience

## Compliance and Legal Considerations

### Data Protection Regulations
- **GDPR**: Right to be forgotten implemented via deletion requests
- **CCPA**: Ability to delete personal information upon request
- **Data Minimization**: Only necessary images stored, with automatic deletion
- **Purpose Limitation**: Images used only for stated recycling verification purposes
- **Storage Limitation**: Defined retention periods with automated enforcement

### Security Standards
- **ISO 27001**: Storage architecture aligned with information security management
- **SOC 2**: Controls in place for security, availability, and confidentiality
- **PCI DSS**: Not applicable as no payment card data stored in images
- **HIPAA**: Not applicable as no protected health information in scope

### Audit and Traceability
- **Immutable Logs**: All storage access logged immutably
- **Chain of Custody**: Traceability from upload to analysis to deletion
- **Legal Hold**: Ability to preserve images for legal proceedings
- **Export Capability**: Ability to provide image exports for regulatory requests