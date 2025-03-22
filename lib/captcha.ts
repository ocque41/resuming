import axios from 'axios';

type VerificationResult = {
  success: boolean;
  message: string;
  score?: number;
  action?: string;
  details?: any;
};

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

  try {
    // Prepare request for Google's verification API
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', captchaToken);
    
    // Get the client's IP if available
    if (typeof window !== 'undefined') {
      const request = await fetch('https://api.ipify.org/?format=json');
      const data = await request.json();
      if (data.ip) {
        params.append('remoteip', data.ip);
      }
    }

    // Send verification request to Google
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const data = response.data;
    console.log('reCAPTCHA verification response:', data);

    // If verification failed
    if (!data.success) {
      const errorCodes = data['error-codes'] || [];
      const errorMessage = errorCodes.length > 0
        ? `CAPTCHA verification failed: ${errorCodes.join(', ')}`
        : 'CAPTCHA verification failed: Unknown error';

      return {
        success: false,
        message: errorMessage,
        details: data
      };
    }

    // Handle reCAPTCHA v3 score
    if (typeof data.score === 'number') {
      // This is a v3 response with a score
      if (data.score < minScore) {
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
    return {
      success: true,
      message: 'CAPTCHA verification successful',
      details: data
    };
  } catch (error) {
    // Handle network or unexpected errors
    console.error('verifyCaptcha error:', error);
    
    return {
      success: false,
      message: `CAPTCHA verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
} 