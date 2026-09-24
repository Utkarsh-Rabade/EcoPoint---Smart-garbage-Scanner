import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test({
  name: "auth/register - valid registration",
  fn: async () => {
    // Set up mocks BEFORE importing the module
    const originalEnvGet = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "SUPABASE_URL") return "https://test.supabase.co";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
      return originalEnvGet?.call(Deno.env, key);
    };

    let originalFetch: typeof globalThis.fetch;
    if (typeof globalThis.fetch === "function") {
      originalFetch = globalThis.fetch;
    }

    // Mock fetch function to intercept Supabase calls
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      // Convert input to string URL
      let urlString = "";
      if (typeof input === "string") {
        urlString = input;
      } else if (input instanceof URL) {
        urlString = input.toString();
      } else {
        urlString = String(input);
      }

      // Handle Supabase Auth signUp endpoint
      if (urlString.includes("/auth/v1/signup")) {
        // Parse request body
        let body: any = {};
        if (init?.body) {
          let bodyText = "";
          if (typeof init.body === "string") {
            bodyText = init.body;
          } else if (init.body instanceof Blob) {
            bodyText = await init.body.text();
          } else {
            bodyText = String(init.body);
          }

          try {
            body = JSON.parse(bodyText);
          } catch (e) {
            body = {};
          }
        }

        // Check if this is our test data
        if (body.email === "test@example.com" &&
            body.password === "SecurePass123!" &&
            body.data?.full_name === "Test User") {

          // Return successful signup response
          return new Response(JSON.stringify({
            data: {
              user: {
                id: "test-user-id",
                email: "test@example.com",
                user_metadata: {
                  full_name: "Test User",
                  avatar_url: null
                },
                created_at: "2026-09-21T10:30:00Z",
                email_confirmed_at: "2026-09-21T10:30:00Z"
              },
              session: {
                access_token: "test-access-token",
                refresh_token: "test-refresh-token",
                expires_in: 3600
              }
            }
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } else {
          // Return validation error for missing/invalid fields
          return new Response(JSON.stringify({
            error: {
              message: "Email, password, and full name are required"
            }
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // Handle other endpoints
      return new Response(JSON.stringify({ error: { message: "Not found" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    };

    try {
      // Import the module AFTER setting up mocks
      const { default: registerHandler } = await import("../functions/auth/register.ts");

      const req = new Request("http://localhost/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "SecurePass123!",
          full_name: "Test User"
        })
      });

      const resp = await registerHandler(req);
      const data = await resp.json();

      assertEquals(resp.status, 201);
      assertEquals(data.user.id, "test-user-id");
      assertEquals(data.user.email, "test@example.com");
      assertEquals(data.user.full_name, "Test User");
      assertEquals(data.session.access_token, "test-access-token");
      assertEquals(data.session.refresh_token, "test-refresh-token");
      assertEquals(data.session.expires_in, 3600);
    } finally {
      // Restore originals
      Deno.env.get = originalEnvGet;
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      }
    }
  }
});

Deno.test({
  name: "auth/register - missing email",
  fn: async () => {
    // Set up mocks
    const originalEnvGet = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "SUPABASE_URL") return "https://test.supabase.co";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
      return originalEnvGet?.call(Deno.env, key);
    };

    let originalFetch: typeof globalThis.fetch;
    if (typeof globalThis.fetch === "function") {
      originalFetch = globalThis.fetch;
    }

    // Mock fetch function
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: { message: "Not implemented" } }), {
        status: 501,
        headers: { "Content-Type": "application/json" }
      });
    };

    try {
      // Import the module
      const { default: registerHandler } = await import("../functions/auth/register.ts");

      const req = new Request("http://localhost/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          password: "SecurePass123!",
          full_name: "Test User"
        })
      });

      const resp = await registerHandler(req);
      const data = await resp.json();

      assertEquals(resp.status, 400);
      assertEquals(data.error.code, "VALIDATION_REQUIRED_FIELD");
    } finally {
      // Restore originals
      Deno.env.get = originalEnvGet;
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      }
    }
  }
});

Deno.test({
  name: "auth/register - missing password",
  fn: async () => {
    // Set up mocks
    const originalEnvGet = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "SUPABASE_URL") return "https://test.supabase.co";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
      return originalEnvGet?.call(Deno.env, key);
    };

    let originalFetch: typeof globalThis.fetch;
    if (typeof globalThis.fetch === "function") {
      originalFetch = globalThis.fetch;
    }

    // Mock fetch function
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: { message: "Not implemented" } }), {
        status: 501,
        headers: { "Content-Type": "application/json" }
      });
    };

    try {
      // Import the module
      const { default: registerHandler } = await import("../functions/auth/register.ts");

      const req = new Request("http://localhost/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: "test@example.com",
          full_name: "Test User"
        })
      });

      const resp = await registerHandler(req);
      const data = await resp.json();

      assertEquals(resp.status, 400);
      assertEquals(data.error.code, "VALIDATION_REQUIRED_FIELD");
    } finally {
      // Restore originals
      Deno.env.get = originalEnvGet;
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      }
    }
  }
});

Deno.test({
  name: "auth/register - missing full_name",
  fn: async () => {
    // Set up mocks
    const originalEnvGet = Deno.env.get;
    Deno.env.get = (key: string) => {
      if (key === "SUPABASE_URL") return "https://test.supabase.co";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
      return originalEnvGet?.call(Deno.env, key);
    };

    let originalFetch: typeof globalThis.fetch;
    if (typeof globalThis.fetch === "function") {
      originalFetch = globalThis.fetch;
    }

    // Mock fetch function
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: { message: "Not implemented" } }), {
        status: 501,
        headers: { "Content-Type": "application/json" }
      });
    };

    try {
      // Import the module
      const { default: registerHandler } = await import("../functions/auth/register.ts");

      const req = new Request("http://localhost/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "SecurePass123!"
        })
      });

      const resp = await registerHandler(req);
      const data = await resp.json();

      assertEquals(resp.status, 400);
      assertEquals(data.error.code, "VALIDATION_REQUIRED_FIELD");
    } finally {
      // Restore originals
      Deno.env.get = originalEnvGet;
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      }
    }
  }
});