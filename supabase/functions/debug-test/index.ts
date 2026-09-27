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

    // Get the body and content type
    const contentType = req.headers.get("Content-Type") || ""
    const body = await req.text()
    
    // Log what we received (for debugging)
    console.log(`Content-Type: ${contentType}`);
    console.log(`Body length: ${body.length}`);
    console.log(`Body preview: ${body.substring(0, Math.min(200, body.length))}`);

    // Check if we can find the boundary
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      return new Response(
        JSON.stringify({ 
          error: { 
            message: "Missing or invalid multipart boundary",
            contentType: contentType,
            body_preview: body.substring(0, Math.min(100, body.length))
          } 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
    console.log(`Boundary: ${boundary}`);
    
    // Split by boundary
    const parts = body.split(boundary).slice(1, -1); // Remove first empty and last closing part
    console.log(`Number of parts: ${parts.length}`);
    
    // Look for image part
    let foundImage = false;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part.includes('Content-Disposition: form-data; name="image"')) {
        foundImage = true;
        console.log(`Found image part at index ${i}`);
        console.log(`Part preview: ${part.substring(0, Math.min(200, part.length))}`);
        break;
      }
    }

    if (!foundImage) {
      return new Response(
        JSON.stringify({ 
          error: { 
            message: "No image field found",
            boundary: boundary,
            num_parts: parts.length,
            body_preview: body.substring(0, Math.min(200, body.length)),
            all_parts: parts.map((p, i) => `Part ${i}: ${p.substring(0, Math.min(100, p.length))}`).join(" | ")
          } 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // If we get here, everything works
    return new Response(
      JSON.stringify({ 
        message: "Debug successful", 
        user_id: user.id,
        body_length: body.length,
        boundary: boundary,
        num_parts: parts.length
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: { message: "Internal error", detail: String(err) } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

serve(handler)
