import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

console.log("[TEST] Starting submissions create mock test");

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
let lastSupabaseCall: { method: string; path: string; body?: any } | null = null;
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

  // Handle Supabase Auth getUser endpoint
  if (urlString.includes("/auth/v1/user")) {
    console.log("[FETCH MOCK] Handling getUser request");

    // Return mock user data
    const responseBody = {
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }
    };

    console.log(`[FETCH MOCK] Response body: ${JSON.stringify(responseBody)}`);

    // Return successful response
    const response = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

    return response;
  }

  // Handle Supabase storage upload
  if (urlString.includes("/storage/v1/object/submission-images/")) {
    console.log("[FETCH MOCK] Handling storage upload request");

    // Return mock upload success
    const responseBody = {
      data: {
        path: "submissions/test-user-id/2026-09-25T12:00:00.000Z-test-id.jpg"
      }
    };

    console.log(`[FETCH MOCK] Response body: ${JSON.stringify(responseBody)}`);

    // Return successful response
    const response = new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

    return response;
  }

  // Handle Supabase insert into submissions table
  if (urlString.includes("/rest/v1/submissions")) {
    console.log("[FETCH MOCK] Handling submissions insert request");

    // Store the call for verification
    lastSupabaseCall = {
      method: init?.method ?? "GET",
      path: urlString,
      body: init?.body ? JSON.parse(new TextDecoder().decode(init.body)) : undefined
    };

    // Return mock insert success
    const responseBody = [{
      id: "test-submission-id",
      user_id: "test-user-id",
      image_url: "submissions/test-user-id/2026-09-25T12:00:00.000Z-test-id.jpg",
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 10.0,
      submitted_at: new Date().toISOString(),
      status: "pending",
      points_awarded: 0
    }];

    console.log(`[FETCH MOCK] Response body: ${JSON.stringify(responseBody)}`);

    // Return successful response
    const response = new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });

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
console.log("[TEST] Importing submissions create function");
const { default: createHandler } = await import("../functions/submissions/create.ts");
console.log("[TEST] Submissions create function imported");

// Create a mock request with multipart/form-data
console.log("[TEST] Creating mock request");

async function createMultipartBody(fields: { [key: string]: string }, file: { name: string; data: Uint8Array; type: string }) {
  const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--\r\n`;

  let body = "";

  // Add text fields
  for (const [key, value] of Object.entries(fields)) {
    body += delimiter;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${value}`;
  }

  // Add file
  body += delimiter;
  body += `Content-Disposition: form-data; name="image"; filename="${file.name}"\r\n`;
  body += `Content-Type: ${file.type}\r\n\r\n`;
  body += new TextDecoder().decode(file.data);
  body += closeDelimiter;

  return {
    body,
    boundary
  };
}

// Test 1: Successful submission creation
console.log("[TEST] Test 1: Successful submission creation");

const testFields = {
  latitude: "40.7128",
  longitude: "-74.0060",
  accuracy: "10.0"
};

const testFile = {
  name: "test-image.jpg",
  data: new TextEncoder().encode("fake image data"),
  type: "image/jpeg"
};

const { body: multipartBody, boundary } = await createMultipartBody(testFields, testFile);

const mockRequest = new Request("https://test.supabase.co/functions/v1/submissions/create", {
  method: "POST",
  headers: {
    "Authorization": "Bearer test-access-token",
    "Content-Type": `multipart/form-data; boundary=${boundary}`
  },
  body: multipartBody
});

console.log("[TEST] Calling submissions create function");
const result = await createHandler(mockRequest);
const resultText = await result.text();

console.log(`[TEST] Result status: ${result.status}`);
console.log(`[TEST] Result body: ${resultText}`);

// Assertions
assertEquals(fetchCallCount >= 3, true, "Should have called Supabase 3+ times (getUser, storage upload, insert)");
assertEquals(result.status, 201, "Should return 201 Created");

const resultBody = JSON.parse(resultText);
assertEquals(resultBody.id, "test-submission-id", "Should return correct submission ID");
assertEquals(resultBody.user_id, "test-user-id", "Should return correct user ID");
assertEquals(resultBody.image_url, "submissions/test-user-id/2026-09-25T12:00:00.000Z-test-id.jpg", "Should return correct image path");
assertEquals(resultBody.latitude, 40.7128, "Should return correct latitude");
assertEquals(resultBody.longitude, -74.0060, "Should return correct longitude");
assertEquals(resultBody.accuracy, 10.0, "Should return correct accuracy");
assertEquals(resultBody.status, "pending", "Should return pending status");
assertEquals(resultBody.points_awarded, 0, "Should return 0 points awarded");

console.log("[TEST] Test 1 passed");

// Test 2: Missing image
console.log("[TEST] Test 2: Missing image");

const missingImageFields = {
  latitude: "40.7128",
  longitude: "-74.0060"
};

const missingImageFile = {
  name: "",
  data: new TextEncoder().encode(""),
  type: ""
};

const { body: missingImageBody } = await createMultipartBody(missingImageFields, missingImageFile);

const missingImageRequest = new Request("https://test.supabase.co/functions/v1/submissions/create", {
  method: "POST",
  headers: {
    "Authorization": "Bearer test-access-token",
    "Content-Type": `multipart/form-data; boundary=${boundary}`
  },
  body: missingImageBody
});

console.log("[TEST] Calling submissions create function with missing image");
const missingImageResult = await createHandler(missingImageRequest);

console.log(`[TEST] Missing image result status: ${missingImageResult.status}`);
const missingImageResultText = await missingImageResult.text();
	console.log(`[TEST] Missing image result body: ${missingImageResultText}`);

assertEquals(missingImageResult.status, 400, "Should return 400 Bad Request for missing image");
const missingImageResultBody = JSON.parse(missingImageResultText);
assertEquals(missingImageResultBody.error.code, "MISSING_IMAGE", "Should return MISSING_IMAGE error");

console.log("[TEST] Test 2 passed");

// Test 3: Invalid file type
console.log("[TEST] Test 3: Invalid file type");

const invalidTypeFields = {
  latitude: "40.7128",
  longitude: "-74.0060"
};

const invalidTypeFile = {
  name: "test-image.gif",
  data: new TextEncoder().encode("fake gif data"),
  type: "image/gif"
};

const { body: invalidTypeBody } = await createMultipartBody(invalidTypeFields, invalidTypeFile);

const invalidTypeRequest = new Request("https://test.supabase.co/functions/v1/submissions/create", {
  method: "POST",
  headers: {
    "Authorization": "Bearer test-access-token",
    "Content-Type": `multipart/form-data; boundary=${boundary}`
  },
  body: invalidTypeBody
});

console.log("[TEST] Calling submissions create function with invalid file type");
const invalidTypeResult = await createHandler(invalidTypeRequest);

console.log(`[TEST] Invalid file type result status: ${invalidTypeResult.status}`);
const invalidTypeResultText = await invalidTypeResult.text();
	console.log(`[TEST] Invalid file type result body: ${invalidTypeResultText}`);

assertEquals(invalidTypeResult.status, 400, "Should return 400 Bad Request for invalid file type");
const invalidTypeResultBody = JSON.parse(invalidTypeResultText);
assertEquals(invalidTypeResultBody.error.code, "INVALID_FILE_TYPE", "Should return INVALID_FILE_TYPE error");

console.log("[TEST] Test 3 passed");

// Test 4: File too large
console.log("[TEST] Test 4: File too large");

const largeFile = {
  name: "large-image.jpg",
  data: new TextEncoder().encode("x".repeat(6 * 1024 * 1024)), // 6 MB > 5 MB limit
  type: "image/jpeg"
};

const { body: largeFileBody } = await createMultipartBody(testFields, largeFile);

const largeFileRequest = new Request("https://test.supabase.co/functions/v1/submissions/create", {
  method: "POST",
  headers: {
    "Authorization": "Bearer test-access-token",
    "Content-Type": `multipart/form-data; boundary=${boundary}`
  },
  body: largeFileBody
});

console.log("[TEST] Calling submissions create function with oversized file");
const largeFileResult = await createHandler(largeFileRequest);

console.log(`[TEST] Oversized file result status: ${largeFileResult.status}`);
const largeFileResultText = await largeFileResult.text();
	console.log(`[TEST] Oversized file result body: ${largeFileResultText}`);

assertEquals(largeFileResult.status, 413, "Should return 413 Payload Too Large for oversized file");
const largeFileResultBody = JSON.parse(largeFileResultText);
assertEquals(largeFileResultBody.error.code, "FILE_TOO_LARGE", "Should return FILE_TOO_LARGE error");

console.log("[TEST] Test 4 passed");

// Test 5: Unauthenticated request
console.log("[TEST] Test 5: Unauthenticated request");

const unauthRequest = new Request("https://test.supabase.co/functions/v1/submissions/create", {
  method: "POST",
  headers: {
    "Content-Type": `multipart/form-data; boundary=${boundary}`
    // No Authorization header
  },
  body: multipartBody
});

console.log("[TEST] Calling submissions create function without auth");
const unauthResult = await createHandler(unauthRequest);

console.log(`[TEST] Unauth result status: ${unauthResult.status}`);
const unauthResultText = await unauthResult.text();
	console.log(`[TEST] Unauth result body: ${unauthResultText}`);

assertEquals(unauthResult.status, 401, "Should return 401 Unauthorized for missing auth");
const unauthResultBody = JSON.parse(unauthResultText);
assertEquals(unauthResultBody.error.code, "AUTH_MISSING_TOKEN", "Should return AUTH_MISSING_TOKEN error");

console.log("[TEST] Test 5 passed");

// Restore originals
console.log("[TEST] Restoring originals");
Deno.env.get = originalEnvGet;
if (originalFetch) {
  globalThis.fetch = originalFetch;
}
console.log("[TEST] Test completed successfully");