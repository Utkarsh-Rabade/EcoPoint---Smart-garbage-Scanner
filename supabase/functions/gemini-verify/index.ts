import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

interface VerificationResult {
  is_recyclable_item: boolean
  material: string
  item_type: string
  confidence: number
  contamination_detected: boolean
  reason: string
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
}

const createHandler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_MISSING_TOKEN",
            message: "Authorization header missing or invalid",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const accessToken = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Get the user from Supabase using the JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)

    if (userError || !user) {
      console.error("Get user error:", userError)
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_INVALID_TOKEN",
            message: "Invalid or expired token",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Parse JSON body
    const { submission_id } = await req.json()

    if (!submission_id) {
      return new Response(
        JSON.stringify({
          error: {
            code: "MISSING_SUBMISSION_ID",
            message: "submission_id is required",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Verify the user owns the pending submission
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submission_id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (submissionError || !submission) {
      console.error("Submission verification error:", submissionError)
      return new Response(
        JSON.stringify({
          error: {
            code: "SUBMISSION_NOT_FOUND_OR_NOT_PENDING",
            message: "Submission not found, not pending, or not owned by user",
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    // Download the private image from storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('submission-images')
      .download(submission.image_url)

    if (downloadError || !imageData) {
      console.error("Image download error:", downloadError)
      return new Response(
        JSON.stringify({
          error: {
            code: "IMAGE_DOWNLOAD_FAILED",
            message: "Failed to download image from storage",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Convert image data to base64
    const arrayBuffer = await imageData.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Prepare Gemini API request
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`

    const geminiRequest = {
      contents: [{
        parts: [
          {
            text: `Analyze this image for recycling verification. Determine if it shows a recyclable item, what material it's made of, what type of item it is, your confidence in the assessment, whether there's any contamination, and provide a brief reason.`
          },
          {
            inline_data: {
              mime_type: "image/jpeg", // Assuming JPEG, but we could detect from content type
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 10,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            is_recyclable_item: { type: "boolean" },
            material: { type: "string" },
            item_type: { type: "string" },
            confidence: { type: "number" },
            contamination_detected: { type: "boolean" },
            reason: { type: "string" }
          },
          required: [
            "is_recyclable_item",
            "material",
            "item_type",
            "confidence",
            "contamination_detected",
            "reason"
          ]
        }
      }
    }

    // Call Gemini API
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequest),
    })

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json()
      console.error("Gemini API error:", errorData)
      return new Response(
        JSON.stringify({
          error: {
            code: "GEMINI_API_ERROR",
            message: "Gemini API request failed",
            details: errorData,
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const geminiResult: GeminiResponse = await geminiResponse.json()

    // Extract the text response from Gemini (which should be a JSON string due to responseMimeType)
    let geminiText = ""
    if (geminiResult.candidates && geminiResult.candidates.length > 0) {
      const candidate = geminiResult.candidates[0]
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        geminiText = candidate.content.parts[0].text
      }
    }

    // Parse the JSON response from Gemini
    let verificationResult: VerificationResult
    try {
      verificationResult = JSON.parse(geminiText)

      // Validate the structure
      const requiredFields = ['is_recyclable_item', 'material', 'item_type', 'confidence', 'contamination_detected', 'reason']
      for (const field of requiredFields) {
        if (!(field in verificationResult)) {
          throw new Error(`Missing required field: ${field}`)
        }
      }

      // Ensure confidence is a number between 0 and 1
      if (typeof verificationResult.confidence !== 'number' ||
          verificationResult.confidence < 0 ||
          verificationResult.confidence > 1) {
        throw new Error("Confidence must be a number between 0 and 1")
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError, "Response:", geminiText)
      // Fallback verification result
      verificationResult = {
        is_recyclable_item: false,
        material: "unknown",
        item_type: "unknown",
        confidence: 0.0,
        contamination_detected: false,
        reason: "Failed to parse Gemini response"
      }
    }

    // Store the verification result in the submissions table
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        verification_result: verificationResult,
      })
      .eq('id', submission_id)

    if (updateError) {
      console.error("Database update error:", updateError)
      return new Response(
        JSON.stringify({
          error: {
            code: "DATABASE_UPDATE_FAILED",
            message: "Failed to store verification result",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Determine the new status based on the rules
    let newStatus = submission.status // Keep current status by default
    
    if (verificationResult.confidence >= 0.75 && 
        verificationResult.is_recyclable_item && 
        !verificationResult.contamination_detected) {
      newStatus = 'approved'
    } else if (verificationResult.confidence >= 0.50 && 
               verificationResult.is_recyclable_item) {
      newStatus = 'review'
    } else {
      newStatus = 'rejected'
    }

    // Update the submission status
    const { error: statusUpdateError } = await supabase
      .from('submissions')
      .update({
        status: newStatus,
      })
      .eq('id', submission_id)

    if (statusUpdateError) {
      console.error("Status update error:", statusUpdateError)
      return new Response(
        JSON.stringify({
          error: {
            code: "STATUS_UPDATE_FAILED",
            message: "Failed to update submission status",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // If status is approved, award points
    if (newStatus === 'approved') {
      try {
        // Call the award_points_for_submission function
        await supabase.rpc('award_points_for_submission', {
          p_submission_id: submission_id
        })
      } catch (awardError) {
        console.error("Error awarding points:", awardError)
        // Continue with the response even if points awarding fails
        // The submission is still approved, just points weren't awarded
      }
    }

    // Return the verification result
    return new Response(
      JSON.stringify({
        submission_id,
        verification_result: verificationResult,
        new_status: newStatus
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (err) {
    console.error("Unexpected error in gemini-verify function:", err)
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

serve(createHandler)

// Export the handler for testing
export default createHandler

if (import.meta.main) {
  serve(createHandler)
}
