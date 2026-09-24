console.log("Testing fetch mock");

// Store original fetch
const originalFetch = globalThis.fetch;
console.log(`Original fetch type: ${typeof originalFetch}`);

// Mock fetch
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  console.log(`Fetch called with: ${typeof input === 'string' ? input : input.toString()}`);
  return new Response(JSON.stringify({ mock: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
};

console.log(`Mock fetch type: ${typeof globalThis.fetch}`);

// Test the fetch
try {
  const response = await fetch("https://example.com/test");
  const data = await response.json();
  console.log(`Fetch result: ${JSON.stringify(data)}`);
} catch (error) {
  console.log(`Fetch error: ${error}`);
}

// Restore original fetch
globalThis.fetch = originalFetch;
console.log(`Restored fetch type: ${typeof globalThis.fetch}`);