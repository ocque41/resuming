import { NextResponse } from "next/server";
import { verifyRecaptchaV3 } from "@/lib/captcha";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/actions";
import { getRecaptchaConfigStatus, isUsingTestKeys } from "@/lib/recaptcha/domain-check";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Debug endpoint for testing reCAPTCHA token verification
 * This endpoint should not be enabled in production environments
 */
export async function POST(request: Request) {
  try {
    // Get reCAPTCHA token from request body
    const body = await request.json();
    const { token, action } = body;
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: "Missing token",
        message: "No reCAPTCHA token provided in request"
      }, { status: 400 });
    }
    
    // Log configuration status
    const configStatus = getRecaptchaConfigStatus();
    
    // Check if token is valid
    const verificationStart = Date.now();
    const verificationResult = await verifyRecaptchaV3(
      token, 
      action || RECAPTCHA_ACTIONS.SIGNUP
    );
    const verificationTime = Date.now() - verificationStart;
    
    return NextResponse.json({
      success: verificationResult.success,
      score: verificationResult.score,
      action: verificationResult.action,
      timestamp: new Date().toISOString(),
      verification_time_ms: verificationTime,
      config_status: {
        ...configStatus,
        using_test_keys: isUsingTestKeys()
      },
      token_data: {
        provided: !!token,
        length: token?.length || 0,
        first_chars: token ? token.substring(0, 5) + "..." : ""
      }
    });
  } catch (error) {
    console.error("Error in reCAPTCHA test endpoint:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 