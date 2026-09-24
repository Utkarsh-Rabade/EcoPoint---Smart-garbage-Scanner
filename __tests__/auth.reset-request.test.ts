import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock the Supabase client
const mockSupabase = {
  auth: {
    resetPasswordForEmail: async () => ({})
  }
};

// Mock Deno.env.get
const originalEnvGet = Deno.env.get;
Deno.env.get = (key: string) => {
  if (key === "SUPABASE_URL") return "https://test.supabase.co";
  if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
  return originalEnvGet?.call(Deno.env, key);
};

Deno.test({
  name: "auth/reset-request - valid email",
  fn: async () => {
    const { default: resetRequestHandler } = await import("../functions/auth/reset-request.ts");

    const req = new Request("http://localhost/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com"
      })
    });

    const resp = await resetRequestHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 200);
    assertEquals(data.message, "If an account exists with that email, a reset link has been sent");
  }
});

Deno.test({
  name: "auth/reset-request - missing email",
  fn: async () => {
    const { default: resetRequestHandler } = await import("../functions/auth/reset-request.ts");

    const req = new Request("http://localhost/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    const resp = await resetRequestHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 400);
    assertEquals(data.error.code, "VALIDATION_REQUIRED_FIELD");
  }
});

// Restore original env getter
Deno.env.get = originalEnvGet;