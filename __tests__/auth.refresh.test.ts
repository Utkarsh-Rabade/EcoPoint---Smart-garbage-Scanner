import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock the Supabase client
const mockSupabase = {
  auth: {
    refreshSession: async () => ({
      data: {
        session: {
          access_token: "new-test-access-token",
          expires_in: 3600
        }
      },
      error: null
    })
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
  name: "auth/refresh - valid refresh token",
  fn: async () => {
    const { default: refreshHandler } = await import("../functions/auth/refresh.ts");

    const req = new Request("http://localhost/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: "test-refresh-token"
      })
    });

    const resp = await refreshHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 200);
    assertEquals(data.access_token, "new-test-access-token");
    assertEquals(data.expires_in, 3600);
  }
});

Deno.test({
  name: "auth/refresh - missing refresh token",
  fn: async () => {
    const { default: refreshHandler } = await import("../functions/auth/refresh.ts");

    const req = new Request("http://localhost/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    const resp = await refreshHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 400);
    assertEquals(data.error.code, "VALIDATION_REQUIRED_FIELD");
  }
});

Deno.test({
  name: "auth/refresh - invalid refresh token",
  fn: async () => {
    // Override mock to simulate invalid refresh token
    const mockSupabaseInvalid = {
      auth: {
        refreshSession: async () => ({
          data: null,
          error: { message: "Invalid refresh token" }
        })
      }
    };

    const { default: refreshHandler } = await import("../functions/auth/refresh.ts");

    const req = new Request("http://localhost/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: "invalid-refresh-token"
      })
    });

    const resp = await refreshHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 401);
    assertEquals(data.error.code, "AUTH_REFRESH_FAILED");
  }
});

// Restore original env getter
Deno.env.get = originalEnvGet;