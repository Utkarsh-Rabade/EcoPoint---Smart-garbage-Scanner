import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

interface ResetPasswordRequest {
  email: string
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
    const { email }: ResetPasswordRequest = await req.json()

    // Validate input
    if (!email) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_REQUIRED_FIELD",
            message: "Email is required",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // For security, we don't reveal whether the same message regardless of whether the email exists
    // This prevents email enumeration attacks
    await supabase.auth.resetPasswordForEmail(email, {
      // You can customize the redirect URL here if needed
      // redirectTo: `${Deno.env.get("FRONTEND_URL")}/reset-password`
    })

    // Always return the same message to prevent email enumeration
    return new Response(
      JSON.stringify({
        message: "If an account exists with that email, a reset link has been sent",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected error in reset password request function:", err)
    // Still return the same message for security
    return new Response(
      JSON.stringify({
        message: "If an account exists with that email, a reset link has been sent",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
})