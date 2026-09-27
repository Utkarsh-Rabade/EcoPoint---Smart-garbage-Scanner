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
    console.log("=== MINIMAL DEBUG START ===")
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

    console.log("User authenticated:", user.id)

    // Just try to read the body
    const contentType = req.headers.get("Content-Type") || ""
    console.log("Content-Type:", contentType)
    const body = await req.text()
    console.log("Body length:", body.length)

    // Check if it looks like multipart
    if (contentType.includes("multipart/form-data")) {
      console.log("Looks like multipart data")
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
      if (boundaryMatch) {
        console.log("Boundary found:", boundaryMatch[1] || boundaryMatch[2])
        const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`
        const parts = body.split(boundary).slice(1, -1)
        console.log("Number of parts:", parts.length)
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i].trim()
          if (part) {
            console.log(`Part ${i}: ${part.substring(0, Math.min(100, part.length))}...`)
          }
        }
      } else {
        console.log("No boundary found in Content-Type")
      }
    } else {
      console.log("Not multipart data")
    }

    console.log("=== MINIMAL DEBUG END ===")
    return new Response(
      JSON.stringify({ 
        message: "Minimal debug successful", 
        user_id: user.id,
        body_length: body.length,
        is_multipart: contentType.includes("multipart/form-data")
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("=== MINIMAL DEBUG ERROR ===")
    console.error("Error:", err)
    return new Response(
      JSON.stringify({ error: { message: "Internal error", detail: String(err) } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

serve(handler)
