// Test to verify Deno.env.get override works
const originalEnvGet = Deno.env.get;
Deno.env.get = (key: string) => {
  if (key === "SUPABASE_URL") return "https://test.supabase.co";
  if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-role-key";
  return originalEnvGet?.call(Deno.env, key) ?? undefined;
};

console.log("SUPABASE_URL:", Deno.env.get("SUPABASE_URL"));
console.log("SUPABASE_SERVICE_ROLE_KEY:", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
console.log("NON_EXISTENT_KEY:", Deno.env.get("NON_EXISTENT_KEY"));