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

    // Fetch top 20 users ordered by total_points descending
    const { data: leaderboard, error: leaderboardError } = await supabase
      .from('profiles')
      .select('id, display_name, total_points, created_at')
      .order('total_points', { ascending: false })
      .limit(20)

    if (leaderboardError) {
      console.error("Leaderboard fetch error:", leaderboardError)
      return new Response(
        JSON.stringify({
          error: {
            code: "LEADERBOARD_FETCH_FAILED",
            message: "Failed to fetch leaderboard",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Add rank to each profile
    const leaderboardWithRank = leaderboard?.map((profile, index) => ({
      ...profile,
      rank: index + 1
    })) || []

    // Return the leaderboard data
    return new Response(
      JSON.stringify({
        leaderboard: leaderboardWithRank,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (err) {
    console.error("Unexpected error in leaderboard function:", err)
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