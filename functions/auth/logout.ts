import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

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
    // Get the authorization header
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
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

    // Sign out the user
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("Logout error:", error)
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_LOGOUT_FAILED",
            message: error.message || "Failed to logout",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Return success message
    return new Response(
      JSON.stringify({
        message: "Logged out successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected error in logout function:", err)
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})