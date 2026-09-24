import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

interface UpdateProfileRequest {
  full_name?: string
  avatar_url?: string | null
  preferences?: Record<string, unknown>
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  if (req.method !== "PUT") {
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

    const { full_name, avatar_url, preferences }: UpdateProfileRequest = await req.json()

    // Prepare the update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (full_name !== undefined) {
      updateData.full_name = full_name
    }

    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url
    }

    if (preferences !== undefined) {
      updateData.preferences = preferences
    }

    // Update the profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (updateError || !updatedProfile) {
      console.error("Update profile error:", updateError)
      return new Response(
        JSON.stringify({
          error: {
            code: "PROFILE_UPDATE_FAILED",
            message: updateError?.message || "Failed to update profile",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Return the updated profile
    return new Response(
      JSON.stringify({
        id: updatedProfile.id,
        email: updatedProfile.email,
        full_name: updatedProfile.full_name,
        avatar_url: updatedProfile.avatar_url || null,
        created_at: updatedProfile.created_at,
        updated_at: updatedProfile.updated_at,
        is_active: updatedProfile.is_active,
        email_verified: updatedProfile.email_verified,
        last_login_at: updatedProfile.last_login_at,
        total_points: updatedProfile.total_points,
        member_since: updatedProfile.member_since,
        preferences: updatedProfile.preferences,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected error in update profile function:", err)
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})