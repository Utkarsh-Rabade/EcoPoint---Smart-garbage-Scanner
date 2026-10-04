import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface SubmissionResponse {
  id: string
  user_id: string
  image_url: string
  latitude?: number | null
  longitude?: number | null
  accuracy?: number | null
  submitted_at: string
  status: string
  points_awarded: number
}

const createHandler = async (req: Request): Promise<Response> => {
  try {
    console.log("=== SUBMISSIONS FUNCTION START ===")

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      console.log("Handling OPTIONS request")
      return new Response("ok", { headers: corsHeaders })
    }

    // ── GET — retrieve a single submission ────────────────────────────────── //
    if (req.method === "GET") {
      console.log("Handling GET request for submission retrieval")

      const authHeader = req.headers.get("Authorization")
      console.log("Auth header present:", !!authHeader)
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: { code: "AUTH_MISSING_TOKEN", message: "Authorization header missing or invalid" } }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const accessToken = authHeader.substring(7)

      // Two-client pattern: auth client with service role, db client with user JWT
      const authClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false },
      })

      const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken)
      console.log("Get user result:", user ? `user ${user.id}` : "null", "error:", userError)

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: { code: "AUTH_INVALID_TOKEN", message: "Invalid or expired token" } }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      console.log("Authenticated user:", user.id)

      // Extract submission ID from URL
      const url = new URL(req.url)
      const pathParts = url.pathname.split("/")
      const submissionId =
        url.searchParams.get("id") ||
        pathParts[pathParts.length - 1]

      if (!submissionId || submissionId === "") {
        const paramId = url.searchParams.get("id")
        if (!paramId) {
          return new Response(
            JSON.stringify({ error: { code: "MISSING_SUBMISSION_ID", message: "submission_id is required" } }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }
      } else {
        console.log("Using ID from path parameter:", submissionId)
      }

      const finalSubmissionId = (submissionId && submissionId !== "") ? submissionId : url.searchParams.get("id")

      if (!finalSubmissionId) {
        return new Response(
          JSON.stringify({ error: { code: "MISSING_SUBMISSION_ID", message: "submission_id is required" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const { data: submission, error: submissionError } = await supabase
        .from("submissions")
        .select("id, user_id, image_url, latitude, longitude, accuracy, status, verification_result, points_awarded, submitted_at")
        .eq("id", finalSubmissionId)
        .eq("user_id", user.id)
        .single()

      if (submissionError) {
        console.error("Submission fetch error:", submissionError)
        if (submissionError.code === "PGRST116") {
          return new Response(
            JSON.stringify({ error: { code: "SUBMISSION_NOT_FOUND", message: "Submission not found or access denied" } }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }
        return new Response(
          JSON.stringify({ error: { code: "SUBMISSION_FETCH_FAILED", message: "Failed to fetch submission" } }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Generate a signed URL for the image (expires in 1 hour)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("submission-images")
        .createSignedUrl(submission.image_url, 3600)

      let imageUrl = submission.image_url
      if (!signedUrlError && signedUrlData?.signedUrl) {
        imageUrl = signedUrlData.signedUrl
      }

      console.log("=== SUBMISSIONS FUNCTION END (SUCCESS - GET) ===")
      return new Response(
        JSON.stringify({ submission: { ...submission, image_url: imageUrl } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ── POST — create a new submission ────────────────────────────────────── //
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("Step 1: Checking authorization header")
    const authHeader = req.headers.get("Authorization")
    console.log("Auth header present:", !!authHeader)
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: { code: "AUTH_MISSING_TOKEN", message: "Authorization header missing or invalid" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const accessToken = authHeader.substring(7)
    console.log("Step 2: Getting user from token")

    // Two-client pattern (same as dashboard function)
    // Auth client uses service role key — prevents JWT-as-API-key bug
    const authClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })
    // Storage/insert client uses service role key (storage requires it)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken)
    console.log("Get user result:", user ? `user ${user.id}` : "null", "error:", userError)

    if (userError || !user) {
      console.error("Get user error:", userError)
      return new Response(
        JSON.stringify({ error: { code: "AUTH_INVALID_TOKEN", message: "Invalid or expired token" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    console.log("Authenticated user:", user.id)

    console.log("Step 3: Parsing multipart/form-data")
    const contentType = req.headers.get("Content-Type") || ""
    console.log("Content-Type:", contentType)
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)

    if (!boundaryMatch) {
      console.log("Missing or invalid multipart boundary")
      return new Response(
        JSON.stringify({ error: { code: "INVALID_MULTIPART", message: "Missing or invalid multipart boundary" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`
    console.log("Boundary:", boundary)

    // ── Binary-safe multipart parsing ────────────────────────────────────────
    // CRITICAL: req.text() corrupts binary image data (bytes > 127 become 0xEFBFBD).
    // We must work with raw bytes throughout.
    const rawBody = await req.arrayBuffer()
    const bodyBytes = new Uint8Array(rawBody)
    console.log("Body bytes:", bodyBytes.length)

    const boundaryBytes = new TextEncoder().encode(boundary)
    const crlf = new TextEncoder().encode("\r\n")
    const crlfcrlf = new TextEncoder().encode("\r\n\r\n")

    // Find all boundary positions in the byte array
    function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, start = 0): number {
      outer: for (let i = start; i <= haystack.length - needle.length; i++) {
        for (let j = 0; j < needle.length; j++) {
          if (haystack[i + j] !== needle[j]) continue outer
        }
        return i
      }
      return -1
    }

    const td = new TextDecoder()

    let imageData: { data: Uint8Array; filename: string; contentType: string } | null = null
    const fields: Record<string, string> = {}

    let searchPos = 0
    while (true) {
      const boundaryPos = indexOfBytes(bodyBytes, boundaryBytes, searchPos)
      if (boundaryPos === -1) break

      // Skip past boundary + CRLF
      const partStart = boundaryPos + boundaryBytes.length
      // Check for terminal boundary (--)
      if (bodyBytes[partStart] === 45 && bodyBytes[partStart + 1] === 45) break

      const headerStart = partStart + 2 // skip \r\n after boundary

      // Find end of headers (\r\n\r\n)
      const headerEndPos = indexOfBytes(bodyBytes, crlfcrlf, headerStart)
      if (headerEndPos === -1) break

      const headerBytes = bodyBytes.slice(headerStart, headerEndPos)
      const headerText = td.decode(headerBytes)
      const headerLines = headerText.split("\r\n")

      // Find start of next boundary = end of content
      const contentStart = headerEndPos + 4 // skip \r\n\r\n
      const nextBoundary = indexOfBytes(bodyBytes, boundaryBytes, contentStart)
      if (nextBoundary === -1) break

      // Content ends 2 bytes before next boundary (\r\n before --)
      const contentEnd = nextBoundary - 2
      const contentBytes = bodyBytes.slice(contentStart, contentEnd)

      searchPos = nextBoundary

      const dispositionLine = headerLines.find(l => l.startsWith("Content-Disposition:")) ?? ""
      const contentTypeLine = headerLines.find(l => l.toLowerCase().startsWith("content-type:")) ?? ""

      const dispositionMatch = dispositionLine.match(/name="([^"]+)"(?:;\s*filename="([^"]+)")?/i)
      if (!dispositionMatch) continue

      const fieldName = dispositionMatch[1]
      const fileName = dispositionMatch[2]

      if (fileName) {
        // Binary part — image
        if (fieldName !== "image") continue
        const ctMatch = contentTypeLine.match(/content-type:\s*(.+)/i)
        if (!ctMatch) continue
        const contentTypeValue = ctMatch[1].trim()
        imageData = { data: contentBytes, filename: fileName, contentType: contentTypeValue }
        console.log(`Image part: ${fileName}, type=${contentTypeValue}, size=${contentBytes.length} bytes`)
      } else {
        // Text field — safe to decode
        fields[fieldName] = td.decode(contentBytes).trim()
      }
    }

    console.log("imageData:", imageData ? `${imageData.filename} (${imageData.data.length} bytes)` : "null")
    console.log("fields:", JSON.stringify(fields))

    // Validate image
    if (!imageData) {
      console.log("Validation failed: missing image")
      return new Response(
        JSON.stringify({ error: { code: "MISSING_IMAGE", message: "Image file is required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(imageData.contentType)) {
      console.log("Validation failed: invalid file type", imageData.contentType)
      return new Response(
        JSON.stringify({ error: { code: "INVALID_FILE_TYPE", message: "Only JPEG, PNG, and WebP images are allowed" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate file size (5 MB)
    const maxSize = 5 * 1024 * 1024
    if (imageData.data.length > maxSize) {
      console.log("Validation failed: file too large", imageData.data.length)
      return new Response(
        JSON.stringify({ error: { code: "FILE_TOO_LARGE", message: "Image size must be less than 5 MB" } }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Extract optional location fields
    let latitude: number | null = null
    let longitude: number | null = null
    let accuracy: number | null = null

    if (fields.latitude) {
      const lat = parseFloat(fields.latitude)
      if (!isNaN(lat) && lat >= -90 && lat <= 90) latitude = lat
    }
    if (fields.longitude) {
      const lng = parseFloat(fields.longitude)
      if (!isNaN(lng) && lng >= -180 && lng <= 180) longitude = lng
    }
    if (fields.accuracy) {
      const acc = parseFloat(fields.accuracy)
      if (!isNaN(acc) && acc >= 0) accuracy = acc
    }

    console.log("Optional fields: latitude=", latitude, "longitude=", longitude, "accuracy=", accuracy)

    // Extract optional action type hint ("recycling"|"tree_planting"|etc.|"auto")
    const actionTypeHint: string = fields.action_type ?? "auto"

    // Generate unique storage path
    const timestamp = new Date().toISOString()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = imageData.contentType.split("/")[1]
    const storagePath = `submissions/${user.id}/${timestamp}-${randomId}.${fileExtension}`
    console.log("Storage path:", storagePath)

    // Upload image to Supabase Storage
    console.log("Step 4: Uploading to storage")
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("submission-images")
      .upload(storagePath, imageData.data, {
        contentType: imageData.contentType,
        upsert: false,
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return new Response(
        JSON.stringify({ error: { code: "STORAGE_UPLOAD_FAILED", message: "Failed to upload image" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    console.log("Storage upload successful:", uploadData)

    // Compute SHA-256 hash for duplicate detection
    console.log("Step 5: Computing SHA-256 hash")
    const imageDataCopy = new Uint8Array(imageData.data.length)
    imageDataCopy.set(imageData.data)
    const hashBuffer = await crypto.subtle.digest("SHA-256", imageDataCopy)
    const hashArrayBuffer = hashBuffer instanceof ArrayBuffer ? hashBuffer : new Uint8Array(hashBuffer).buffer
    const hashArray = Array.from(new Uint8Array(hashArrayBuffer))
    const imageHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
    console.log("Image hash:", imageHash)

    // ── Duplicate detection ───────────────────────────────────────────────────
    // Check if this exact image (same SHA-256 hash) has already been submitted
    // by this user. We check all statuses — a rejected duplicate should still
    // block re-submission of the identical bytes.
    console.log("Step 5b: Checking for duplicate image hash")
    const { data: existingRows, error: dupCheckError } = await supabase
      .from("submissions")
      .select("id, status, submitted_at")
      .eq("user_id", user.id)
      .eq("image_hash", imageHash)
      .limit(1)

    if (dupCheckError) {
      // Non-fatal: log and continue. A failed duplicate check should not block
      // a legitimate submission.
      console.warn("Duplicate check query error (continuing):", dupCheckError.message)
    } else if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0]
      console.log(`Duplicate image detected: existing submission ${existing.id} (status: ${existing.status})`)
      return new Response(
        JSON.stringify({
          error: {
            code: "DUPLICATE_IMAGE",
            message: "This exact image has already been submitted. Please photograph a different item.",
            existing_submission_id: existing.id,
            existing_status: existing.status,
          },
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    // ── End duplicate detection ───────────────────────────────────────────────


    // Insert submission record
    console.log("Step 6: Inserting into database")
    const encoder = new TextEncoder()
    const jsonData = JSON.stringify({
      user_id: user.id,
      image_url: storagePath,
      image_hash: imageHash,
      latitude,
      longitude,
      accuracy,
      status: "pending",
      points_awarded: 0,
    })
    console.log("JSON data to insert:", jsonData)

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceRoleKey,
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "Prefer": "return=representation",
      },
      body: encoder.encode(jsonData),
    })

    console.log("Insert response status:", insertResponse.status)
    if (!insertResponse.ok) {
      const errorData = await insertResponse.json()
      console.error("Database insert error:", errorData)
      return new Response(
        JSON.stringify({ error: { code: "DATABASE_INSERT_FAILED", message: "Failed to create submission record" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const insertData = await insertResponse.json()
    const submissionData = insertData[0]
    console.log("Insert successful:", submissionData)

    // ── Trigger verification in background (fire-and-forget) ──────────────────
    // Returns 201 immediately. gemini-verify runs independently.
    // EdgeRuntime.waitUntil keeps the Deno isolate alive until verify completes.
    const verifyUrl = `${supabaseUrl}/functions/v1/gemini-verify`
    const verifyPromise = fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ submission_id: submissionData.id, action_type_hint: actionTypeHint }),
    }).then(async (r) => {
      console.log(`gemini-verify response [${r.status}]:`, await r.text())
    }).catch((err) => {
      console.error("gemini-verify dispatch error:", err)
    })

    try {
      // @ts-ignore — EdgeRuntime only available on Supabase / Deno Deploy
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(verifyPromise)
    } catch (_) { /* not available in all environments — fetch still fired */ }
    // ── End verification dispatch ──────────────────────────────────────────────

    console.log("=== SUBMISSIONS FUNCTION END (SUCCESS - POST) ===")
    return new Response(
      JSON.stringify({
        id: submissionData.id,
        user_id: submissionData.user_id,
        image_url: submissionData.image_url,
        latitude: submissionData.latitude,
        longitude: submissionData.longitude,
        accuracy: submissionData.accuracy,
        submitted_at: submissionData.submitted_at,
        status: submissionData.status,
        points_awarded: submissionData.points_awarded,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("=== SUBMISSIONS FUNCTION END (ERROR) ===")
    console.error("Unexpected error in submission create function:", err)
    return new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
}

serve(createHandler)

// Export the handler for testing
export default createHandler

if (import.meta.main) {
  serve(createHandler)
}