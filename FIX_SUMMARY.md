# Backend/API Issues Fixed for Frontend Integration

## Summary
Fixed three backend/API issues that would affect frontend integration:

## 1. LEADERBOARD Fix
**Issue**: Invalid `profiles.display_name` reference
**File**: `supabase/functions/leaderboard/index.ts`
**Fix**: Changed `.select('id, display_name, total_points, created_at')` to `.select('id, full_name, total_points, created_at')` 
**Reason**: Database schema shows `full_name` column exists, not `display_name`
**Preserved**: Existing API response contract (just changed the source field)

## 2. REWARDS Fix
**Issue**: Hardcoded reward data
**File**: `supabase/functions/rewards/index.ts`
**Fix**: Replaced static rewards array with database query:
```typescript
const { data: rewards, error: rewardsError } = await supabase
  .from('rewards')
  .select('title, points_cost')
  .eq('available', true)
  .order('points_cost', { ascending: true });
```
**Response Format**: Matches exact API contract requested:
- `title` (from rewards.title)
- `points_cost` (from rewards.points_cost)
**Schema**: No changes made to database schema
**Filtering**: Only returns available rewards (`available = true`)

## 3. PRIVATE SUBMISSION IMAGES Fix
**Issue**: `image_url` contained private storage path inaccessible to frontend
**File**: `supabase/functions/submissions/index.ts`
**Fix**: Added signed URL generation for authenticated users:
```typescript
// Generate a signed URL for the submission image (expires in 1 hour)
const { data: signedUrlData, error: signedUrlError } = await supabase.storage
  .from('submission-images')
  .createSignedUrl(submission.image_url, 3600); // 3600 seconds = 1 hour

let imageUrl = submission.image_url; // fallback to original path
if (!signedUrlError && signedUrlData?.signedUrl) {
  imageUrl = signedUrlData.signedUrl;
}
```
**Security**: 
- Never makes bucket public
- Never exposes service-role credentials
- Uses user's JWT for RLS (already implemented)
- Signed URLs expire in 1 hour for security
**Access Control**: Users can only view their own submissions (existing `eq('user_id', user.id)` constraint preserved)

## Deployment
All fixed functions deployed successfully:
- leaderboard: 81 kB
- rewards: 81 kB  
- submissions: 88 kB

## Type Check Results
All functions pass `deno check` with no errors:
- ✅ leaderboard: OK
- ✅ rewards: OK  
- ✅ submissions: OK
- ✅ dashboard: OK (unchanged)
- ✅ gemini-verify: OK (unchanged)

## Constraints Met
✅ Did not modify Gemini, points logic, RLS, database schema, authentication, frontend, or unrelated functions
✅ Used existing database schema and RLS
✅ Kept implementation small and focused
✅ Derived user identity from JWT, never accepted user_id from client for private data
✅ All fixes preserve existing API contracts where specified