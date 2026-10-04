import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl            = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const geminiApiKey           = Deno.env.get("GEMINI_API_KEY")!
// Optional: shared secret for admin re-trigger via X-Admin-Secret header (server-side only)
const adminRetriggerSecret   = Deno.env.get("ADMIN_RETRIGGER_SECRET") ?? ""

// Service-role client — used for all DB/storage operations (bypasses RLS)
const adminDb = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
})

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
}

// ── Action types ──────────────────────────────────────────────────────────────
type ActionType =
  | "recycling"
  | "tree_planting"
  | "waste_segregation"
  | "litter_cleanup"
  | "composting"
  | "unknown"

const ACTION_POINTS: Record<ActionType, number> = {
  recycling:         10,
  waste_segregation: 10,
  composting:        15,
  litter_cleanup:    20,
  tree_planting:     30,
  unknown:            0,
}

// ── New generic verification contract ────────────────────────────────────────
interface VerificationResult {
  action_type:             ActionType
  action_detected:         boolean
  // Separately tracks whether any physical action (disposal, planting, etc.) was
  // observed, even if that action does not qualify as a supported EcoPoints action.
  // This enables accurate reasons: "physical action observed, but recycling not verified"
  // rather than the misleading "no action detected".
  physical_action_observed: boolean
  is_real_photo:           boolean
  is_ai_generated:         boolean
  confidence:              number   // 0.0 – 1.0
  item_type:               string
  material:                string
  evidence:                string
  reason:                  string
  contamination_detected:  boolean
  // Legacy compat: retained so old recycling history rows still parse correctly
  is_recyclable_item?:     boolean
}

// Minimal shape of a Gemini generateContent response
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
    finishReason?: string
  }>
  error?: { code?: number; message?: string; status?: string }
}

const createHandler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: { code: "AUTH_MISSING_TOKEN", message: "Authorization header missing" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const accessToken = authHeader.substring(7)

    const adminSecret      = req.headers.get("X-Admin-Secret")
    const isAdminRetrigger = adminRetriggerSecret.length > 0 && adminSecret === adminRetriggerSecret

    let userId: string | null = null

    if (!isAdminRetrigger) {
      const { data: { user }, error: userError } = await adminDb.auth.getUser(accessToken)
      if (userError || !user) {
        console.error("Auth error:", userError?.message)
        return new Response(
          JSON.stringify({ error: { code: "AUTH_INVALID_TOKEN", message: "Invalid or expired token" } }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      userId = user.id
    } else {
      console.log("Admin re-trigger mode: skipping user JWT validation")
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const { submission_id } = body
    // Optional hint from the submission UI — "recycling"|"tree_planting" etc.
    // Gemini makes the final call; this is passed in the prompt as context only.
    const hintedActionType: string = body.action_type_hint ?? "auto"

    if (!submission_id) {
      return new Response(
        JSON.stringify({ error: { code: "MISSING_SUBMISSION_ID", message: "submission_id is required" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ── Fetch submission ──────────────────────────────────────────────────────
    let subQuery = adminDb.from("submissions").select("*").eq("id", submission_id)
    if (userId) subQuery = subQuery.eq("user_id", userId)
    const { data: submission, error: subErr } = await subQuery.single()

    if (subErr || !submission) {
      console.error("Submission lookup:", subErr?.message)
      return new Response(
        JSON.stringify({ error: { code: "SUBMISSION_NOT_FOUND", message: "Submission not found or access denied" } }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Return early if already processed — idempotent
    if (submission.status !== "pending") {
      console.log(`Submission ${submission_id} is already ${submission.status}. Returning current state.`)
      return new Response(
        JSON.stringify({
          submission_id,
          verification_result: submission.verification_result,
          new_status: submission.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ── Download image from storage ───────────────────────────────────────────
    const { data: imageBlob, error: dlErr } = await adminDb.storage
      .from("submission-images")
      .download(submission.image_url)

    if (dlErr || !imageBlob) {
      console.error("Image download error:", dlErr?.message)
      return new Response(
        JSON.stringify({ error: { code: "IMAGE_DOWNLOAD_FAILED", message: "Failed to download image" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ── Base64-encode image ───────────────────────────────────────────────────
    const arrayBuffer = await imageBlob.arrayBuffer()
    const uint8       = new Uint8Array(arrayBuffer)
    let binary = ""
    const chunk = 8192
    for (let i = 0; i < uint8.length; i += chunk) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunk))
    }
    const base64Image = btoa(binary)

    const ext = submission.image_url.split(".").pop()?.toLowerCase() ?? "jpeg"
    const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }
    const mimeType = mimeMap[ext] ?? "image/jpeg"

    // ── Build action-hint context ─────────────────────────────────────────────
    const actionHintContext = hintedActionType !== "auto"
      ? `\nUSER-PROVIDED ACTION HINT: The user indicated this submission is for "${hintedActionType}". Use this as context when scanning the image, but your final classification must be based solely on what you can actually observe. Override this hint if the image clearly shows a different action.`
      : "\nUSER-PROVIDED ACTION HINT: None — determine the action type entirely from the image."

    // ── Gemini API call ───────────────────────────────────────────────────────
    console.log(`Calling Gemini for submission ${submission_id}: ${uint8.length} bytes, type=${mimeType}, hint=${hintedActionType}`)

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`

    const geminiBody = {
      contents: [{
        parts: [
          {
            text: `You are a strict environmental-action verification AI for the EcoPoints platform. A user submits a photo of an environmental action they claim to have performed. Your task is to evaluate the image and determine: (1) whether it is a genuine real photograph, (2) what environmental action — if any — is visually demonstrated, and (3) whether the action qualifies for EcoPoints.

You must evaluate ONLY what is visually present in the image itself. Do NOT rely on filenames, EXIF metadata, or user-provided text.${actionHintContext}

══════════════════════════════════════
STEP 1 — IMAGE AUTHENTICITY (evaluate FIRST — MANDATORY GATE)
══════════════════════════════════════

This step MUST be completed before any action evaluation.
If the image fails this gate, the submission CANNOT qualify for EcoPoints regardless of what the environmental action shows.

STEP 1A — AI-GENERATION WATERMARK & ATTRIBUTION INSPECTION

Scan the ENTIRE image surface — every pixel region — for visible evidence of AI generation:
  • ALL FOUR CORNERS (top-left, top-right, bottom-left, bottom-right)
  • Top edge, bottom edge, left border, right border
  • Any overlay text, badges, logos, or labels anywhere in the frame
  • Semi-transparent or faintly visible watermarks on any region
  • Small text in any font at any location in the image

SIZE DOES NOT MATTER: A watermark does NOT need to be large or dominant.
Even a small, clearly readable AI-generation attribution label is sufficient to mark the image as AI-generated.

HARD RULE — AI-GENERATION WATERMARK (ANY of these = is_ai_generated=true, is_real_photo=false):
  → Any recognizable AI image-generation platform name or logo, including but not limited to:
     Midjourney, DALL-E, DALL·E, Stable Diffusion, Adobe Firefly, Adobe GenAI,
     Ideogram, Leonardo AI, Leonardo.Ai, Bing Image Creator, Bing Create,
     Canva AI, Canva Text to Image, Runway ML, Runway, Imagen, Imagen 2,
     Gemini, Gemini Image, Google ImageFX, ImageFX, Flux, Flux.1,
     Nightcafe, DreamStudio, Artbreeder, Playground AI, SeaArt, Pika,
     or any other generative AI image tool.
  → Visible text reading (exactly or approximately):
     "AI generated", "Generated with AI", "Made with AI", "Created by AI",
     "AI image", "Generated image", "AI art", "Synthetically generated",
     "Created using [AI tool name]", "Powered by [AI tool name]",
     "Generated by [AI tool name]", or any equivalent phrasing.
  → Obvious generative-tool branding, synthetic-image attribution marks,
     generation-run identifiers, seed numbers presented as image attribution,
     or any label indicating the image was produced by a generative system.
  → Any UI element or interface fragment from an AI image generation tool
     (generation prompt boxes, style selectors, download buttons, tool navigation).

Do NOT treat these as AI-generation evidence:
  → A photographer's personal copyright mark or studio watermark (e.g. "© John Smith Photography").
  → Stock-photo agency watermarks (Getty, Shutterstock, etc.) — reject as non-original instead.
  → Ordinary company or product branding visible ON a photographed physical object.
  → Generic social media overlays, text captions, or stickers added post-capture.
  → High image quality, sharpness, bokeh/background blur, or professional lighting.
  → Polished colours or HDR processing alone.
  → Normal signage, labels, logos on objects in the scene.

STEP 1B — GENERATIVE ARTIFACT & SYNTHETIC CONTENT INSPECTION

Inspect for these signs that the image is NOT a genuine real-world photograph:
  • Generative artifacts: unnatural blurring, smearing, repeating patterns, hallucinated background elements.
  • Unrealistic geometry: impossible shapes, warped edges, physically inconsistent perspective.
  • Inconsistent hands or fingers: extra, missing, or morphologically wrong fingers.
  • Inconsistent or garbled text: labels, logos, or writing that appear digitally generated.
  • Impossible reflections or shadows.
  • Synthetic-looking textures: unnaturally smooth or plasticky surfaces that look rendered.
  • Illustrations, clip art, vector art, cartoons, diagrams, or digital paintings.

STEP 1C — SCREENSHOT & SCREEN-CAPTURE DETECTION (HARD RULE)

A screenshot or screen-capture is NOT a genuine real-world camera photograph.
It does not matter whether the screenshot was taken of an AI-generated image, a stock photo,
a website, or any other digital content. A screenshot is never valid EcoPoints evidence.

If the image is a screenshot or screen-capture of any kind:
  → Set is_real_photo=false
  → Do NOT continue to action evaluation

Screenshots can appear WITHOUT visible browser or OS chrome. You must detect them even when
the window frame, taskbar, or browser UI has been cropped out.

CHECK FOR THESE SCREENSHOT INDICATORS:

  HARD SIGNALS (any one of these alone is sufficient to flag as screenshot):
  → Visible browser elements: URL bar, browser tabs, browser navigation buttons
  → Visible OS / app chrome: window title bars, taskbar, dock, scrollbars, window borders
  → Any UI element from a web application, desktop application, or mobile app visible in the frame
  → Content that is clearly displayed ON a screen (e.g. a phone screen, monitor, tablet display)
    being shown within the image rather than photographed in a real-world context
  → Visible screen bezel or device frame surrounding image content
  → Prompt input boxes, style selector dropdowns, generation UI, or any AI-tool interface
    fragments (even partially visible at any edge)

  SOFT SIGNALS (two or more together are strong evidence of a screenshot):
  → Perfectly rectangular, pixel-perfect edges with no natural camera distortion, vignetting,
     or lens curvature whatsoever
  → 2D flatness throughout the entire image — no depth of field, no natural perspective
     variation, no foreground/background focus gradient that a real camera would produce
  → Unnaturally uniform pixel density across the entire frame with no natural film grain,
     sensor noise, or micro-texture that genuine camera sensors introduce
  → Moiré patterns, pixel grid, or banding artifacts visible at fine detail level
  → Image that appears to show content from a website, social media feed, gallery app,
     or image viewer rather than a real-world scene
  → Image composition that looks like a digital file being displayed rather than something
     captured in a physical environment
  → Content that is very clearly a rendered 3D scene, CGI, or digital artwork even without
     explicit AI watermarks

IMPORTANT — WHAT IS NOT A SCREENSHOT:
  → A genuine photo that happens to show a screen in the background (e.g. a TV in a room):
     this is a real photo containing a screen, not a screenshot itself.
  → A genuine photo with good focus and clean edges taken by a modern camera:
     good quality alone does not indicate a screenshot.
  → A photo with vivid colours, professional lighting, or HDR processing.

When uncertain between a high-quality photo and a screenshot, look for the physical world:
  → A genuine photo will show some indication of real-world depth, natural lighting variation,
     physical environment, or camera perspective that a flat screen-capture cannot replicate.
  → If none of these real-world cues are present, treat it as a screenshot.

SETTING AUTHENTICITY FIELDS:
  Set is_real_photo=true ONLY if the image is a genuine, unmanipulated real-world camera photograph.
  Set is_ai_generated=true if a watermark/attribution was found in Step 1A OR if clear generative artifacts were found in Step 1B.
  Set is_real_photo=false (even without setting is_ai_generated=true) if the image is a screenshot or screen-capture (Step 1C) OR if the image is synthetic for any other reason.
  If authenticity is genuinely uncertain, set is_real_photo=false to trigger conservative rejection.
  Do NOT mark as is_real_photo=false solely because the image is high quality or professionally shot.

AUTHENTICITY GATE — HARD STOP:
IF is_ai_generated=true OR is_real_photo=false:
  → Set action_detected=false
  → Set action_type="unknown"
  → Set confidence=0.1
  → Set reason to clearly explain the authenticity failure (see scenario B in Step 5).
  → Do NOT evaluate whether the environmental action appears valid.
  → Do NOT set action_detected=true even if the environmental action is clearly visible in the image.
  → STOP here. Do not proceed to Steps 2–4.

This is non-negotiable: a valid-looking recycling action, tree planting, or any other environmental action CANNOT override an authenticity failure.

══════════════════════════════════════
STEP 2 — PHYSICAL ACTION AND SUPPORTED ECOPOINTS ACTION
══════════════════════════════════════

(Only reached if Step 1 authenticity gate passed: is_real_photo=true AND is_ai_generated=false)

This step has TWO sub-parts that MUST be assessed independently:

  PART A — PHYSICAL ACTION OBSERVED?
  PART B — IS THAT PHYSICAL ACTION A SUPPORTED ECOPOINTS ACTION?

These are NOT the same question. A physical action being visible does NOT mean it qualifies
for EcoPoints. Both parts must be determined separately and reported in separate fields.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART A — PHYSICAL ACTION OBSERVED (physical_action_observed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Set physical_action_observed=true if ANY physical action by a person is visible, including:
  • An item being held, placed, dropped, or inserted into a container of any kind
  • A person picking up, gathering, or collecting objects
  • A person placing a plant, sapling, or seedling into soil
  • A person handling organic material near a bin or compost system
  • Any other hands-on interaction with an object in the scene

Set physical_action_observed=false ONLY when:
  • No person is interacting with any object
  • The image only shows objects, scenery, or an object being held statically
  • There is zero visible physical activity that could relate to an environmental action

IMPORTANT: physical_action_observed is about observable human activity, not about whether
that activity qualifies for EcoPoints. Fill this field honestly and independently.

Examples:
  Person drops a cup into a bin → physical_action_observed=true (disposal action is visible)
  Person holds a metal can but does nothing → physical_action_observed=false (no action, just holding)
  Person places sapling near a hole → physical_action_observed=true (planting gesture visible)
  Photo of a plant with no person → physical_action_observed=false
  Person picks up litter from ground → physical_action_observed=true

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART B — SUPPORTED ECOPOINTS ACTION VERIFIED (action_detected + action_type)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A physical action being visible is NECESSARY but NOT SUFFICIENT for EcoPoints.

The action must also:
  1. Match one of the supported EcoPoints action types below.
  2. Involve an eligible item/material for that action type.
  3. Be performed in the correct context (e.g. recycling into a clearly identified recycling stream).

Set action_detected=true ONLY when ALL of the following are true:
  • The physical action is visible (physical_action_observed=true)
  • The action clearly matches one of the supported types below
  • The item/material meets that action's eligibility requirements
  • The context is appropriate (e.g. recycling stream clearly identified)

Set action_detected=false in ALL other cases, including:
  • Physical action is visible but the item is not eligible
  • Physical action is visible but the bin/context is not a clearly identified qualifying stream
  • Physical action is visible but it matches an unsupported action type
  • No physical action is visible at all

SUPPORTED ECOPOINTS ACTION TYPES:

1. "recycling" — A physically supported recyclable item is being placed into, dropped into, or
   positioned immediately above a CLEARLY IDENTIFIED recycling container.
   The bin/container must be recognisably a recycling stream — it should have a visible
   recycling symbol, label, or colour coding that clearly identifies it as a recycling container.
   A generic, unlabelled, or ambiguous bin does NOT qualify as a recycling stream.
   Accepted recyclable items: PET/plastic bottles, glass bottles/jars, aluminium/steel cans,
   clean cardboard/paper/newspaper, Tetra Pak cartons, milk jugs, aerosol cans (empty),
   plastic tubs/containers, clean dry paper cups (no liquid residue, no wax/plastic lining visible).
   NOT recycling: pens, pencils, markers, electronics, disposable vapes, food waste, clothing,
   mixed-material composites, soiled/wet cups with visible liquid or food residue,
   plastic-only disposable cups with no paper component,
   or any item that does not belong to the accepted list.

2. "tree_planting" — A person is visibly planting a tree, sapling, or young plant into soil.
   The action must show an active planting gesture (placing a sapling into prepared soil, or
   holding a young plant next to/above a planting hole).
   NOT sufficient: a person standing near a tree or plant; a healthy established tree;
   a person holding a potted plant; a plant sitting on a surface.

3. "waste_segregation" — Waste material is visibly being placed into a DESIGNATED segregated
   waste collection container. This includes:
     • Organic/garden waste (leaves, food scraps) into a clearly labelled organic, green-waste,
       or composting collection container.
     • Dry/paper waste (paper cups, cardboard, paper) into a clearly labelled paper, dry-waste,
       or mixed-recyclables collection container that is separate from general mixed/wet waste.
   The container must be clearly labelled or recognisably designated for that specific waste stream.
   NOT sufficient: waste placed into an ordinary general-waste or mixed-waste bin;
   leaves being swept with no container; a compost pile without a dedicated container;
   an unlabelled bin of any colour.

4. "litter_cleanup" — A person is visibly collecting/removing litter or waste from a
   public/community area. The waste being collected and the collection action must both be visible.
   NOT sufficient: litter visible on the ground with a person merely standing nearby;
   a clean area with no litter being collected.

5. "composting" — Suitable organic material (food scraps, vegetable waste, coffee grounds, etc.)
   is visibly being placed into a clearly recognisable composting bin, tumbler, or compost system.
   The composting system must be clearly identifiable as such.

6. "unknown" — No supported EcoPoints action is clearly demonstrated.

KEY DISTINCTIONS — PHYSICAL ACTION vs. SUPPORTED ACTION:

  A person discarding a dry/empty paper cup into a clearly labelled recycling or paper-waste bin:
    → physical_action_observed=true (disposal action visible)
    → action_type="recycling" or "waste_segregation" depending on the stream's label
    → action_detected=true (paper cup is eligible; stream is clearly identified)

  A person discarding a paper cup (with visible liquid remaining) into any bin:
    → physical_action_observed=true
    → action_type="recycling" (cup-related)
    → action_detected=false (contamination: liquid residue makes it ineligible)

  A person discarding a paper cup into a generic unlabelled green outdoor bin:
    → physical_action_observed=true (disposal action visible)
    → action_type="recycling" (cup-related)
    → action_detected=false (bin is not clearly identified as a designated stream)

  A person holding a metal can without placing it anywhere:
    → physical_action_observed=false (no disposal action — just holding)
    → action_type="recycling" (correct item type, even if action not performed)
    → action_detected=false (recycling action itself not demonstrated)

  A person placing a metal can into a bin with no visible recycling marking:
    → physical_action_observed=true (disposal action visible)
    → action_type="recycling" (correct item type)
    → action_detected=false (bin not clearly identified as recycling stream)

  A person placing a metal can into a clearly labelled recycling bin:
    → physical_action_observed=true
    → action_type="recycling"
    → action_detected=true (ONLY if the can is eligible and the stream is clearly identified)

  A person showing a potted sapling without planting it:
    → physical_action_observed=false (no planting action)
    → action_type="tree_planting" (correct item type)
    → action_detected=false (planting action not demonstrated)

CRITICAL RULES:

DO NOT set action_detected=true based solely on:
  • A bin or container (without the action of placing something into it)
  • A plant or tree (without an active planting gesture into soil)
  • Plastic, leaves, litter (without the action of collecting or placing them)
  • A person outdoors
  • Outdoor scenery, soil, or nature

DO NOT set action_detected=true when the bin/container is generic or ambiguous:
  • A green outdoor bin with no recycling marking → NOT a recycling stream
  • An unlabelled bin of any colour → NOT a recycling stream
  • A standard household dustbin → NOT a recycling stream
  Only a bin with a visible recycling symbol, "Recycle" label, or clear colour-coded
  recycling designation qualifies.

ANTI-HALLUCINATION RULE — SHAPE IS NOT IDENTITY:
Before assigning a specific item_type for recycling:
  Q1. What physical object is actually visible?
  Q2. What concrete visual evidence supports that specific identification?
  Q3. Does that evidence distinguish this object from similar-shaped objects?

Do NOT classify an object based on shape alone:
  • A cylindrical plastic object is NOT automatically a bottle, a vape, or a pen.
  • A thin cylinder held in a hand is NOT automatically any specific product.
  Require product-specific evidence (label, branding, cap type, form factor, etc.).

PEN / WRITING INSTRUMENT RULE:
Ordinary pens, pencils, markers, and highlighters are NOT accepted for EcoPoints.
If you identify a writing instrument: action_type="unknown", action_detected=false.

DISPOSABLE VAPE RULE:
Do NOT classify as a vape unless you see vape-specific features (mouthpiece, airflow vents,
device branding, charging port, LED indicator). A generic cylinder is NOT a vape.
Disposable vapes are NOT accepted for EcoPoints even if correctly identified.

PAPER CUP / SINGLE-USE PAPER ITEM RULE:
Paper cups and single-use paper items may qualify for EcoPoints — but ONLY when:
  1. The cup/item appears to be DRY and EMPTY (no visible liquid residue or food contamination).
  2. The destination is a CLEARLY IDENTIFIED recycling, paper-waste, or dry-waste segregation
     stream (visible label or designated marking — not a generic bin).

If BOTH conditions are met:
  → Treat as eligible: use action_type="recycling" (if recycling stream) or
    action_type="waste_segregation" (if paper/dry-waste segregation stream).
  → action_detected=true if the disposal action is clearly visible.

If EITHER condition fails:
  → action_detected=false.
  → Reason must specify WHICH condition failed:
    - If bin is unlabelled/generic: "The disposal action is visible but the bin is not clearly
      identified as a designated paper or recycling stream. Show the item being placed into a
      bin with a visible label or recycling symbol."
    - If cup has visible liquid/food residue: "The paper cup appears to contain liquid or food
      residue. Empty and dry cups placed into a clearly identified stream can qualify for EcoPoints."

DISPOSABLE PLASTIC CUP RULE (no paper component):
Pure plastic disposable cups (transparent/coloured plastic, no paper body) are NOT accepted
for EcoPoints recycling. If identified: action_detected=false.

══════════════════════════════════════
STEP 3 — RECYCLABILITY GATE (for recycling actions only)
══════════════════════════════════════

If action_type="recycling", apply these rules INDEPENDENTLY after identifying the object:

ACCEPTED for EcoPoints recycling:
  • Rigid plastic containers/bottles (PET, HDPE, PP) — clean and empty
  • Glass bottles or jars — clean
  • Aluminium or steel cans — empty
  • Clean cardboard / paper / newspaper
  • Tetra Pak cartons (empty)
  • Milk jugs, aerosol cans (empty), plastic tubs
  • Clean dry paper cups — empty with no visible liquid or food residue

NOT ACCEPTED for EcoPoints recycling:
  • Pens, pencils, markers, highlighters, felt-tips
  • Electronic devices: phones, remotes, cables, earphones, chargers, batteries
  • Food waste, organic matter, liquids
  • Clothing, textiles, footwear
  • Multi-material composite objects
  • Disposable vapes / e-cigarettes
  • Pure plastic disposable cups (no paper component)
  • Any paper cup or container with visible liquid or food residue (contaminated)
  • Any unidentifiable or generic plastic object

DO NOT set action_detected=true for recycling merely because:
  • The object is made of plastic
  • The object is near a recycling bin
  • The object is clean or man-made
  The OBJECT TYPE must match the accepted list above.

══════════════════════════════════════
STEP 4 — CONFIDENCE ASSESSMENT
══════════════════════════════════════

Confidence bands:
  0.80–1.00 → Action is unambiguously clear with strong visual evidence (object clearly identified, action gesture clear).
  0.60–0.79 → Action is visible but partially occluded, or object material is somewhat uncertain.
  0.40–0.59 → Action is plausible from context but not definitively confirmed from the image.
  0.10–0.39 → Action cannot be established; no supported environmental action is visible.

Shape similarity to a known object does NOT justify high confidence without product-specific visual evidence.

══════════════════════════════════════
STEP 5 — POPULATE FIELDS
══════════════════════════════════════

• action_type: one of "recycling", "tree_planting", "waste_segregation", "litter_cleanup", "composting", "unknown".
• action_detected: true ONLY when the supported EcoPoints action is clearly verified — physical action visible, item eligible, context appropriate, AND authenticity passed. false in all other cases.
• physical_action_observed: true if any physical action by a person is visible in the image (placing, dropping, collecting, planting, etc.), regardless of whether it qualifies for EcoPoints. false if no physical action is visible.
• is_real_photo: true if the image appears to be a genuine real photograph.
• is_ai_generated: true if AI-generation watermark/attribution found or clear generative artifacts detected.
• confidence: decimal 0.0–1.0. NOT a percentage. Must reflect only what you can actually observe.
• item_type: for recycling, the specific item (e.g. "water bottle", "cola can", "cereal box"). For other actions, describe what is visible (e.g. "sapling", "tree", "litter pile", "leaves", "food scraps"). Use empty string "" when not applicable.
• material: for recycling, the material (e.g. "PET plastic", "glass", "aluminium"). For other actions, use empty string "" when not applicable.
• evidence: a factual 1–2 sentence description of what is physically visible in the image. This must describe only what you can actually see.
  Examples:
    "A person's hand is holding a clear plastic bottle above a blue recycling bin."
    "A small sapling is being placed into a freshly dug hole in the soil."
    "Leaves and garden waste are being poured into a green organics bin."
    "A person is collecting plastic waste from a public area."
    "A person is dropping a disposable plastic cup into a green outdoor bin."
    "A person is holding a metal can without placing it into any container."
• contamination_detected: true if a recycling item has visible food residue, liquid, or contamination. false for all non-recycling actions and for clean items.
• reason: Write 1–3 plain-English sentences shown directly to the user. Do NOT mention internal terms (threshold, schema, API, prompt, model, JSON). Do NOT invent visual evidence. Do NOT make environmental claims beyond EcoPoints eligibility. Follow these scenario rules:

  A) Action accepted (action_detected=true):
     State what action was detected, what object/material was identified, and confirm it earns EcoPoints.
     Example: "A PET plastic water bottle is clearly visible being placed into a recycling bin, so this submission qualifies for EcoPoints."

  B) Rejected — AI-generated or fake image:
     State the image is not a genuine real photograph and cannot be accepted. Do not accuse the user of intentional cheating.
     Example: "The submitted image shows signs of AI generation, including a visible AI-generation attribution, so it cannot be accepted as photographic evidence. Please submit a genuine real-world photograph."
     Example: "This image appears to be AI-generated or synthetically produced, so it cannot be used as proof of the environmental action. Please take and submit a real photo."

  C) Rejected — item identified but not eligible (item not accepted, action not performed, or destination unclear):
     State what was identified and why it does not qualify. Do NOT say it is bad for the environment.
     Do NOT make blanket claims that a paper item is universally non-recyclable.
     Example (item present, no action): "A metal can is visible, but the image does not show it being placed into a designated recycling stream. Holding or displaying the item alone is not sufficient for EcoPoints."
     Example (paper cup, generic bin): "A paper cup is visible being placed into a bin, but the bin is not clearly identified as a designated recycling or paper-waste stream. Show the item being placed into a bin with a visible label or recycling symbol."
     Example (paper cup, contaminated): "The paper cup appears to contain liquid or food residue. Empty and dry paper cups placed into a clearly identified stream can qualify for EcoPoints."
     Example (generic bin — general): "A physical disposal action is visible, but the bin is not clearly identified as a designated recycling stream. Show the item being placed into a bin with a visible recycling symbol or label."

  D) Rejected — physical action visible but not a supported EcoPoints action:
     Acknowledge what physical action was observed and clearly explain that it does not meet EcoPoints criteria.
     Do NOT say "no action detected" if a physical action is clearly visible.
     Example: "A disposal action is visible — an item is being placed into a bin — but this does not establish a supported EcoPoints recycling action. The bin is not clearly identified as a designated recycling stream, or the item is not eligible for EcoPoints recycling."
     Example: "The image shows an item being discarded, but the item and the container shown do not meet the requirements for any supported EcoPoints action."

  E) Rejected — no physical action visible:
     Describe what is visible (object, person, etc.) and explain that no environmental action could be confirmed.
     Do NOT imply an action occurred when none is visible.
     Example: "A metal can is visible but no recycling action is demonstrated. Show the item actively being placed into a designated recycling bin to qualify for EcoPoints."
     Example: "The image shows a sapling or plant but does not show it being planted. Capture the planting action itself to qualify for tree-planting EcoPoints."

  F) Rejected — contamination detected:
     Identify the item and describe the contamination issue.
     Example: "A plastic container was identified, but it appears to contain food residue. Please ensure items are clean before submitting."

  G) Flagged for review — moderate confidence:
     Confirm what appears to be visible but note that the image quality or angle prevents automatic approval.
     Example: "This appears to show a recycling action, but the image quality makes it difficult to verify automatically. This submission has been sent for manual review."`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data:     base64Image,
            }
          }
        ]
      }],
      generationConfig: {
        temperature:      0.1,
        topP:             0.8,
        maxOutputTokens:  800,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            action_type:              { type: "STRING" },
            action_detected:          { type: "BOOLEAN" },
            physical_action_observed: { type: "BOOLEAN" },
            is_real_photo:            { type: "BOOLEAN" },
            is_ai_generated:          { type: "BOOLEAN" },
            confidence:               { type: "NUMBER" },
            item_type:                { type: "STRING" },
            material:                 { type: "STRING" },
            evidence:                 { type: "STRING" },
            reason:                   { type: "STRING" },
            contamination_detected:   { type: "BOOLEAN" },
          },
          required: [
            "action_type", "action_detected", "physical_action_observed",
            "is_real_photo", "is_ai_generated",
            "confidence", "item_type", "material", "evidence", "reason", "contamination_detected",
          ],
        },
      },
    }

    // ── Gemini fetch with bounded exponential-backoff retry ───────────────────
    const RETRYABLE_STATUSES = new Set([429, 500, 503])
    const RETRY_DELAYS_MS    = [1_000, 3_000]
    const MAX_ATTEMPTS       = 3

    let geminiHttpResp: Response = new Response("{}", { status: 503 })
    let geminiRaw: GeminiResponse = {}
    let lastFetchErr: unknown = null
    let attemptCount = 0

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      attemptCount = attempt + 1

      const geminiAbort = new AbortController()
      const geminiTimer = setTimeout(() => geminiAbort.abort(), 90_000)

      try {
        geminiHttpResp = await fetch(geminiUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(geminiBody),
          signal:  geminiAbort.signal,
        })
        clearTimeout(geminiTimer)
        geminiRaw = await geminiHttpResp.json() as GeminiResponse
        lastFetchErr = null
      } catch (fetchErr) {
        clearTimeout(geminiTimer)
        lastFetchErr = fetchErr
        const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError"
        console.error(`Gemini attempt ${attemptCount} ${isTimeout ? "timed out" : "network error"}:`, fetchErr)
        break
      }

      if (geminiHttpResp.ok) {
        if (attemptCount > 1) console.log(`Gemini succeeded on attempt ${attemptCount}`)
        break
      }

      if (!RETRYABLE_STATUSES.has(geminiHttpResp.status)) {
        console.error(`Gemini attempt ${attemptCount}: non-retryable HTTP ${geminiHttpResp.status}`)
        break
      }

      const errMsg = geminiRaw?.error?.message ?? `HTTP ${geminiHttpResp.status}`
      console.warn(`Gemini attempt ${attemptCount} failed (${geminiHttpResp.status}: ${errMsg})`)

      if (attempt < MAX_ATTEMPTS - 1) {
        const delayMs = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
        console.log(`Retrying in ${delayMs} ms …`)
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
      }
    }

    // ── Handle final fetch error ──────────────────────────────────────────────
    if (lastFetchErr !== null) {
      const isTimeout = lastFetchErr instanceof Error && lastFetchErr.name === "AbortError"
      const reason = isTimeout
        ? "Gemini request timed out (>90 s) — submission left pending for retry"
        : `Gemini network error: ${lastFetchErr instanceof Error ? lastFetchErr.message : String(lastFetchErr)}`
      await adminDb.from("submissions")
        .update({ verification_result: { reason, confidence: 0 } })
        .eq("id", submission_id)
      return new Response(
        JSON.stringify({ error: { code: isTimeout ? "GEMINI_TIMEOUT" : "GEMINI_NETWORK_ERROR", message: reason } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ── Handle persistent HTTP-level error ────────────────────────────────────
    if (!geminiHttpResp.ok) {
      const errMsg = geminiRaw?.error?.message ?? `Gemini HTTP ${geminiHttpResp.status}`
      const retriedNote = attemptCount > 1 ? ` (after ${attemptCount} attempts)` : ""
      console.error(`Gemini API HTTP ${geminiHttpResp.status}${retriedNote}:`, JSON.stringify(geminiRaw))
      await adminDb.from("submissions")
        .update({ verification_result: { reason: `Gemini API error (${geminiHttpResp.status})${retriedNote}: ${errMsg} — will retry`, confidence: 0 } })
        .eq("id", submission_id)
      return new Response(
        JSON.stringify({ error: { code: "GEMINI_API_ERROR", message: `Gemini API responded with ${geminiHttpResp.status}${retriedNote}: ${errMsg}` } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ── Parse Gemini response ─────────────────────────────────────────────────
    const rawText = geminiRaw?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    console.log("Gemini raw response text:", rawText.substring(0, 500))

    let verificationResult: VerificationResult
    try {
      if (!rawText) throw new Error("Empty response text from Gemini")

      const parsed = JSON.parse(rawText)

      const required = [
        "action_type", "action_detected", "physical_action_observed",
        "is_real_photo", "is_ai_generated",
        "confidence", "item_type", "material", "evidence", "reason", "contamination_detected",
      ]
      for (const f of required) {
        if (!(f in parsed)) throw new Error(`Missing required field: ${f}`)
      }

      // Normalise confidence
      let confidence = Number(parsed.confidence)
      if (!isFinite(confidence)) throw new Error("confidence is not a finite number")
      if (confidence > 1) confidence = confidence / 100
      confidence = Math.max(0, Math.min(1, confidence))

      // Normalise action_type — ensure it's a valid value
      const VALID_ACTIONS: ActionType[] = [
        "recycling", "tree_planting", "waste_segregation",
        "litter_cleanup", "composting", "unknown",
      ]
      const rawAction = String(parsed.action_type ?? "unknown").toLowerCase().trim() as ActionType
      const actionType: ActionType = VALID_ACTIONS.includes(rawAction) ? rawAction : "unknown"

      verificationResult = {
        action_type:              actionType,
        action_detected:          Boolean(parsed.action_detected),
        physical_action_observed: Boolean(parsed.physical_action_observed),
        is_real_photo:            Boolean(parsed.is_real_photo),
        is_ai_generated:          Boolean(parsed.is_ai_generated),
        confidence,
        item_type:                String(parsed.item_type ?? ""),
        material:                 String(parsed.material ?? ""),
        evidence:                 String(parsed.evidence ?? ""),
        reason:                   String(parsed.reason),
        contamination_detected:   Boolean(parsed.contamination_detected),
        // Legacy compat for history rows and frontend that reads is_recyclable_item
        is_recyclable_item:       actionType === "recycling" && Boolean(parsed.action_detected),
      }
    } catch (parseErr) {
      const reason = `Gemini returned unparseable response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      console.error("Gemini parse error:", parseErr, "raw:", rawText)
      await adminDb.from("submissions")
        .update({ verification_result: { reason, confidence: 0 } })
        .eq("id", submission_id)
      return new Response(
        JSON.stringify({ error: { code: "GEMINI_PARSE_ERROR", message: reason } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("Gemini verification result:", JSON.stringify(verificationResult))

    // ── AUTHENTICITY GATE (backend enforcement — belt-and-suspenders) ─────────
    // Log the authenticity decision regardless of what the model returned.
    // This fires before any action-based branching so action success can NEVER
    // silently bypass the authenticity check.
    const authenticityFailed = !verificationResult.is_real_photo || verificationResult.is_ai_generated
    console.log(
      `[AUTHENTICITY] is_real_photo=${verificationResult.is_real_photo}`,
      `is_ai_generated=${verificationResult.is_ai_generated}`,
      `gate_failed=${authenticityFailed}`,
    )
    // Safety override: if the model somehow set action_detected=true while also
    // flagging authenticity failure, force action_detected=false and
    // physical_action_observed=false here so the downstream status logic
    // cannot accidentally approve the submission.
    if (authenticityFailed && verificationResult.action_detected) {
      console.warn(
        `[AUTHENTICITY OVERRIDE] action_detected was true but authenticity failed — forcing action_detected=false`,
        `(is_real_photo=${verificationResult.is_real_photo}, is_ai_generated=${verificationResult.is_ai_generated})`,
      )
      verificationResult.action_detected = false
      verificationResult.physical_action_observed = false
    }

    // ── Determine final status ────────────────────────────────────────────────
    let newStatus: string

    if (authenticityFailed) {
      // Hard reject — fake/AI image. Authenticity gate takes absolute priority.
      newStatus = "rejected"
      // Ensure the stored reason clearly explains the authenticity failure.
      if (verificationResult.is_ai_generated) {
        verificationResult.reason =
          "The submitted image shows signs of AI generation or contains a visible AI-generation attribution, " +
          "so it cannot be accepted as photographic evidence. Please submit a genuine real-world photograph."
      } else {
        verificationResult.reason =
          "The submitted image does not appear to be a genuine real-world photograph and cannot be accepted. " +
          "Please submit an authentic photo taken with your camera."
      }
      console.log(
        `[AUTHENTICITY GATE TRIGGERED] submission=${submission_id}`,
        `reason=${verificationResult.reason}`,
      )

    } else if (
      verificationResult.action_type === "unknown" ||
      !verificationResult.action_detected
    ) {
      // No supported EcoPoints action verified.
      newStatus = "rejected"
      // If the model provided a poor generic reason, produce a more accurate backend override
      // that distinguishes whether a physical action was observed or not.
      const hasReason = verificationResult.reason && verificationResult.reason.length > 10
      if (!hasReason) {
        if (verificationResult.physical_action_observed) {
          verificationResult.reason =
            "A physical action is visible in the image, but it does not establish a supported EcoPoints action. " +
            "Ensure the item is eligible and is being placed into a clearly identified qualifying stream."
        } else {
          verificationResult.reason =
            "No supported environmental action could be confirmed from this image. " +
            "Please submit a clear photo showing the action being actively performed."
        }
      }
      console.log(
        `[ACTION NOT VERIFIED] physical_action_observed=${verificationResult.physical_action_observed}`,
        `action_type=${verificationResult.action_type}`,
      )

    } else if (verificationResult.action_type === "recycling") {
      // Recycling: keep existing confidence thresholds
      if (
        verificationResult.confidence >= 0.75 &&
        !verificationResult.contamination_detected
      ) {
        newStatus = "approved"
      } else if (verificationResult.confidence >= 0.50) {
        newStatus = "review"
      } else {
        newStatus = "rejected"
      }

    } else {
      // New environmental actions — conservative: use review for borderline, approve for high confidence
      if (verificationResult.confidence >= 0.75) {
        newStatus = "approved"
      } else if (verificationResult.confidence >= 0.50) {
        newStatus = "review"  // human reviewer confirms new action types
      } else {
        newStatus = "rejected"
      }
    }

    // ── Final decision log ────────────────────────────────────────────────────
    console.log(
      `[DECISION] submission=${submission_id}`,
      `action=${verificationResult.action_type}`,
      `action_detected=${verificationResult.action_detected}`,
      `status=pending→${newStatus}`,
    )

    // ── Calculate points for this action ─────────────────────────────────────
    // Safety: points are ONLY awarded when newStatus === "approved".
    // Authenticity failure always produces newStatus="rejected" so pointsToAward=0.
    const pointsToAward = newStatus === "approved"
      ? (ACTION_POINTS[verificationResult.action_type] ?? 10)
      : 0
    console.log(`[POINTS] pointsToAward=${pointsToAward} (status=${newStatus})`)

    // ── Persist result + status + points_awarded (single atomic update) ───────
    const { error: updateErr } = await adminDb
      .from("submissions")
      .update({
        verification_result: verificationResult,
        status:              newStatus,
        points_awarded:      pointsToAward,
      })
      .eq("id", submission_id)

    if (updateErr) {
      console.error("DB update error:", updateErr?.message)
      return new Response(
        JSON.stringify({ error: { code: "DATABASE_UPDATE_FAILED", message: "Failed to store verification result" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // ── Award points if approved (idempotent RPC) ─────────────────────────────
    if (newStatus === "approved") {
      const { error: rpcErr } = await adminDb.rpc("award_points_for_submission", {
        p_submission_id: submission_id,
      })
      if (rpcErr) {
        console.error("award_points_for_submission error:", rpcErr?.message)
      } else {
        console.log(`${pointsToAward} pts awarded for ${verificationResult.action_type} submission ${submission_id}`)
      }
    }

    return new Response(
      JSON.stringify({
        submission_id,
        verification_result: verificationResult,
        new_status: newStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Unexpected error in gemini-verify:", err)
    return new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
}

serve(createHandler)
export default createHandler
if (import.meta.main) { serve(createHandler) }
