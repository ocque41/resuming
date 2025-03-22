import axios from 'axios';

type VerificationResult = {
  success: boolean;
  message: string;
  score?: number;
  action?: string;
  details?: any;
};

// Google's test keys that will always pass verification
// Used to check if someone is using test keys in production
const TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

/**
 * Verifies a reCAPTCHA token with Google's verification API
 * Supports both reCAPTCHA v2 and v3
 * 
 * @param captchaToken The token from the reCAPTCHA client-side component
 * @param minScore Minimum score to accept for reCAPTCHA v3 (0.0 to 1.0)
 * @returns Result object with success status, message, and details
 */
export async function verifyCaptcha(
  captchaToken: string | null | undefined,
  minScore: number = 0.5
): Promise<VerificationResult> {
  // Return error if no token
  if (!captchaToken) {
    console.warn('verifyCaptcha: No token provided');
    return {
      success: false,
      message: 'CAPTCHA verification failed: No verification token provided'
    };
  }

  // Get the reCAPTCHA secret key from environment
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  if (!secretKey) {
    console.error('verifyCaptcha: No secret key in environment variables');
    return {
      success: false,
      message: 'CAPTCHA verification failed: Server configuration error'
    };
  }

  // Log token information for debugging (partial to avoid logging full token)
  console.log(`verifyCaptcha: Verifying token (first 10 chars: ${captchaToken.substring(0, 10)}..., length: ${captchaToken.length})`);
  
  // Check if we're using Google's test keys (which always pass verification)
  const isUsingTestKey = secretKey === TEST_SECRET_KEY;
  if (isUsingTestKey) {
    console.warn('verifyCaptcha: Using Google test keys - these should not be used in production!');
    // With test keys, we'll return success but with a warning
    return {
      success: true,
      message: 'CAPTCHA verification successful (using test keys)',
      score: 1.0, // Test key always returns high score
      action: 'test',
      details: { hostname: 'testkey.google.com', challenge_ts: new Date().toISOString() }
    };
  }

  try {
    // Prepare request for Google's verification API
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', captchaToken);
    
    // Get the client's IP if available - but this usually won't work on the server
    // Only try in client environments
    if (typeof window !== 'undefined') {
      try {
        const request = await fetch('https://api.ipify.org/?format=json');
        const data = await request.json();
        if (data.ip) {
          params.append('remoteip', data.ip);
        }
      } catch (error) {
        console.warn('verifyCaptcha: Failed to get client IP', error);
        // Proceed without IP - this is optional anyway
      }
    }

    // Send verification request to Google
    console.log('verifyCaptcha: Sending verification request to Google');
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 5000 // 5 second timeout to avoid hanging requests
      }
    );

    const data = response.data;
    console.log('reCAPTCHA verification response:', data);

    // If verification failed
    if (!data.success) {
      const errorCodes = data['error-codes'] || [];
      console.error('verifyCaptcha: Verification failed with error codes:', errorCodes);
      
      // Handle specific error codes with more helpful messages
      let errorMessage = 'CAPTCHA verification failed: Unknown error';
      
      if (errorCodes.includes('invalid-input-response')) {
        errorMessage = 'CAPTCHA verification failed: The token is invalid or has expired';
      } else if (errorCodes.includes('missing-input-response')) {
        errorMessage = 'CAPTCHA verification failed: The token was missing';
      } else if (errorCodes.includes('invalid-input-secret')) {
        errorMessage = 'CAPTCHA verification failed: The secret key is invalid';
      } else if (errorCodes.includes('bad-request')) {
        errorMessage = 'CAPTCHA verification failed: The request was malformed';
      } else if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = 'CAPTCHA verification failed: The token has already been used or expired';
      } else if (errorCodes.length > 0) {
        errorMessage = `CAPTCHA verification failed: ${errorCodes.join(', ')}`;
      }

      return {
        success: false,
        message: errorMessage,
        details: data
      };
    }

    // Handle reCAPTCHA v3 score
    if (typeof data.score === 'number') {
      // This is a v3 response with a score
      console.log(`verifyCaptcha: v3 verification - score: ${data.score}, action: ${data.action}`);
      
      if (data.score < minScore) {
        console.warn(`verifyCaptcha: v3 score too low (${data.score} < ${minScore})`);
        return {
          success: false,
          message: `CAPTCHA score too low: ${data.score.toFixed(2)}`,
          score: data.score,
          action: data.action,
          details: data
        };
      }

      return {
        success: true,
        message: 'CAPTCHA verification successful',
        score: data.score,
        action: data.action,
        details: data
      };
    }

    // This is a v2 response
    console.log('verifyCaptcha: v2 verification successful');
    return {
      success: true,
      message: 'CAPTCHA verification successful',
      details: data
    };
  } catch (error) {
    // Handle network or unexpected errors
    console.error('verifyCaptcha error:', error);
    
    // Provide a more specific error message if possible
    let errorMessage = 'CAPTCHA verification error: Unknown error';
    if (error instanceof Error) {
      errorMessage = `CAPTCHA verification error: ${error.message}`;
      
      // Handle axios-specific errors
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'CAPTCHA verification timed out. Please try again.';
        } else if (error.response) {
          errorMessage = `CAPTCHA verification server error: ${error.response.status} ${error.response.statusText}`;
        } else if (error.request) {
          errorMessage = 'CAPTCHA verification failed: No response from verification server.';
        }
      }
    }
    
    return {
      success: false,
      message: errorMessage,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
} 