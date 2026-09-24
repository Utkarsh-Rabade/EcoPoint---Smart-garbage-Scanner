import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

interface RegisterRequest {
  email: string
  password: string
  full_name: string
  referral_code?: string
}

const registerHandler = async (req: Request): Promise<Response> => {
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
    const { email, password, full_name, referral_code }: RegisterRequest = await req.json()

    // Validate input
    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_REQUIRED_FIELD",
            message: "Email, password, and full name are required",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Call Supabase Auth signUp
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          // Note: referral_code handling would go here if needed
          // For now, we're storing it in user metadata if provided
          ...(referral_code && { referral_code }),
        },
      },
    })

    if (error) {
      console.error("Sign up error:", error)
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_SIGN_UP_FAILED",
            message: error.message || "Failed to create account",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Note: The profile will be created automatically by the trigger function
    // No need to create it here

    // Return the user and session data
    return new Response(
      JSON.stringify({
        user: {
          id: data.user?.id,
          email: data.user?.email,
          full_name: data.user?.user_metadata?.full_name || "",
          avatar_url: data.user?.user_metadata?.avatar_url || null,
          created_at: data.user?.created_at,
          is_active: true,
          email_verified: data.user?.email_confirmed_at !== null,
        },
        session: {
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_in: data.session?.expires_in,
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected error in register function:", err)
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

serve(registerHandler)

// Export the handler for testing
export default registerHandler