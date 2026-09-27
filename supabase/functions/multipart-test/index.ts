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
    // Just try to get the user
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

    // Try to parse multipart
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

    // Simple check: look for image in the body
    if (!body.includes('filename="image"')) {
      return new Response(
        JSON.stringify({ error: { message: "No image field found" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // If we get here, multipart parsing works at a basic level
    return new Response(
      JSON.stringify({ 
        message: "Multipart parsing works", 
        user_id: user.id,
        body_length: body.length,
        has_image_field: body.includes('filename="image"')
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Error:", err)
    return new Response(
      JSON.stringify({ error: { message: "Internal error", detail: String(err) } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

serve(handler)
