import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock the Supabase client
const mockSupabase = {
  auth: {
    verifyOtp: async () => ({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          user_metadata: {
            full_name: "Test User",
            avatar_url: null
          },
          created_at: "2026-09-21T10:30:00Z",
          email_confirmed_at: "2026-09-21T10:35:00Z"
        },
        session: {
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
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
  name: "auth/reset-verify - valid token and password",
  fn: async () => {
    const { default: resetVerifyHandler } = await import("../functions/auth/reset-verify.ts");

    const req = new Request("http://localhost/reset-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "valid-reset-token",
        password: "newSecurePassword123!"
      })
    });

    const resp = await resetVerifyHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 200);
    assertEquals(data.access_token, "test-access-token");
    assertEquals(data.refresh_token, "test-refresh-token");
    assertEquals(data.expires_in, 3600);
    assertEquals(data.user.id, "test-user-id");
    assertEquals(data.user.email, "test@example.com");
    assertEquals(data.user.user_metadata.full_name, "Test User");
  }
});

Deno.test({
  name: "auth/reset-verify - missing token",
  fn: async () => {
    const { default: resetVerifyHandler } = await import("../functions/auth/reset-verify.ts");

    const req = new Request("http://localhost/reset-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: "newSecurePassword123!"
      })
    });

    const resp = await resetVerifyHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 400);
    assertEquals(data.error.code, "VALIDATION_REQUIRED_FIELD");
  }
});

Deno.test({
  name: "auth/reset-verify - missing password",
  fn: async () => {
    const { default: resetVerifyHandler } = await import("../functions/auth/reset-verify.ts");

    const req = new Request("http://localhost/reset-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "valid-reset-token"
      })
    });

    const resp = await resetVerifyHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 400);
    assertEquals(data.error.code, "VALIDATION_REQUIRED_FIELD");
  }
});

Deno.test({
  name: "auth/reset-verify - invalid token",
  fn: async () => {
    // Override mock to simulate invalid token
    const mockSupabaseInvalid = {
      auth: {
        verifyOtp: async () => ({
          data: null,
          error: { message: "Invalid token" }
        })
      }
    };

    const { default: resetVerifyHandler } = await import("../functions/auth/reset-verify.ts");

    const req = new Request("http://localhost/reset-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "invalid-token",
        password: "newSecurePassword123!"
      })
    });

    const resp = await resetVerifyHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 400);
    assertEquals(data.error.code, "VALIDATION_INVALID_TOKEN");
  }
});

// Restore original env getter
Deno.env.get = originalEnvGet;