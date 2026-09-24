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
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  if (req.method !== "GET") {
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

    // Get the user from Supabase using the JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)

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

    // Get the profile from the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error("Get profile error:", profileError)
      return new Response(
        JSON.stringify({
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "Profile not found",
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    // Return the profile data
    return new Response(
      JSON.stringify({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url || null,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        is_active: profile.is_active,
        email_verified: profile.email_verified,
        last_login_at: profile.last_login_at,
        total_points: profile.total_points,
        member_since: profile.member_since,
        preferences: profile.preferences,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected error in get profile function:", err)
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})