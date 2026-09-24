import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

console.log("[TEST] Starting supabase mock test");

// Mock environment variables FIRST
console.log("[TEST] Setting up environment mocks");
const originalEnvGet = Deno.env.get;
Deno.env.get = (key: string) => {
  if (key === "SUPABASE_URL") return "https://test.supabase.co";
  if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
  return originalEnvGet?.call(Deno.env, key);
};

console.log("[TEST] Environment mocks set up");

// Store original fetch
let originalFetch: typeof globalThis.fetch;
if (typeof globalThis.fetch === "function") {
  originalFetch = globalThis.fetch;
  console.log("[TEST] Stored original fetch");
}

// Mock fetch function to intercept Supabase calls
let fetchCallCount = 0;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  fetchCallCount++;
  // Convert input to string URL
  let urlString = "";
  if (typeof input === "string") {
    urlString = input;
  } else if (input instanceof URL) {
    urlString = input.toString();
  } else {
    urlString = String(input);
  }

  console.log(`[FETCH MOCK #${fetchCallCount}] Intercepting call to: ${urlString}`);

  // Handle Supabase Auth signUp endpoint
  if (urlString.includes("/auth/v1/signup")) {
    console.log("[FETCH MOCK] Handling signup request");

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
        console.log(`[FETCH MOCK] Failed to parse body: ${e}`);
        body = {};
      }
    }

    console.log(`[FETCH MOCK] Request body: ${JSON.stringify(body)}`);

    // For now, return success for any request to signup endpoint
    console.log("[FETCH MOCK] Returning success response");
    // Let's try a very simple response first
    const responseBody = {
      data: {
        user: {
          id: "test-user-id"
        },
        session: {
          access_token: "test-access-token"
        }
      }
    };

    console.log(`[FETCH MOCK] Response body: ${JSON.stringify(responseBody)}`);

    // Return successful signup response
    const response = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

    console.log(`[FETCH MOCK] Response object: ${JSON.stringify({
      type: response.type,
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })}`);

    return response;
  }

  console.log(`[FETCH MOCK #${fetchCallCount}] Returning 404 for: ${urlString}`);
  // Handle other endpoints
  return new Response(JSON.stringify({ error: { message: "Not found" } }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
};

console.log("[TEST] Fetch mock set up");

// Import the module AFTER setting up mocks
console.log("[TEST] Importing supabase client");
const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
console.log("[TEST] Supabase client imported");

// Create client
console.log("[TEST] Creating supabase client");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
console.log(`[TEST] URL: ${supabaseUrl}, Key: ${supabaseServiceRoleKey}`);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
console.log("[TEST] Supabase client created");

// Test the signUp method
console.log("[TEST] Calling signUp");
const result = await supabase.auth.signUp({
  email: "test@example.com",
  password: "SecurePass123!",
  options: {
    data: {
      full_name: "Test User"
    }
  }
});

console.log(`[TEST] SignUp result: ${JSON.stringify(result)}`);

// Assertions
assertEquals(fetchCallCount, 1, "Fetch should have been called exactly once");
// Based on our test, the format is { data: { user: {...}, session: {...} } }
assertEquals(result.data?.user?.id, "test-user-id");
assertEquals(result.data?.session?.access_token, "test-access-token");

// Restore originals
console.log("[TEST] Restoring originals");
Deno.env.get = originalEnvGet;
if (originalFetch) {
  globalThis.fetch = originalFetch;
}
console.log("[TEST] Test completed successfully");