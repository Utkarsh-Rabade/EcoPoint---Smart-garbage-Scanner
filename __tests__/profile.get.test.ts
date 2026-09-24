import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock the Supabase client
const mockSupabase = {
  auth: {
    getUser: async () => ({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          user_metadata: {
            full_name: "Test User",
            avatar_url: "https://example.com/avatar.jpg"
          },
          created_at: "2026-09-20T15:20:00Z",
          updated_at: "2026-09-21T09:15:00Z",
          email_confirmed_at: "2026-09-21T09:15:00Z",
          last_sign_in_at: "2026-09-21T10:30:00Z"
        }
      },
      error: null
    })
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            id: "test-user-id",
            email: "test@example.com",
            full_name: "Test User",
            avatar_url: "https://example.com/avatar.jpg",
            created_at: "2026-09-20T15:20:00Z",
            updated_at: "2026-09-21T09:15:00Z",
            is_active: true,
            email_verified: true,
            last_login_at: "2026-09-21T10:30:00Z",
            total_points: 1250,
            member_since: "2026-09-20",
            preferences: { email_notifications: true, newsletter: false }
          },
          error: null
        })
      })
    })
  })
};

// Mock Deno.env.get
const originalEnvGet = Deno.env.get;
Deno.env.get = (key: string) => {
  if (key === "SUPABASE_URL") return "https://test.supabase.co";
  if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
  return originalEnvGet?.call(Deno.env, key);
};

Deno.test({
  name: "profile/get - valid token",
  fn: async () => {
    const { default: profileHandler } = await import("../functions/profile/get.ts");

    const req = new Request("http://localhost/profile", {
      method: "GET",
      headers: {
        "Authorization": "Bearer test-access-token",
        "Content-Type": "application/json"
      }
    });

    const resp = await profileHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 200);
    assertEquals(data.id, "test-user-id");
    assertEquals(data.email, "test@example.com");
    assertEquals(data.full_name, "Test User");
    assertEquals(data.avatar_url, "https://example.com/avatar.jpg");
    assertEquals(data.total_points, 1250);
  }
});

Deno.test({
  name: "profile/get - missing authorization header",
  fn: async () => {
    const { default: profileHandler } = await import("../functions/profile/get.ts");

    const req = new Request("http://localhost/profile", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    const resp = await profileHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 401);
    assertEquals(data.error.code, "AUTH_MISSING_TOKEN");
  }
});

Deno.test({
  name: "profile/get - invalid token",
  fn: async () => {
    // Override mock to simulate invalid token
    const mockSupabaseInvalid = {
      auth: {
        getUser: async () => ({
          data: null,
          error: { message: "Invalid token" }
        })
      }
    };

    const { default: profileHandler } = await import("../functions/profile/get.ts");

    const req = new Request("http://localhost/profile", {
      method: "GET",
      headers: {
        "Authorization": "Bearer invalid-token",
        "Content-Type": "application/json"
      }
    });

    const resp = await profileHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 401);
    assertEquals(data.error.code, "AUTH_INVALID_TOKEN");
  }
});

Deno.test({
  name: "profile/get - profile not found",
  fn: async () => {
    // Override mock to simulate profile not found
    const mockSupabaseNoProfile = {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "test-user-id",
              email: "test@example.com",
              user_metadata: {
                full_name: "Test User",
                avatar_url: null
              },
              created_at: "2026-09-20T15:20:00Z",
              updated_at: "2026-09-21T09:15:00Z",
              email_confirmed_at: "2026-09-21T09:15:00Z",
              last_sign_in_at: "2026-09-21T10:30:00Z"
            }
          },
          error: null
        })
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: null,
              error: { message: "No rows found" }
            })
          })
        })
      })
    };

    const { default: profileHandler } = await import("../functions/profile/get.ts");

    const req = new Request("http://localhost/profile", {
      method: "GET",
      headers: {
        "Authorization": "Bearer test-access-token",
        "Content-Type": "application/json"
      }
    });

    const resp = await profileHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 404);
    assertEquals(data.error.code, "PROFILE_NOT_FOUND");
  }
});

// Restore original env getter
Deno.env.get = originalEnvGet;