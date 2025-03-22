import { NextResponse } from 'next/server';

export async function GET() {
  // Get the PUBLIC environment variables 
  // (this will mirror what client-side code will receive - only NEXT_PUBLIC_ prefixed vars)
  const publicVars = Object.entries(process.env)
    .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string | undefined>);
  
  // Specifically check reCAPTCHA key
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  
  return NextResponse.json({
    status: 'ok',
    publicVars: Object.keys(publicVars),
    hasRecaptchaSiteKey: !!recaptchaSiteKey,
    recaptchaSiteKeyLength: recaptchaSiteKey?.length || 0,
    recaptchaSiteKeyFirstChar: recaptchaSiteKey ? recaptchaSiteKey.charAt(0) : null,
    recaptchaSiteKeyLastChar: recaptchaSiteKey ? recaptchaSiteKey.charAt(recaptchaSiteKey.length - 1) : null
  });
}

export async function POST(request: Request) {
  // Parse the request body
  const body = await request.json();
  const { captchaToken } = body;

  // Check if we have a captcha token
  if (!captchaToken) {
    return NextResponse.json(
      { success: false, message: 'Missing CAPTCHA token' },
      { status: 400 }
    );
  }

  // Get the secret key from environment
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  if (!recaptchaSecret) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'reCAPTCHA is not properly configured on the server',
        details: {
          errorType: 'MISSING_SECRET_KEY',
          info: 'The RECAPTCHA_SECRET_KEY environment variable is not set'
        }
      },
      { status: 500 }
    );
  }

  try {
    // Log details for debugging
    console.log(`Verifying CAPTCHA token (length: ${captchaToken.length})`);
    
    // Verify the captcha token
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${recaptchaSecret}&response=${captchaToken}`,
      }
    );

    const data = await response.json();
    console.log('reCAPTCHA verification response:', data);

    if (data.success) {
      return NextResponse.json({
        success: true,
        message: 'CAPTCHA verified successfully',
        details: {
          score: data.score,
          hostname: data.hostname,
          action: data.action,
          timestamp: new Date().toISOString(),
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'CAPTCHA verification failed',
        details: {
          errorCodes: data['error-codes'],
          timestamp: new Date().toISOString(),
        }
      });
    }
  } catch (error) {
    console.error('Error verifying CAPTCHA:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error verifying CAPTCHA', 
        details: { errorType: 'SERVER_ERROR', error: String(error) } 
      },
      { status: 500 }
    );
  }
} 