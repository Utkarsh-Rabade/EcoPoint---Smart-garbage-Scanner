import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

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
    // Handle CORS
    if (req.method === "OPTIONS") {
      console.log("Handling OPTIONS request")
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      })
    }

    // Handle GET request for retrieving a specific submission
    if (req.method === "GET") {
      console.log("Handling GET request for submission retrieval")

      // Get the authorization header
      const authHeader = req.headers.get("Authorization")
      console.log("Auth header present:", !!authHeader)
      if (!authHeader?.startsWith("Bearer ")) {
        console.log("Missing or invalid auth header")
        return new Response(
          JSON.stringify({
            error: {
              code: "AUTH_MISSING_TOKEN",
              message: "Authorization header missing or invalid",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      }

      const accessToken = authHeader.substring(7) // Remove 'Bearer ' prefix
      console.log("Step 2: Getting user from token")

      // Create supabase client with the user's JWT for RLS
      const supabase = createClient(supabaseUrl, accessToken)

      // Get the user from Supabase using the JWT
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)
      console.log("Get user result:", user ? `user ${user.id}` : "null", "error:", userError)

      if (userError || !user) {
        console.error("Get user error:", userError)
        return new Response(
          JSON.stringify({
            error: {
              code: "AUTH_INVALID_TOKEN",
              message: "Invalid or expired token",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      }
      console.log("Authenticated user:", user.id)

      // Extract submission ID from URL
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      // Expected path: /submissions/:id or /submissions/:id/
      const submissionId = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];

      // Handle trailing slash
      if (!submissionId || submissionId === '') {
        // Try to get from query param as fallback
        const searchParams = new URLSearchParams(url.search);
        const paramId = searchParams.get('id');
        if (paramId) {
          console.log("Using ID from query parameter:", paramId);
          // Note: This is a fallback, ideally we'd use path parameter
        } else {
          return new Response(
            JSON.stringify({
              error: {
                code: "MISSING_SUBMISSION_ID",
                message: "submission_id is required",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }
      } else {
        console.log("Using ID from path parameter:", submissionId);
      }

      // Use the submission ID we extracted
      const finalSubmissionId = submissionId && submissionId !== '' ? submissionId : url.searchParams.get('id');

      if (!finalSubmissionId) {
        return new Response(
          JSON.stringify({
            error: {
              code: "MISSING_SUBMISSION_ID",
              message: "submission_id is required",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      // Fetch the specific submission
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .select('id, user_id, image_url, latitude, longitude, accuracy, status, verification_result, points_awarded, submitted_at, updated_at')
        .eq('id', finalSubmissionId)
        .eq('user_id', user.id) // Ensure user can only access their own submissions
        .single()

      if (submissionError) {
        console.error("Submission fetch error:", submissionError)
        // Handle different error types
        if (submissionError.code === 'PGRST116') {
          // No rows returned
          return new Response(
            JSON.stringify({
              error: {
                code: "SUBMISSION_NOT_FOUND",
                message: "Submission not found or access denied",
              },
            }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response(
          JSON.stringify({
            error: {
              code: "SUBMISSION_FETCH_FAILED",
              message: "Failed to fetch submission",
            },
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        )
      }

      // Return the submission data
      console.log("=== SUBMISSIONS FUNCTION END (SUCCESS - GET) ===")
      return new Response(
        JSON.stringify({
          submission,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

    // Handle POST request for creating a submission (existing functionality)
    if (req.method !== "POST") {
      console.log("Method not allowed:", req.method)
      return new Response(
        JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    console.log("Step 1: Checking authorization header")
    // Get the authorization header
    const authHeader = req.headers.get("Authorization")
    console.log("Auth header present:", !!authHeader)
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("Missing or invalid auth header")
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_MISSING_TOKEN",
            message: "Authorization header missing or invalid",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const accessToken = authHeader.substring(7) // Remove 'Bearer ' prefix
    console.log("Step 2: Getting user from token")

    // Create supabase client with the user's JWT for RLS
    const supabase = createClient(supabaseUrl, accessToken)

    // Get the user from Supabase using the JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)
    console.log("Get user result:", user ? `user ${user.id}` : "null", "error:", userError)

    if (userError || !user) {
      console.error("Get user error:", userError)
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_INVALID_TOKEN",
            message: "Invalid or expired token",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }
    console.log("Authenticated user:", user.id)

    console.log("Step 3: Parsing multipart/form-data")
    // Parse multipart/form-data
    const contentType = req.headers.get("Content-Type") || ""
    console.log("Content-Type:", contentType)
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)

    if (!boundaryMatch) {
      console.log("Missing or invalid multipart boundary")
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_MULTIPART",
            message: "Missing or invalid multipart boundary",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`
    console.log("Boundary:", boundary)
    const body = await req.text()
    console.log("Body length:", body.length)
    console.log("Body preview:", body.substring(0, Math.min(200, body.length)))

    // Parse multipart body
    const parts = body.split(boundary).slice(1, -1) // Remove first empty and last closing part
    console.log("Number of parts:", parts.length)

    let imageData: { data: Uint8Array; filename: string; contentType: string } | null = null
    const fields: Record<string, string> = {}

    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex].trim()
      if (!part) {
        console.log(`Part ${partIndex}: empty, skipping`)
        continue
      }

      console.log(`Processing part ${partIndex}:`, part.substring(0, Math.min(100, part.length)) + "...")

      // Split into lines
      const lines = part.split("\r\n")

      // Find the empty line that separates headers from content
      let headersEndIndex = -1
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === "") {
          headersEndIndex = i
          break
        }
      }

      if (headersEndIndex === -1) {
        console.log(`Part ${partIndex}: no empty line found to separate headers`)
        continue
      }

      // Extract headers and content
      const headers = lines.slice(0, headersEndIndex)
      const contentLines = lines.slice(headersEndIndex + 1)
      const content = contentLines.join("\r\n")

      const contentDispositionHeader = headers.find(h => h.startsWith("Content-Disposition:"))
      const contentTypeHeader = headers.find(h => h.startsWith("Content-Type:"))

      console.log(`Part ${partIndex} headers:`, JSON.stringify(headers))
      console.log(`Part ${partIndex} content:`, content.substring(0, Math.min(50, content.length)) + (content.length > 50 ? '...' : ''))

      if (!contentDispositionHeader) {
        console.log(`Part ${partIndex}: missing Content-Disposition`)
        continue
      }

      // Parse Content-Disposition to get name and filename
      const dispositionMatch = contentDispositionHeader.match(/name="([^"]+)"(?:; filename="([^"]+)")?/i)
      if (!dispositionMatch) {
        console.log(`Part ${partIndex}: failed to match disposition`)
        continue
      }

      const fieldName = dispositionMatch[1]
      const fileName = dispositionMatch[2]
      console.log(`Part ${partIndex}: fieldName=${fieldName}, fileName=${fileName}`)

      if (fileName) {
        // This is a file part
        if (fieldName !== "image") {
          console.log(`Part ${partIndex}: fieldName is not image, skipping`)
          continue
        }

        const contentTypeMatch = contentTypeHeader?.match(/Content-Type:\s*(.+)/i)
        if (!contentTypeMatch) {
          console.log(`Part ${partIndex}: missing Content-Type`)
          continue
        }

        const contentTypeValue = contentTypeMatch[1]
        console.log(`Part ${partIndex}: contentType=${contentTypeValue}`)

        // Convert string content to Uint8Array
        const encoder = new TextEncoder()
        const data = encoder.encode(content)

        imageData = {
          data,
          filename: fileName,
          contentType: contentTypeValue
        }
        console.log(`Part ${partIndex}: set imageData, size=${data.length} bytes`)
      } else {
        // This is a regular form field
        fields[fieldName] = content
        console.log(`Part ${partIndex}: set field ${fieldName}=${content}`)
      }
    }

    console.log("Final imageData:", imageData ? `present (${imageData.data.length} bytes)` : "null")
    console.log("Fields:", JSON.stringify(fields))

    // Validate image exists
    if (!imageData) {
      console.log("Validation failed: missing image")
      return new Response(
        JSON.stringify({
          error: {
            code: "MISSING_IMAGE",
            message: "Image file is required",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(imageData.contentType)) {
      console.log("Validation failed: invalid file type", imageData.contentType)
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_FILE_TYPE",
            message: "Only JPEG, PNG, and WebP images are allowed",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Validate file size (5 MB limit)
    const maxSize = 5 * 1024 * 1024 // 5 MB
    if (imageData.data.length > maxSize) {
      console.log("Validation failed: file too large", imageData.data.length)
      return new Response(
        JSON.stringify({
          error: {
            code: "FILE_TOO_LARGE",
            message: "Image size must be less than 5 MB",
          },
        }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      )
    }

    // Extract and validate optional fields
    let latitude: number | null = null
    let longitude: number | null = null
    let accuracy: number | null = null

    if (fields.latitude) {
      const lat = parseFloat(fields.latitude)
      if (!isNaN(lat) && lat >= -90 && lat <= 90) {
        latitude = lat
      }
    }

    if (fields.longitude) {
      const lng = parseFloat(fields.longitude)
      if (!isNaN(lng) && lng >= -180 && lng <= 180) {
        longitude = lng
      }
    }

    if (fields.accuracy) {
      const acc = parseFloat(fields.accuracy)
      if (!isNaN(acc) && acc >= 0) {
        accuracy = acc
      }
    }

    console.log("Optional fields: latitude=", latitude, "longitude=", longitude, "accuracy=", accuracy)

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
        upsert: false
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return new Response(
        JSON.stringify({
          error: {
            code: "STORAGE_UPLOAD_FAILED",
            message: "Failed to upload image",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
    console.log("Storage upload successful:", uploadData)

    // Compute SHA-256 hash of image data for duplicate detection
    console.log("Step 5: Computing SHA-256 hash")
    // Create a copy of the image data with a guaranteed regular ArrayBuffer
    const imageDataCopy = new Uint8Array(imageData.data.length)
    imageDataCopy.set(imageData.data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', imageDataCopy)
    // The digest result should always be an ArrayBuffer, but convert just in case
    const hashArrayBuffer = hashBuffer instanceof ArrayBuffer ? hashBuffer : new Uint8Array(hashBuffer).buffer
    const hashArray = Array.from(new Uint8Array(hashArrayBuffer))
    const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    console.log("Image hash:", imageHash)

    // Insert submission record into database
    console.log("Step 6: Inserting into database")
    const encoder = new TextEncoder()
    const jsonData = JSON.stringify({
      user_id: user.id,
      image_url: storagePath, // Store private storage path, not public URL
      image_hash: imageHash,
      latitude,
      longitude,
      accuracy,
      status: 'pending',
      points_awarded: 0
    })
    console.log("JSON data to insert:", jsonData)

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceRoleKey,
        'Authorization': `Bearer ${supabaseServiceRoleKey}`
      },
      body: encoder.encode(jsonData)
    })

    console.log("Insert response status:", insertResponse.status)
    if (!insertResponse.ok) {
      const errorData = await insertResponse.json()
      console.error("Database insert error:", errorData)
      return new Response(
        JSON.stringify({
          error: {
            code: "DATABASE_INSERT_FAILED",
            message: "Failed to create submission record",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const insertData = await insertResponse.json()
    const submissionData = insertData[0] // Supabase returns an array
    console.log("Insert successful:", submissionData)

    // Return successful response
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
        points_awarded: submissionData.points_awarded
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (err) {
    console.error("=== SUBMISSIONS FUNCTION END (ERROR) ===")
    console.error("Unexpected error in submission create function:", err)
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

serve(createHandler)

// Export the handler for testing
export default createHandler

if (import.meta.main) {
  serve(createHandler)
}