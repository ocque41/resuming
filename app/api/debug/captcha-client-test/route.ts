import { NextRequest, NextResponse } from 'next/server';
import { verifyCaptcha } from '@/lib/captcha';

// GET handler for retrieving environment information
export async function GET() {
  // Get environment information that's safe to expose to the client
  // Be careful not to expose sensitive information
  const envInfo = {
    nodeEnv: process.env.NODE_ENV,
    siteKey: {
      exists: !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
      // Only show partial keys in production
      value: process.env.NODE_ENV === 'production' 
        ? (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY 
            ? `${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(0, 6)}...${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length - 4)}`
            : null)
        : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
      length: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.length,
    },
    secretKey: {
      exists: !!process.env.RECAPTCHA_SECRET_KEY,
      // Only show if the secret key exists, never show the actual value
      length: process.env.RECAPTCHA_SECRET_KEY?.length,
    },
    verifyEndpoint: 'https://www.google.com/recaptcha/api/siteverify',
    host: process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || null,
  };

  return NextResponse.json(envInfo);
}

// POST handler for testing the CAPTCHA verification
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { captchaToken } = await request.json();

    // Check if token is provided
    if (!captchaToken) {
      return NextResponse.json(
        { success: false, message: 'CAPTCHA token is required' },
        { status: 400 }
      );
    }

    // Verify the token
    const verificationResult = await verifyCaptcha(captchaToken);
    
    // Add debugging information
    const debugInfo = {
      success: verificationResult.success,
      message: verificationResult.message || (verificationResult.success
        ? 'CAPTCHA verification successful'
        : 'CAPTCHA verification failed'),
      // Include v3 specific fields if available
      score: verificationResult.score,
      action: verificationResult.action,
      isV3: verificationResult.score !== undefined,
      details: {
        verificationResult,
        token: {
          provided: !!captchaToken,
          length: captchaToken?.length,
          prefix: captchaToken?.substring(0, 10) + '...',
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasSecretKey: !!process.env.RECAPTCHA_SECRET_KEY,
          secretKeyLength: process.env.RECAPTCHA_SECRET_KEY?.length,
          hasSiteKey: !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
          siteKeyLength: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.length,
        },
        date: new Date().toISOString(),
      },
    };

    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('Error verifying CAPTCHA:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error processing CAPTCHA verification',
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
} 