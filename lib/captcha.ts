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
    
    // Send the verification request to hCaptcha
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    
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
  } catch (error) {
    console.error('Error during captcha verification:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during verification',
    };
  }
} 