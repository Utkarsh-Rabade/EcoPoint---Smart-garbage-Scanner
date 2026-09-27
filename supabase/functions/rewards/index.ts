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

    // Define available rewards
    // In a real application, this would come from a rewards table
    // For now, we'll define some static rewards
    const rewards = [
      {
        id: "eco-bag",
        name: "Eco-Friendly Shopping Bag",
        description: "Reusable tote bag made from recycled materials",
        points_required: 500,
        icon: "🛍️",
        category: "accessories"
      },
      {
        id: "stainless-straw",
        name: "Stainless Steel Straw Set",
        description: "Set of 4 reusable straws with cleaning brush",
        points_required: 300,
        icon: "🥤",
        category: "kitchen"
      },
      {
        id: "bamboo-utensils",
        name: "Bamboo Utensil Set",
        description: "Travel cutlery set with case",
        points_required: 400,
        icon: "🍴",
        category: "kitchen"
      },
      {
        id: "tree-planting",
        name: "Tree Planting Certificate",
        description: "Have a tree planted in your name",
        points_required: 1000,
        icon: "🌳",
        category: "environment"
      },
      {
        id: "recycling-guide",
        name: "Advanced Recycling Guide",
        description: "Digital guide to recycling best practices",
        points_required: 200,
        icon: "📚",
        category: "education"
      }
    ];

    // Return the rewards data
    return new Response(
      JSON.stringify({
        rewards,
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