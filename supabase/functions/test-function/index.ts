import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const handler = async (req: Request): Promise<Response> => {
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
    return new Response(
      JSON.stringify({ error: { message: "Method not allowed" } }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    )
  }

  return new Response(
    JSON.stringify({ message: "Hello World", method: req.method }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

serve(handler)
