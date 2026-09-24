import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Step 1: Mock environment variables FIRST
const originalEnvGet = Deno.env.get;
Deno.env.get = (key: string) => {
  if (key === "SUPABASE_URL") return "https://test.supabase.co";
  if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
  return originalEnvGet?.call(Deno.env, key);
};

// Step 2: Create a complete mock of the supabase module
const mockSupabaseJsModule = {
  // This is what createClient should return
  createClient: (url: string, key: string) => ({
    auth: {
      signInWithPassword: async (params: { email: string; password: string }) => {
        if (params.email === "test@example.com" && params.password === "correct_password") {
          return {
            data: {
              user: {
                id: "test-user-id",
                email: "test@example.com",
                user_metadata: {
                  full_name: "Test User",
                  avatar_url: null
                },
                created_at: "2026-09-21T10:30:00Z",
                updated_at: "2026-09-21T10:30:00Z",
                email_confirmed_at: "2026-09-21T10:30:00Z",
                last_sign_in_at: "2026-09-21T10:30:00Z"
              },
              session: {
                access_token: "test-access-token",
                refresh_token: "test-refresh-token",
                expires_in: 3600
              }
            },
            error: null
          };
        } else {
          return {
            data: null,
            error: { message: "Invalid login credentials" }
          };
        }
      }
    }
  })
};

// Step 3: Mock the module import system to return our mock when supabase-js is imported
const originalImport = Deno.import;
Deno.import = async (specifier: string, referrer?: string | URL) => {
  if (specifier === "https://esm.sh/@supabase/supabase-js@2") {
    return Promise.resolve(mockSupabaseJsModule as any);
  }
  return originalImport.call(Deno, specifier, referrer);
};

// Step 4: NOW import our function module (after mocks are set up)
const { default: loginHandler } = await import("../functions/auth/login.ts");

// Step 5: Restore original imports after getting our function
Deno.import = originalImport;

Deno.test({
  name: "auth/login - valid login",
  fn: async () => {
    const req = new Request("http://localhost/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "test@example.com",
        password: "correct_password"
      })
    });

    const resp = await loginHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 200);
    assertEquals(data.user.id, "test-user-id");
    assertEquals(data.user.email, "test@example.com");
    assertEquals(data.user.full_name, "Test User");
    assertEquals(data.session.access_token, "test-access-token");
    assertEquals(data.session.refresh_token, "test-refresh-token");
    assertEquals(data.session.expires_in, 3600);
  }
});

Deno.test({
  name: "auth/login - missing email",
  fn: async () => {
    const req = new Request("http://localhost/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: "any-password"
      })
    });

    const resp = await loginHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 400);
    assertEquals(data.error.code, "VALIDATION_REQUIRED_FIELD");
  }
});

Deno.test({
  name: "auth/login - missing password",
  fn: async () => {
    const req = new Request("http://localhost/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "test@example.com"
      })
    });

    const resp = await loginHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 400);
    assertEquals(data.error.code, "VALIDATION_REQUIRED_FIELD");
  }
});

Deno.test({
  name: "auth/login - invalid credentials",
  fn: async () => {
    const req = new Request("http://localhost/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "test@example.com",
        password: "wrong_password"
      })
    });

    const resp = await loginHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 401);
    assertEquals(data.error.code, "AUTH_INVALID_CREDENTIALS");
  }
});

// Restore original env getter
Deno.env.get = originalEnvGet;