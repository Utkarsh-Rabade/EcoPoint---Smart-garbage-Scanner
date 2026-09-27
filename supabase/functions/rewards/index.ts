import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!

const createHandler = async (req: Request): Promise<Response> => {
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
    return new Response(
      JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    )
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

    // Create supabase client with the user's JWT for RLS
    const supabase = createClient(supabaseUrl, accessToken)

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

    // Fetch rewards from the rewards table
    const { data: rewards, error: rewardsError } = await supabase
      .from('rewards')
      .select('title, points_cost')
      .eq('available', true)
      .order('points_cost', { ascending: true });

    if (rewardsError) {
      console.error("Rewards fetch error:", rewardsError)
      return new Response(
        JSON.stringify({
          error: {
            code: "REWARDS_FETCH_FAILED",
            message: "Failed to fetch rewards",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Return the rewards data in the exact format requested
    return new Response(
      JSON.stringify({
        rewards: rewards || [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (err) {
    console.error("Unexpected error in rewards function:", err)
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