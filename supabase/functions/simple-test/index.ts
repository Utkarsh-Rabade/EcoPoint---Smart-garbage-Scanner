import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { message: "Method not allowed" } }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: { message: "Missing or invalid auth header" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const accessToken = authHeader.substring(7)
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: { message: "Invalid token" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Parse multipart/form-data
    const contentType = req.headers.get("Content-Type") || ""
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)

    if (!boundaryMatch) {
      return new Response(
        JSON.stringify({ error: { message: "Missing or invalid multipart boundary" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`
    const body = await req.text()

    // Parse multipart body - simplified version that just looks for the image
    const parts = body.split(boundary).slice(1, -1)
    
    let imageData: { data: Uint8Array; filename: string; contentType: string } | null = null

    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex].trim()
      if (!part) continue

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

      if (headersEndIndex === -1) continue

      // Extract headers and content
      const headers = lines.slice(0, headersEndIndex)
      const contentLines = lines.slice(headersEndIndex + 1)
      const content = contentLines.join("\r\n")

      const contentDispositionHeader = headers.find(h => h.startsWith("Content-Disposition:"))
      const contentTypeHeader = headers.find(h => h.startsWith("Content-Type:"))

      if (!contentDispositionHeader) continue

      // Parse Content-Disposition to get name and filename
      const dispositionMatch = contentDispositionHeader.match(/name="([^"]+)"(?:; filename="([^"]+)")?/i)
      if (!dispositionMatch) continue

      const fieldName = dispositionMatch[1]
      const fileName = dispositionMatch[2]

      if (fileName && fieldName === "image") {
        const contentTypeMatch = contentTypeHeader?.match(/Content-Type:\s*(.+)/i)
        if (!contentTypeMatch) continue

        const contentTypeValue = contentTypeMatch[1]

        // Convert string content to Uint8Array
        const encoder = new TextEncoder()
        const data = encoder.encode(content)

        imageData = {
          data,
          filename: fileName,
          contentType: contentTypeValue
        }
        break
      }
    }

    // Validate image exists
    if (!imageData) {
      return new Response(
        JSON.stringify({ error: { message: "Image file is required" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(imageData.contentType)) {
      return new Response(
        JSON.stringify({ error: { message: "Only JPEG, PNG, and WebP images are allowed" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Validate file size (5 MB limit)
    const maxSize = 5 * 1024 * 1024 // 5 MB
    if (imageData.data.length > maxSize) {
      return new Response(
        JSON.stringify({ error: { message: "Image size must be less than 5 MB" } }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      )
    }

    // Generate unique storage path
    const timestamp = new Date().toISOString()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = imageData.contentType.split("/")[1]
    const storagePath = `submissions/${user.id}/${timestamp}-${randomId}.${fileExtension}`

    // Upload image to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("submission-images")
      .upload(storagePath, imageData.data, {
        contentType: imageData.contentType,
        upsert: false
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return new Response(
        JSON.stringify({ error: { message: "Failed to upload image" } }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Insert submission record into database - SIMPLE VERSION WITHOUT CRYPTO
    const encoder = new TextEncoder()
    const jsonData = JSON.stringify({
      user_id: user.id,
      image_url: storagePath,
      latitude: null,
      longitude: null,
      accuracy: null,
      status: 'pending',
      points_awarded: 0
    })

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceRoleKey,
        'Authorization': `Bearer ${supabaseServiceRoleKey}`
      },
      body: encoder.encode(jsonData)
    })

    if (!insertResponse.ok) {
      const errorData = await insertResponse.json()
      console.error("Database insert error:", errorData)
      return new Response(
        JSON.stringify({ error: { message: "Failed to create submission record" } }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const insertData = await insertResponse.json()
    const submissionData = insertData[0]

    // Return successful response
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
    console.error("Unexpected error:", err)
    return new Response(
      JSON.stringify({ error: { message: "Internal server error", detail: String(err) } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

serve(handler)
