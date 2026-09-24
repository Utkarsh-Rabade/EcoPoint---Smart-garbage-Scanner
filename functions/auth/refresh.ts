import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

interface RefreshRequest {
  refresh_token: string
}

serve(async (req) => {
  // Handle CORS
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
    return new Response(JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const { refresh_token }: RefreshRequest = await req.json()

    // Validate input
    if (!refresh_token) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_REQUIRED_FIELD",
            message: "Refresh token is required",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Refresh the session using the refresh token
    const { data, error } = await supabase.auth.refreshSession({ refresh_token })

    if (error) {
      console.error("Refresh session error:", error)
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_REFRESH_FAILED",
            message: error.message || "Failed to refresh session",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Return the new access token
    return new Response(
      JSON.stringify({
        access_token: data.session?.access_token,
        expires_in: data.session?.expires_in,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected error in refresh function:", err)
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})