import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock the Supabase client
const mockSupabase = {
  auth: {
    signOut: async () => ({ error: null })
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
  name: "auth/logout - successful logout",
  fn: async () => {
    const { default: logoutHandler } = await import("../functions/auth/logout.ts");

    const req = new Request("http://localhost/logout", {
      method: "POST",
      headers: {
        "Authorization": "Bearer test-access-token",
        "Content-Type": "application/json"
      }
    });

    const resp = await logoutHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 200);
    assertEquals(data.message, "Logged out successfully");
  }
});

Deno.test({
  name: "auth/logout - missing authorization header",
  fn: async () => {
    const { default: logoutHandler } = await import("../functions/auth/logout.ts");

    const req = new Request("http://localhost/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    const resp = await logoutHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 401);
    assertEquals(data.error.code, "AUTH_MISSING_TOKEN");
  }
});

Deno.test({
  name: "auth/logout - malformed authorization header",
  fn: async () => {
    const { default: logoutHandler } = await import("../functions/auth/logout.ts");

    const req = new Request("http://localhost/logout", {
      method: "POST",
      headers: {
        "Authorization": "InvalidToken test-access-token",
        "Content-Type": "application/json"
      }
    });

    const resp = await logoutHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 401);
    assertEquals(data.error.code, "AUTH_MISSING_TOKEN");
  }
});

// Restore original env getter
Deno.env.get = originalEnvGet;