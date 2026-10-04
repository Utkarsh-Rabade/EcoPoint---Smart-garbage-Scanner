#!/usr/bin/env node
/**
 * Full E2E test: upload real image → submissions function → gemini-verify → points
 */
import fs from "fs";

// Credentials are read from the environment — never hardcode them.
// Run with: node --env-file=.env.local smoke-test.mjs
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY      = process.env.SUPABASE_ANON_KEY;
const EMAIL         = process.env.SMOKE_TEST_EMAIL;
const PASSWORD      = process.env.SMOKE_TEST_PASSWORD;

{
  const missing = Object.entries({
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, SUPABASE_ANON_KEY: ANON_KEY,
    SMOKE_TEST_EMAIL: EMAIL, SMOKE_TEST_PASSWORD: PASSWORD,
  }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
}
const IMAGE_PATH    = "/Users/utkarshrabade/.gemini/antigravity-ide/brain/e55b1225-2d93-40c0-a018-b9dbaf3f8438/test_recyclable_bottle_1790608509083.jpg";

async function main() {
  // ── 1. Login ──────────────────────────────────────────────────────────────
  console.log("\n── 1. Login ──");
  const loginR = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const login = await loginR.json();
  if (!loginR.ok) { console.error("Login failed:", login); process.exit(1); }
  const token = login.access_token;
  console.log("✓ Logged in as:", login.user?.email);

  // Get initial points
  const profBefore = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=total_points&id=eq.${login.user.id}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  ).then(r => r.json());
  const pointsBefore = profBefore[0]?.total_points ?? 0;
  console.log("Points before:", pointsBefore);

  // ── 2. Upload real image via submissions function ──────────────────────────
  console.log("\n── 2. Uploading real bottle image via /submissions ──");
  const imageBytes = fs.readFileSync(IMAGE_PATH);
  console.log(`Image size: ${imageBytes.length} bytes, first bytes: ${imageBytes.slice(0,4).toString('hex')}`);

  const boundary = "----EcoPointsE2ETest" + Date.now();
  const parts = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="bottle.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    imageBytes,
    Buffer.from(`\r\n--${boundary}--`),
  ];
  const multipartBody = Buffer.concat(parts);

  const subR = await fetch(`${SUPABASE_URL}/functions/v1/submissions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  const subText = await subR.text();
  let subBody;
  try { subBody = JSON.parse(subText); } catch { subBody = subText; }
  console.log("Submissions HTTP:", subR.status);
  console.log("Submissions response:", JSON.stringify(subBody, null, 2));

  if (!subR.ok || !subBody?.id) {
    console.error("✗ Submission creation failed");
    process.exit(1);
  }
  const submissionId = subBody.id;
  console.log(`✓ Submission created: ${submissionId}, status=${subBody.status}`);

  // ── 3. Wait for fire-and-forget verification to run ───────────────────────
  console.log("\n── 3. Waiting 15s for background verification to complete ──");
  await new Promise(r => setTimeout(r, 15000));

  // ── 4. Check result ───────────────────────────────────────────────────────
  console.log("\n── 4. Checking submission state ──");
  const checkR = await fetch(
    `${SUPABASE_URL}/rest/v1/submissions?select=id,status,verification_result,points_awarded&id=eq.${submissionId}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const check = await checkR.json();
  const sub = check[0];
  console.log("Submission:", JSON.stringify(sub, null, 2));

  // ── 5. Check points ───────────────────────────────────────────────────────
  const profAfter = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=total_points&id=eq.${login.user.id}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  ).then(r => r.json());
  const pointsAfter = profAfter[0]?.total_points ?? 0;
  console.log("Points after:", pointsAfter, `(delta: +${pointsAfter - pointsBefore})`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const vr = sub?.verification_result;
  console.log("\n═══════════════════════════════════════");
  console.log(`IMAGE UPLOAD (binary-safe): ${subR.ok ? "PASS" : "FAIL"}`);
  console.log(`VERIFICATION TRIGGERED:    ${sub?.status !== "pending" ? "PASS" : "FAIL (still pending)"}`);
  console.log(`STATUS:                    ${sub?.status}`);
  console.log(`IS RECYCLABLE:             ${vr?.is_recyclable_item}`);
  console.log(`IS REAL PHOTO:             ${vr?.is_real_photo}`);
  console.log(`IS AI GENERATED:           ${vr?.is_ai_generated}`);
  console.log(`CONFIDENCE:                ${vr?.confidence}`);
  console.log(`MATERIAL:                  ${vr?.material}`);
  console.log(`REASON:                    ${vr?.reason}`);
  console.log(`POINTS AWARDED:            ${sub?.points_awarded} (profile delta: +${pointsAfter - pointsBefore})`);
  const pointsOk = sub?.status === "approved" 
    ? (pointsAfter - pointsBefore) > 0
    : sub?.status === "rejected" || sub?.status === "review";
  console.log(`POINTS CORRECT:            ${pointsOk ? "PASS" : "FAIL"}`);
  console.log("═══════════════════════════════════════");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
