import { NextResponse } from 'next/server';

export async function GET() {
  // Get the reCAPTCHA site key and secret key from environment variables
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  // Check if they're defined
  const isSiteKeyConfigured = !!siteKey;
  const isSecretKeyConfigured = !!secretKey;
  
  // Create a configuration object with safe information
  const config = {
    isSiteKeyConfigured,
    isSecretKeyConfigured,
    siteKeyLength: siteKey?.length || 0,
    secretKeyLength: secretKey?.length || 0,
    environment: process.env.NODE_ENV,
    // Only show the last 4 characters for debugging purposes
    siteKeyEndsIn: siteKey ? siteKey.slice(-4) : null,
    host: process.env.VERCEL_URL || process.env.NODE_ENV === 'development' ? 'localhost' : null
  };
  
  return NextResponse.json({
    status: 'ok',
    config
  });
} 