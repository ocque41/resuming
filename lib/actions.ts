'use server';

import axios from 'axios';

/**
 * Verifies a reCAPTCHA token with Google's verification API
 * @param captchaToken The token from the reCAPTCHA widget
 * @returns Object containing success status and additional details
 */
export async function verifyCaptcha(captchaToken: string) {
  // Initial validation
  if (!captchaToken) {
    return {
      success: false,
      message: 'CAPTCHA token is required',
      errorCodes: ['missing-input-response']
    };
  }

  // Get the secret key from environment
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  
  if (!recaptchaSecret) {
    console.error("RECAPTCHA_SECRET_KEY is not configured");
    return {
      success: false,
      message: 'Server configuration error with reCAPTCHA',
      errorCodes: ['missing-input-secret']
    };
  }
  
  try {
    // Log key details for debugging (in a secure way)
    console.log("CAPTCHA token received:", !!captchaToken, "length:", captchaToken.length);
    console.log("RECAPTCHA_SECRET_KEY configured:", !!recaptchaSecret, "length:", recaptchaSecret.length);
    console.log("Host environment:", process.env.VERCEL_URL || process.env.NODE_ENV || "unknown");
    
    // Prepare verification request
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: recaptchaSecret,
      response: captchaToken
    });
    
    console.log("Making reCAPTCHA verification request");
    
    // Use axios with proper POST data format
    const response = await axios.post(verifyUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log("CAPTCHA verification response:", JSON.stringify(response.data));
    
    // Return verification result
    if (response.data.success) {
      return {
        success: true,
        message: 'CAPTCHA verified successfully',
        score: response.data.score,
        hostname: response.data.hostname,
        action: response.data.action,
        challengeTs: response.data.challenge_ts
      };
    } else {
      console.error("CAPTCHA verification failed:", response.data);
      return {
        success: false,
        message: 'CAPTCHA verification failed',
        errorCodes: response.data['error-codes'] || ['unknown-error'],
        details: response.data
      };
    }
  } catch (error) {
    console.error("CAPTCHA API request error:", error);
    return {
      success: false,
      message: 'Error processing CAPTCHA verification',
      error: error instanceof Error ? error.message : String(error)
    };
  }
} 