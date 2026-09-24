import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

interface LoginRequest {
  email: string
  password: string
}

const loginHandler = async (req: Request): Promise<Response> => {
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
    const { email, password }: LoginRequest = await req.json()

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_REQUIRED_FIELD",
            message: "Email and password are required",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Call Supabase Auth signInWithPassword
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Login error:", error)
      // Don't reveal whether email exists or not for security
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Return the user and session data
    return new Response(
      JSON.stringify({
        user: {
          id: data.user?.id,
          email: data.user?.email,
          full_name: data.user?.user_metadata?.full_name || "",
          avatar_url: data.user?.user_metadata?.avatar_url || null,
          created_at: data.user?.created_at,
          updated_at: data.user?.updated_at,
          is_active: true,
          email_verified: data.user?.email_confirmed_at !== null,
          last_login_at: data.user?.last_sign_in_at,
        },
        session: {
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_in: data.session?.expires_in,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected error in login function:", err)
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

serve(loginHandler)

// Export the handler for testing
export default loginHandler