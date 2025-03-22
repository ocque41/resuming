/**
 * Utility for verifying hCaptcha tokens
 */

type HCaptchaVerificationResponse = {
  success: boolean;
  challenge_ts?: string; // timestamp of the challenge (ISO format)
  hostname?: string; // the hostname of the site where the challenge was solved
  credit?: boolean; // whether the response will be credited
  'error-codes'?: string[]; // optional error codes
};

/**
 * Verifies an hCaptcha token against the hCaptcha API
 * @param token The token from the hCaptcha widget
 * @returns Verification result with success status
 */
export async function verifyCaptcha(token: string): Promise<{ success: boolean; message?: string }> {
  try {
    // If we're in development mode, bypass the actual verification
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: Bypassing hCaptcha verification');
      return { success: true };
    }
    
    const secret = process.env.HCAPTCHA_SECRET_KEY;
    
    if (!secret) {
      console.error('hCaptcha secret key is not configured');
      throw new Error('CAPTCHA_CONFIGURATION_ERROR');
    }
    
    // Prepare the verification request to hCaptcha
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    
    // Get the site IP if possible (optional)
    const ip = ''; // You can add IP detection logic here if needed
    if (ip) {
      formData.append('remoteip', ip);
    }
    
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      // Send the verification request to hCaptcha with timeout
      const response = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`hCaptcha verification failed with status: ${response.status}`);
      }
      
      const data = await response.json() as HCaptchaVerificationResponse;
      
      if (!data.success) {
        console.error('hCaptcha verification failed:', data['error-codes']);
        return {
          success: false,
          message: `Verification failed: ${data['error-codes']?.join(', ') || 'Unknown error'}`,
        };
      }
      
      return { success: true };
    } catch (fetchError: unknown) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('hCaptcha verification timed out');
        // In case of timeout, we'll proceed with sign up but log the issue
        console.warn('Proceeding despite hCaptcha verification timeout');
        return { 
          success: true,
          message: 'Verification timed out but proceeding'
        };
      }
      throw fetchError; // Re-throw other fetch errors to be caught by the outer try/catch
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error during captcha verification:', error);
    
    // For production critical errors, consider falling back to success
    // This prevents the captcha from blocking signups completely during issues
    if (process.env.NODE_ENV === 'production') {
      console.warn('Proceeding with signup despite captcha error in production');
      return {
        success: true,
        message: 'Bypassing verification due to service error'
      };
    }
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during verification',
    };
  }
} 