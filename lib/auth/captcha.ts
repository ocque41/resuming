/**
 * Verifies a reCAPTCHA token with Google's reCAPTCHA verification API
 */
export async function verifyCaptcha(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY is not defined in environment variables');
      return false;
    }
    
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const data = await response.json();
    return data.success; // Returns true if verification succeeded
  } catch (error) {
    console.error('Error verifying reCAPTCHA token:', error);
    return false;
  }
} 