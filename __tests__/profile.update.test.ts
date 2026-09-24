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
    update: () => ({
      eq: () => ({
        select: () => ({
          single: async () => ({
            data: {
              id: "test-user-id",
              email: "test@example.com",
              full_name: "Updated Name",
              avatar_url: "https://example.com/new-avatar.jpg",
              created_at: "2026-09-20T15:20:00Z",
              updated_at: "2026-09-21T10:45:00Z",
              is_active: true,
              email_verified: true,
              last_login_at: "2026-09-21T10:30:00Z",
              total_points: 1250,
              member_since: "2026-09-20",
              preferences: { email_notifications: false, newsletter: true }
            },
            error: null
          })
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
  name: "profile/update - valid update",
  fn: async () => {
    const { default: updateHandler } = await import("../functions/profile/update.ts");

    const req = new Request("http://localhost/profile", {
      method: "PUT",
      headers: {
        "Authorization": "Bearer test-access-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        full_name: "Updated Name",
        avatar_url: "https://example.com/new-avatar.jpg",
        preferences: {
          email_notifications: false,
          newsletter: true
        }
      })
    });

    const resp = await updateHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 200);
    assertEquals(data.id, "test-user-id");
    assertEquals(data.full_name, "Updated Name");
    assertEquals(data.avatar_url, "https://example.com/new-avatar.jpg");
    assertEquals(data.preferences.email_notifications, false);
    assertEquals(data.preferences.newsletter, true);
  }
});

Deno.test({
  name: "profile/update - missing authorization header",
  fn: async () => {
    const { default: updateHandler } = await import("../functions/profile/update.ts");

    const req = new Request("http://localhost/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    const resp = await updateHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 401);
    assertEquals(data.error.code, "AUTH_MISSING_TOKEN");
  }
});

Deno.test({
  name: "profile/update - invalid token",
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

    const { default: updateHandler } = await import("../functions/profile/update.ts");

    const req = new Request("http://localhost/profile", {
      method: "PUT",
      headers: {
        "Authorization": "Bearer invalid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const resp = await updateHandler(req);
    const data = await resp.json();

    assertEquals(resp.status, 401);
    assertEquals(data.error.code, "AUTH_INVALID_TOKEN");
  }
});

// Restore original env getter
Deno.env.get = originalEnvGet;